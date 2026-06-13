import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { usePermissions } from '@/lib/permissions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LogOut, Sun, Moon, LayoutDashboard, Users, FileText,
  Home, Star, Mail, ShieldCheck, UserCheck, Receipt, UserCog, PanelLeft, Menu, Settings, ChevronRight, ChevronsUpDown,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface NavItem { to: string; label: string; icon: React.ElementType; perm?: string }
interface NavGroup { label: string; links: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    links: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard:view' }],
  },
  {
    label: 'Pipeline',
    links: [
      { to: '/leads', label: 'Leads', icon: Users, perm: 'leads:view' },
      { to: '/clients', label: 'Clients', icon: UserCheck, perm: 'clients:view' },
      { to: '/journeys', label: 'Buyer Journeys', icon: FileText, perm: 'journeys:view' },
      { to: '/invoices', label: 'Invoices', icon: Receipt, perm: 'invoices:view' },
    ],
  },
  {
    label: 'Property',
    links: [
      { to: '/properties', label: 'Properties', icon: Home, perm: 'properties:view' },
      { to: '/due-diligence', label: 'Due Diligence', icon: ShieldCheck, perm: 'dueDiligence:view' },
    ],
  },
  {
    label: 'Network',
    links: [
      { to: '/agents', label: 'Agents', icon: Star, perm: 'agents:view' },
      { to: '/emails', label: 'Emails', icon: Mail, perm: 'emails:view' },
    ],
  },
  {
    label: 'Administration',
    links: [
      { to: '/team', label: 'Team', icon: UserCog, perm: 'team:view' },
    ],
  },
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
  const { can } = usePermissions();

  // Hide nav links the current role can't view; drop now-empty groups.
  const visibleGroups = navGroups
    .map((g) => ({ ...g, links: g.links.filter((l) => !l.perm || can(l.perm)) }))
    .filter((g) => g.links.length > 0);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close the account menu on outside click.
  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [accountOpen]);

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

          {/* Active chevron (right side) — hidden when collapsed (matches label) */}
          {isActive && (
            <ChevronRight
              className={cn('ml-auto h-4 w-4 shrink-0 transition-transform duration-200', collapsed ? 'lg:hidden' : 'block')}
              style={{ color: 'hsl(var(--sidebar-item-active))' }}
            />
          )}

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
          <img src="/images/logo.png" alt="Martelli Buyers" className="h-8 w-8 shrink-0 rounded-full object-contain" />
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
            <img src="/images/logo.png" alt="Martelli Buyers" className="h-8 w-8 shrink-0 rounded-full object-contain" />
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

        {/* Grouped nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {visibleGroups.map((group, gi) => (
            <div key={group.label} className={cn(gi > 0 && 'mt-3')}>
              {/* Expanded: group eyebrow (hidden on desktop when collapsed) */}
              <div className={cn('px-3 pb-1.5', collapsed && 'lg:hidden')}>
                <span className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: 'hsl(var(--sidebar-text-muted))' }}>
                  {group.label}
                </span>
              </div>
              {/* Collapsed (desktop only): thin divider instead of a label */}
              {collapsed && gi > 0 && (
                <div className="mx-3 mb-2 hidden border-t lg:block" style={{ borderColor: 'hsl(var(--sidebar-border))' }} />
              )}
              <div className="space-y-0.5">
                {group.links.map(renderNavLink)}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div
          className="shrink-0 border-t px-2 py-3 space-y-0.5"
          style={{ borderColor: 'hsl(var(--sidebar-border))' }}
        >
          {bottomNavLinks.map(renderNavLink)}

          {/* Account card + menu */}
          <div className="relative mt-1.5" ref={accountRef}>
            {/* Popup menu (opens above the card) */}
            {accountOpen && (
              <div
                className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border bg-card p-1 shadow-lg z-[70]"
                style={{ borderColor: 'hsl(var(--sidebar-border))' }}
              >
                <button
                  type="button"
                  onClick={() => { toggleTheme(); setAccountOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors hover:bg-muted"
                  style={{ color: 'hsl(var(--sidebar-text))' }}
                >
                  {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
                  {isDark ? 'Light mode' : 'Dark mode'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAccountOpen(false); handleLogout(); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Sign out
                </button>
              </div>
            )}

            {/* The card itself */}
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              className={cn(
                'group flex w-full items-center gap-2.5 rounded-xl border transition-colors',
                collapsed ? 'lg:justify-center lg:border-transparent lg:p-1.5 px-2.5 py-2' : 'px-2.5 py-2',
              )}
              style={{
                borderColor: collapsed ? undefined : 'hsl(var(--sidebar-border))',
                background: accountOpen ? 'hsl(var(--sidebar-item-hover))' : 'transparent',
              }}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback
                  className="text-[11px] font-bold"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className={cn('min-w-0 flex-1 text-left transition-all duration-200', collapsed ? 'lg:hidden' : 'block')}>
                <p className="truncate text-[12.5px] font-semibold leading-tight" style={{ color: 'hsl(var(--sidebar-text))' }}>
                  {currentUser?.name ?? 'Martelli Buyers'}
                </p>
                <p className="truncate text-[10.5px] capitalize leading-tight mt-0.5" style={{ color: 'hsl(var(--sidebar-text-muted))' }}>
                  {currentUser?.role ?? 'member'}
                </p>
              </div>
              <ChevronsUpDown
                className={cn('h-3.5 w-3.5 shrink-0 transition-colors', collapsed ? 'lg:hidden' : 'block')}
                style={{ color: 'hsl(var(--sidebar-text-muted))' }}
              />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}