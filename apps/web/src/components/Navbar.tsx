import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Bell, LogOut, ChevronDown, Building2, Sun, Moon,
  LayoutDashboard, Users, FileText, Home, Star, Mail, ShieldCheck, Menu, X, UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/clients', label: 'Clients', icon: UserCheck },
  { to: '/journeys', label: 'Buyer Journeys', icon: FileText },
  { to: '/properties', label: 'Properties', icon: Home },
  { to: '/agents', label: 'Agents', icon: Star },
  { to: '/emails', label: 'Emails', icon: Mail },
  { to: '/due-diligence', label: 'Due Diligence', icon: ShieldCheck },
];

export function Navbar() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <NavLink to="/dashboard" className="flex items-center gap-3 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/30">
              <Building2 className="h-[18px] w-[18px] text-primary-foreground" />
            </div>
            <div className="leading-none hidden sm:block">
              <span className="block text-sm font-bold text-foreground tracking-tight">Martelli</span>
              <span className="block text-[10px] text-muted-foreground tracking-wider uppercase">Buyers CRM</span>
            </div>
          </NavLink>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0.5 text-sm flex-1 ml-4">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-150 text-[13px] font-medium',
                    isActive
                      ? 'text-primary bg-primary/10 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <link.icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary' : '')} />
                    {link.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-1.5">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleTheme}
              className="relative h-9 w-9 rounded-lg"
            >
              <Sun
                className={cn(
                  'h-4 w-4 transition-all duration-300',
                  isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0 absolute'
                )}
              />
              <Moon
                className={cn(
                  'h-4 w-4 transition-all duration-300',
                  isDark ? 'rotate-90 scale-0 opacity-0 absolute' : 'rotate-0 scale-100 opacity-100'
                )}
              />
            </Button>

            <Button variant="ghost" size="icon" aria-label="Notifications" className="h-9 w-9 rounded-lg">
              <Bell className="h-4 w-4" />
            </Button>

            {/* User menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-muted transition-all duration-150 border border-transparent hover:border-border"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px] font-bold bg-primary/15 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-[13px] font-semibold leading-none text-foreground">{currentUser?.name ?? 'User'}</p>
                  <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{currentUser?.role ?? 'member'}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-primary/5 border-b border-border">
                      <p className="text-xs font-semibold text-foreground">{currentUser?.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{currentUser?.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 rounded-lg"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-40 w-72 max-w-[85vw] bg-card border-r border-border shadow-xl flex flex-col">
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                <Building2 className="h-[18px] w-[18px] text-primary-foreground" />
              </div>
              <div>
                <span className="block text-sm font-bold text-foreground">Martelli</span>
                <span className="block text-[10px] text-muted-foreground tracking-wider uppercase">Buyers CRM</span>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <link.icon className={cn('h-4 w-4', isActive ? 'text-primary' : '')} />
                      {link.label}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="p-3 border-t border-border">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/5 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}