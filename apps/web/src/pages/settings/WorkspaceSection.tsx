import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WorkspaceSection() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="space-y-5">
      {/* Profile */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">Your profile</CardTitle>
          <CardDescription className="mt-1 text-sm">How you appear across the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarFallback className="text-base font-bold" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-foreground">{currentUser?.name ?? 'User'}</p>
              <p className="truncate text-sm text-muted-foreground">{currentUser?.email ?? '—'}</p>
              <span className="mt-1.5 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold capitalize text-primary">
                {currentUser?.role ?? 'member'}
              </span>
            </div>
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
