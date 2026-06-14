import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useConfigStore } from '@/stores/configStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadFile } from '@/lib/upload';
import { Sun, Moon, Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function initialsOf(name?: string): string {
  return name ? name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : 'U';
}

export function WorkspaceSection() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const hasS3 = useConfigStore((s) => s.hasS3);

  const [name, setName] = useState(currentUser?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-sync the editable fields whenever the signed-in user loads/changes.
  useEffect(() => {
    setName(currentUser?.name ?? '');
    setAvatarUrl(currentUser?.avatarUrl ?? '');
  }, [currentUser?.id, currentUser?.name, currentUser?.avatarUrl]);

  const dirty =
    name.trim() !== (currentUser?.name ?? '') || avatarUrl !== (currentUser?.avatarUrl ?? '');

  const pickFile = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-selected later
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(file, { scope: 'avatar', scopeId: currentUser?.id });
      setAvatarUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty.');
      return;
    }
    setSaving(true);
    const res = await updateProfile({ name: trimmed, avatarUrl });
    setSaving(false);
    if (res.ok) toast.success('Profile updated.');
    else toast.error(res.error ?? 'Could not save your profile.');
  };

  const initials = initialsOf(name);

  return (
    <div className="space-y-5">
      {/* Profile */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">Your profile</CardTitle>
          <CardDescription className="mt-1 text-sm">How you appear across the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {/* Avatar + uploader */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20 ring-1 ring-border">
                <AvatarFallback className="text-xl font-bold" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                  {initials}
                </AvatarFallback>
                <AvatarImage src={avatarUrl} alt={name} />
              </Avatar>
              <button
                type="button"
                onClick={pickFile}
                disabled={!hasS3 || uploading}
                aria-label="Change photo"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={pickFile} disabled={!hasS3 || uploading}>
                  {uploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAvatarUrl('')}
                    disabled={uploading}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {hasS3 ? 'JPG, PNG or GIF — up to 15MB.' : 'File storage isn’t configured, so photo upload is unavailable.'}
              </p>
            </div>

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>

          {/* Name */}
          <div className="space-y-1.5 sm:max-w-sm">
            <label htmlFor="profile-name" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Full name
            </label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={120}
            />
          </div>

          {/* Email + role (read-only — managed by an admin under Team) */}
          <div className="grid gap-4 sm:max-w-md sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Email</span>
              <p className="truncate text-sm text-foreground">{currentUser?.email ?? '—'}</p>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Role</span>
              <div>
                <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold capitalize text-primary">
                  {currentUser?.role ?? 'member'}
                </span>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end border-t border-border/60 pt-4">
            <Button type="button" onClick={handleSave} disabled={!dirty || saving || uploading}>
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">Appearance</CardTitle>
          <CardDescription className="mt-1 text-sm">Choose how the interface looks on this device.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            {([
              { mode: 'light', label: 'Light', icon: Sun, active: !isDark },
              { mode: 'dark', label: 'Dark', icon: Moon, active: isDark },
            ] as const).map((opt) => (
              <button
                key={opt.mode}
                type="button"
                onClick={() => { if (opt.active) return; toggleTheme(); }}
                className={cn('flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                  opt.active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40')}
              >
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', opt.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                  <opt.icon className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground">{opt.active ? 'Active' : 'Switch'}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
