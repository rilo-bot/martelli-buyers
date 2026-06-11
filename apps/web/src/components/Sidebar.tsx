import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LogOut, Building2, Sun, Moon, LayoutDashboard, Users, FileText,
  Home, Star, Mail, ShieldCheck, UserCheck, PanelLeft, Menu, Settings,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/clients', label: 'Clients', icon: UserCheck },
  { to: '/deals', label: 'Campaigns', icon: FileText },
  { to: '/properties', label: 'Properties', icon: Home },
  { to: '/agents', label: 'Agents', icon: Star },
  { to: '/emails', label: 'Emails', icon: Mail },
  { to: '/due-diligence', label: 'Due Diligence', icon: ShieldCheck },
];

const bottomNavLinks = [
  { to: '/settings', label: 'Settings', icon: Settings },
];

const STORAGE_KEY = 'martelli-sidebar-collapsed';

function applyMainMargin(isCollapsed: boolean) {
  const el = document.getElementById('main-content');
  if (el) {
    el.style.marginLeft = isCollapsed ? '68px' : '228px';
  }
}

export function Sidebar() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
      applyMainMargin(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    if (mq.matches) applyMainMargin(collapsed);
    const handleResize = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) {
        applyMainMargin(collapsed);
      } else {
        const el = document.getElementById('main-content');
        if (el) el.style.marginLeft = '0';
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [collapsed]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const renderNavLink = (link: { to: string; label: string; icon: React.ElementType }) => (
    <NavLink
      key={link.to}
      to={link.to}
      onClick={() => setMobileOpen(false)}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150 group overflow-visible',
          collapsed ? 'lg:justify-center lg:px-0 lg:py-2.5 px-3 py-2.5' : 'px-3 py-2.5',
          isActive ? 'sidebar-link-active' : 'sidebar-link-idle'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full"
              style={{ background: 'hsl(var(--sidebar-item-active))' }}
            />
          )}
          <link.icon
            className={cn('shrink-0 transition-colors', collapsed ? 'h-[18px] w-[18px]' : 'h-[16px] w-[16px]')}
            style={{
              color: isActive
                ? 'hsl(var(--sidebar-item-active))'
                : 'hsl(var(--sidebar-text-muted))',
            }}
          />
          <span
            className={cn('transition-all duration-200 whitespace-nowrap', collapsed ? 'lg:hidden' : 'block')}
            style={{ color: isActive ? 'hsl(var(--sidebar-text))' : 'hsl(var(--sidebar-text-muted))' }}
          >
            {link.label}
          </span>

          {/* Tooltip when collapsed */}
          {collapsed && (
            <span className="hidden lg:group-hover:flex items-center absolute left-full ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card text-foreground border border-border shadow-lg whitespace-nowrap z-[70] pointer-events-none">
              {link.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b"
        style={{
          background: 'hsl(var(--sidebar-bg))',
          borderColor: 'hsl(var(--sidebar-border))',
        }}
      >
        <NavLink to="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, hsl(213 94% 48%), hsl(174 72% 42%))' }}>
            <Building2 className="h-4 w-4" style={{ color: '#fff' }} />
          </div>
          <div className="leading-none">
            <span className="block text-sm font-bold tracking-tight" style={{ color: 'hsl(var(--sidebar-text))' }}>Martelli</span>
            <span className="block text-[9px] tracking-[0.12em] uppercase" style={{ color: 'hsl(var(--sidebar-text-muted))' }}>Buyers CRM</span>
          </div>
        </NavLink>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'hsl(var(--sidebar-text-muted))' }}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out border-r',
          collapsed ? 'lg:w-[68px]' : 'lg:w-[228px]',
          'w-[240px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{
          background: 'hsl(var(--sidebar-bg))',
          borderColor: 'hsl(var(--sidebar-border))',
        }}
      >
        {/* Logo header */}
        <div
          className="flex items-center h-14 shrink-0 px-3 relative border-b"
          style={{ borderColor: 'hsl(var(--sidebar-border))' }}
        >
          <NavLink to="/dashboard" className="flex items-center shrink-0" onClick={() => setMobileOpen(false)}>
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-md"
              style={{ background: 'linear-gradient(135deg, hsl(213 94% 48%), hsl(174 72% 42%))' }}
            >
              <Building2 className="h-4 w-4" style={{ color: '#fff' }} />
            </div>
          </NavLink>

          <div
            className={cn(
              'leading-none overflow-hidden transition-all duration-200 ml-2.5',
              collapsed ? 'lg:w-0 lg:opacity-0 lg:ml-0 lg:pointer-events-none' : 'opacity-100'
            )}
          >
            <span className="block text-sm font-bold tracking-tight whitespace-nowrap" style={{ color: 'hsl(var(--sidebar-text))' }}>
              Martelli
            </span>
            <span className="block text-[9px] tracking-[0.12em] uppercase whitespace-nowrap" style={{ color: 'hsl(var(--sidebar-text-muted))' }}>
              Buyers CRM
            </span>
          </div>

          <div className="flex-1" />

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'hidden lg:flex items-center justify-center rounded-full border transition-all duration-150 shrink-0 h-6 w-6',
              collapsed ? 'absolute -right-3 top-1/2 -translate-y-1/2 z-10' : 'relative'
            )}
            style={{
              background: 'hsl(var(--sidebar-bg))',
              borderColor: 'hsl(var(--sidebar-border))',
              color: 'hsl(var(--sidebar-text-muted))',
              boxShadow: '0 1px 4px hsl(215 45% 4% / 0.4)',
            }}
          >
            <PanelLeft className={cn('h-3 w-3 transition-transform duration-300', collapsed ? 'rotate-180' : 'rotate-0')} />
          </button>
        </div>

        {/* Section label */}
        {!collapsed && (
          <div className="px-4 pt-4 pb-1">
            <span className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: 'hsl(var(--sidebar-text-muted))' }}>
              Main Menu
            </span>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {navLinks.map(renderNavLink)}
        </nav>

        {/* Bottom section */}
        <div
          className="shrink-0 border-t px-2 py-3 space-y-0.5"
          style={{ borderColor: 'hsl(var(--sidebar-border))' }}
        >
          {bottomNavLinks.map(renderNavLink)}

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={cn(
              'relative flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150 w-full group',
              collapsed ? 'lg:justify-center lg:px-0 lg:py-2.5 px-3 py-2.5' : 'px-3 py-2.5',
              'sidebar-link-idle'
            )}
            style={{ color: 'hsl(var(--sidebar-text-muted))' }}
          >
            {isDark
              ? <Sun className={cn('shrink-0', collapsed ? 'h-[18px] w-[18px]' : 'h-[16px] w-[16px]')} />
              : <Moon className={cn('shrink-0', collapsed ? 'h-[18px] w-[18px]' : 'h-[16px] w-[16px]')} />
            }
            <span className={cn('whitespace-nowrap transition-all duration-200', collapsed ? 'lg:hidden' : 'block')}>
              {isDark ? 'Light mode' : 'Dark mode'}
            </span>
            {collapsed && (
              <span className="hidden lg:group-hover:flex items-center absolute left-full ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card text-foreground border border-border shadow-lg whitespace-nowrap z-[70] pointer-events-none">
                {isDark ? 'Light mode' : 'Dark mode'}
              </span>
            )}
          </button>

          {/* Divider */}
          <div className="mx-2 my-1" style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }} />

          {/* User identity */}
          <div className={cn('flex items-center gap-3 px-3 py-2 rounded-lg', collapsed ? 'lg:justify-center lg:px-0' : '')}>
            <Avatar className="h-7 w-7 shrink-0 ring-2" style={{ ['--tw-ring-color' as string]: 'hsl(var(--sidebar-border))' } as React.CSSProperties}>
              <AvatarFallback
                className="text-[11px] font-bold"
                style={{ background: 'linear-gradient(135deg, hsl(213 94% 38% / 0.35), hsl(174 72% 38% / 0.25))', color: 'hsl(var(--sidebar-text))' }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className={cn('min-w-0 transition-all duration-200', collapsed ? 'lg:hidden' : 'block')}>
              <p className="text-[12px] font-semibold leading-none truncate" style={{ color: 'hsl(var(--sidebar-text))' }}>
                {currentUser?.name ?? 'User'}
              </p>
              <p className="text-[10px] capitalize mt-0.5 truncate" style={{ color: 'hsl(var(--sidebar-text-muted))' }}>
                {currentUser?.role ?? 'member'}
              </p>
            </div>
          </div>

          {/* Sign out */}
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'relative flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150 w-full group',
              collapsed ? 'lg:justify-center lg:px-0 lg:py-2.5 px-3 py-2.5' : 'px-3 py-2.5',
              'sidebar-link-idle'
            )}
            style={{ color: 'hsl(var(--sidebar-text-muted))' }}
          >
            <LogOut className={cn('shrink-0', collapsed ? 'h-[18px] w-[18px]' : 'h-[16px] w-[16px]')} />
            <span className={cn('whitespace-nowrap transition-all duration-200', collapsed ? 'lg:hidden' : 'block')}>
              Sign out
            </span>
            {collapsed && (
              <span className="hidden lg:group-hover:flex items-center absolute left-full ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card text-foreground border border-border shadow-lg whitespace-nowrap z-[70] pointer-events-none">
                Sign out
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}