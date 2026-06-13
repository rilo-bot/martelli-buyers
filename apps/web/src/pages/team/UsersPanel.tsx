import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, Trash2, Copy } from 'lucide-react';
import { useUsersStore } from '@/stores/usersStore';
import { useRolesStore } from '@/stores/rolesStore';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/lib/permissions';
import { ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export function UsersPanel() {
  const { users, fetch, create, update, remove, resendInvite, loaded } = useUsersStore();
  const roles = useRolesStore((s) => s.roles);
  const nameForRole = useRolesStore((s) => s.nameFor);
  const currentUser = useAuthStore((s) => s.currentUser);
  const { can } = usePermissions();
  const canManage = can('team:manage');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('staff');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded) fetch().catch(() => {});
  }, [loaded, fetch]);

  // Default the new-user role to the first available once roles load.
  useEffect(() => {
    if (roles.length && !roles.some((r) => r.key === role)) setRole(roles[0].key);
  }, [roles, role]);

  const errMsg = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

  const copyLink = async (url: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${msg} — invite link copied to clipboard.`);
    } catch {
      // Clipboard blocked (e.g. non-secure context) — surface the link to copy manually.
      toast.success(msg, { description: url });
    }
  };

  const addUser = async () => {
    if (!email.trim()) {
      toast.error('Enter an email address.');
      return;
    }
    setBusy(true);
    try {
      const { inviteUrl } = await create({ email: email.trim(), name: name.trim(), role });
      await copyLink(inviteUrl, 'Invite sent');
      setEmail('');
      setName('');
    } catch (err) {
      toast.error(errMsg(err, 'Could not add the user.'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async (id: string) => {
    try {
      const url = await resendInvite(id);
      await copyLink(url, 'Invite re-sent');
    } catch (err) {
      toast.error(errMsg(err, 'Could not resend the invite.'));
    }
  };

  const changeRole = async (id: string, nextRole: string) => {
    try {
      await update(id, { role: nextRole });
      toast.success('Role updated.');
    } catch (err) {
      toast.error(errMsg(err, 'Could not update the role.'));
    }
  };

  const deleteUser = async (id: string, label: string) => {
    if (!window.confirm(`Remove ${label}? They will lose access immediately.`)) return;
    try {
      await remove(id);
      toast.success('User removed.');
    } catch (err) {
      toast.error(errMsg(err, 'Could not remove the user.'));
    }
  };

  return (
    <div className="space-y-5">
      {/* Add user */}
      {canManage && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base font-semibold">Add a team member</CardTitle>
            <CardDescription className="mt-1 text-sm">
              They sign in with a one-time code sent to this email. Assign a role to set their access.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_0.8fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="new-user-email">Email</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  placeholder="name@martelli.co.nz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-user-name">Name</Label>
                <Input id="new-user-name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-user-role">Role</Label>
                <Select id="new-user-role" value={role} onChange={(e) => setRole(e.target.value)}>
                  {roles.map((r) => (
                    <option key={r.key} value={r.key}>{r.name || r.key}</option>
                  ))}
                </Select>
              </div>
              <Button onClick={addUser} disabled={busy} className="gap-1.5">
                <UserPlus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users list */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">Team members</CardTitle>
          <CardDescription className="mt-1 text-sm">{users.length} {users.length === 1 ? 'member' : 'members'}.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-border/60">
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              const label = u.name || u.email;
              return (
                <div key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                      {label} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                      {u.status === 'invited' && (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">Invited</Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  {/* Resend / copy invite link for users who haven't activated yet. */}
                  {canManage && u.status === 'invited' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
                      title="Copy a fresh invite link"
                      onClick={() => resend(u.id)}
                    >
                      <Copy className="h-3.5 w-3.5" /> Invite link
                    </Button>
                  )}
                  {/* Role: a dropdown for others, read-only for yourself (no self role change). */}
                  {canManage && !isSelf ? (
                    <Select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className="h-9 w-40 shrink-0"
                    >
                      {/* Keep an unknown role visible so it isn't silently lost. */}
                      {!roles.some((r) => r.key === u.role) && <option value={u.role}>{u.role}</option>}
                      {roles.map((r) => (
                        <option key={r.key} value={r.key}>{r.name || r.key}</option>
                      ))}
                    </Select>
                  ) : (
                    <Badge variant="secondary" className="shrink-0 capitalize">{nameForRole(u.role)}</Badge>
                  )}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={isSelf}
                      title={isSelf ? 'You cannot remove your own account' : 'Remove user'}
                      onClick={() => deleteUser(u.id, label)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            {users.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No team members yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
