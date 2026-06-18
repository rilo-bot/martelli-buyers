import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, ShieldCheck, X } from 'lucide-react';
import { useRolesStore } from '@/stores/rolesStore';
import { useUsersStore } from '@/stores/usersStore';
import { usePermissions } from '@/lib/permissions';
import { ApiError } from '@/lib/api';
import { canManageRole, type Role } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PermissionMatrix } from './PermissionMatrix';

const errMsg = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export function RolesPanel() {
  const { roles, fetch, create, update, remove, loaded } = useRolesStore();
  const users = useUsersStore((s) => s.users);
  const { can, isSuperAdmin } = usePermissions();
  const canManageRoles = can('team:manage');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded) fetch().catch(() => {});
  }, [loaded, fetch]);

  const usageFor = (key: string) => users.filter((u) => u.role === key).length;

  const startEdit = (role: Role) => {
    setEditingId(role.id);
    setDraft(role.permissions ?? []);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft([]);
  };
  const saveEdit = async (role: Role) => {
    setBusy(true);
    try {
      await update(role.id, { permissions: draft });
      toast.success('Permissions updated.');
      cancelEdit();
    } catch (err) {
      toast.error(errMsg(err, 'Could not save permissions.'));
    } finally {
      setBusy(false);
    }
  };

  const createRole = async () => {
    if (!newName.trim()) {
      toast.error('Give the role a name.');
      return;
    }
    setBusy(true);
    try {
      const role = await create({ name: newName.trim(), description: newDesc.trim(), permissions: [] });
      toast.success('Role created. Set its permissions below.');
      setCreating(false);
      setNewName('');
      setNewDesc('');
      startEdit(role);
    } catch (err) {
      toast.error(errMsg(err, 'Could not create the role.'));
    } finally {
      setBusy(false);
    }
  };

  const deleteRole = async (role: Role) => {
    if (!window.confirm(`Delete the "${role.name}" role?`)) return;
    try {
      await remove(role.id);
      toast.success('Role deleted.');
    } catch (err) {
      toast.error(errMsg(err, 'Could not delete the role.'));
    }
  };

  return (
    <div className="space-y-5">
      {/* Create custom role */}
      {canManageRoles && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <CardTitle className="text-base font-semibold">Roles</CardTitle>
              <CardDescription className="mt-1 text-sm">
                Edit a role's permissions, or create a custom role. Only the super admin can change the Admin role.
              </CardDescription>
            </div>
            {!creating && (
              <Button variant="outline" className="gap-1.5" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                New role
              </Button>
            )}
          </CardHeader>
          {creating && (
            <CardContent className="pt-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_1.6fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="role-name">Name</Label>
                  <Input id="role-name" placeholder="e.g. Viewer" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role-desc">Description</Label>
                  <Input id="role-desc" placeholder="What this role is for" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={createRole} disabled={busy}>Create</Button>
                  <Button variant="ghost" onClick={() => { setCreating(false); setNewName(''); setNewDesc(''); }}>Cancel</Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Role cards */}
      {roles.map((role) => {
        const isEditing = editingId === role.id;
        const usage = usageFor(role.key);
        // The Admin role is super-admin-only; every other role follows team:manage.
        const canEditRole = canManageRoles && canManageRole(role.key, isSuperAdmin);
        return (
          <Card key={role.id} className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  {role.name || role.key}
                  {role.isSystem ? (
                    <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> Built-in</Badge>
                  ) : (
                    <Badge variant="outline">Custom</Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1 text-sm">
                  {role.description || 'No description.'} · {usage} {usage === 1 ? 'user' : 'users'}
                </CardDescription>
              </div>
              {canEditRole && (
                <div className="flex shrink-0 items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button size="sm" onClick={() => saveEdit(role)} disabled={busy}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} className="gap-1.5"><X className="h-3.5 w-3.5" /> Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => startEdit(role)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit permissions
                      </Button>
                      {!role.isSystem && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          title="Delete role"
                          onClick={() => deleteRole(role)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-5">
              <PermissionMatrix
                value={isEditing ? draft : role.permissions ?? []}
                onChange={isEditing ? setDraft : undefined}
                readOnly={!isEditing}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
