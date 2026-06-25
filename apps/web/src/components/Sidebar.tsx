import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { usePermissions } from '@/lib/permissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  LogOut, Sun, Moon, LayoutDashboard, Users, FileText,
  Home, Star, Mail, Inbox, ShieldCheck, UserCheck, Receipt, UserCog, PanelLeft, Menu, Settings, ChevronRight, ChevronsUpDown, Video, FolderArchive,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useMenu } from '@/lib/useMenu';
import { cn } from '@/lib/utils';

interface NavItem { to: string; label: string; icon: React.ElementType; perm?: string }
interface NavGroup { label: string; links: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    links: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard:view' },
    ],
  },
  {
    label: 'Resources',
    links: [
      { to: '/documents', label: 'Documents', icon: FolderArchive, perm: 'documents:view' },
    ],
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
      { to: '/inbox', label: 'Inbox', icon: Inbox, perm: 'emails:view' },
      { to: '/meet', label: 'Meet', icon: Video, perm: 'meet:view' },
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
  const { triggerRef: accountTriggerRef, menuRef: accountMenuRef } = useMenu(
    accountOpen,
    () => setAccountOpen(false),
  );

  // Close the mobile drawer on Escape and lock body scroll while it's open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

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
            <span className="hidden lg:group-hover:flex lg:group-focus-within:flex items-center absolute left-full ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card text-foreground border border-border shadow-lg whitespace-nowrap z-[70] pointer-events-none">
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
        <NavLink to="/dashboard" className="flex items-center">
          <div className="brand-wordmark leading-none">
            <span className="block text-[15px]" style={{ color: 'hsl(var(--sidebar-text))' }}>
              <span className="bw-name">Martelli</span> <span className="bw-co">&amp; Co</span>
            </span>
            <span className="brand-eyebrow mt-0.5 block text-[8px]" style={{ color: 'hsl(var(--sidebar-text-muted))' }}>Buyers Agents</span>
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
          'chrome-weave fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out border-r',
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
          <NavLink
            to="/dashboard"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'brand-wordmark leading-none overflow-hidden transition-all duration-200',
              collapsed ? 'lg:w-0 lg:opacity-0 lg:pointer-events-none' : 'opacity-100'
            )}
          >
            <span className="block text-[15px] whitespace-nowrap" style={{ color: 'hsl(var(--sidebar-text))' }}>
              <span className="bw-name">Martelli</span> <span className="bw-co">&amp; Co</span>
            </span>
            <span className="brand-eyebrow mt-0.5 block text-[8px] whitespace-nowrap" style={{ color: 'hsl(var(--sidebar-text-muted))' }}>
              Buyers Agents
            </span>
          </NavLink>

          {/* Collapsed logo mark (desktop only) — fills the gap left by the hidden wordmark.
              Inline SVG so it always renders and adapts to the theme. */}
          <NavLink
            to="/dashboard"
            onClick={() => setMobileOpen(false)}
            aria-label="Martelli & Co"
            className={cn(
              'absolute inset-0 hidden items-center justify-center',
              collapsed && 'lg:flex'
            )}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="Martelli & Co"
            >
              <circle cx="32" cy="32" r="32" fill={isDark ? '#EBE8E0' : '#768255'} />
              <path
                d="M19 44V22.5L32 37L45 22.5V44"
                stroke={isDark ? '#23261C' : '#FAF8EF'}
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </NavLink>

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
          <div className="relative mt-1.5">
            {/* Popup menu (opens above the card) */}
            {accountOpen && (
              <div
                ref={accountMenuRef}
                role="menu"
                aria-label="Account"
                className={cn(
                  'absolute bottom-full mb-2 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg z-[70]',
                  // Mobile drawer is full width, so stretch the menu. On the collapsed desktop rail
                  // (~68px) a stretched menu clips labels, so anchor left and give it a fixed width.
                  collapsed ? 'left-0 right-0 lg:right-auto lg:w-48' : 'left-0 right-0'
                )}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { toggleTheme(); setAccountOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
                  {isDark ? 'Light mode' : 'Dark mode'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setAccountOpen(false); handleLogout(); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Sign out
                </button>
              </div>
            )}

            {/* The card itself */}
            <button
              ref={accountTriggerRef}
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
                <AvatarImage src={currentUser?.avatarUrl} alt={currentUser?.name} />
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