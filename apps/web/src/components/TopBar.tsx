import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Search, Plus, ChevronRight } from 'lucide-react';
import { CommandPalette } from '@/components/CommandPalette';
import { StatusPill } from '@/components/ui/status-pill';
import { usePermissions } from '@/lib/permissions';
import { useBreadcrumbStore } from '@/stores/breadcrumbStore';
import { useMenu } from '@/lib/useMenu';
import { cn } from '@/lib/utils';

const SECTION_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  leads: 'Leads',
  deals: 'Buyer Journeys',
  journeys: 'Buyer Journeys',
  clients: 'Clients',
  properties: 'Properties',
  agents: 'Agents',
  emails: 'Emails',
  invoices: 'Invoices',
  'due-diligence': 'Due Diligence',
  team: 'Team',
  settings: 'Settings',
};

const CREATE_LINKS = [
  { label: 'New lead', to: '/leads?new=1', perm: 'leads:create' },
  { label: 'New buyer journey', to: '/journeys?new=1', perm: 'journeys:create' },
  { label: 'New client', to: '/clients?new=1', perm: 'clients:create' },
  { label: 'New agent', to: '/agents?new=1', perm: 'agents:create' },
];

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const { triggerRef: newTriggerRef, menuRef: newMenuRef } = useMenu(newOpen, () => setNewOpen(false));
  const createLinks = CREATE_LINKS.filter((l) => can(l.perm));
  const detailTitle = useBreadcrumbStore((s) => s.detailTitle);

  // Global ⌘K / Ctrl+K to open the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const segments = location.pathname.split('/').filter(Boolean);
  const section = segments[0] ?? 'dashboard';
  const sectionTitle = SECTION_TITLES[section] ?? section.charAt(0).toUpperCase() + section.slice(1);
  const isDetail = segments.length > 1;
  const sectionPath = `/${section}`;
  // Prefer the record name supplied by the detail page; fall back to "Detail".
  const detailCrumb = detailTitle ?? 'Detail';

  return (
    <>
      <header className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-border/70 bg-background/70 px-6 backdrop-blur-md lg:flex">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          {isDetail ? (
            <>
              <Link to={sectionPath} className="text-muted-foreground hover:text-foreground transition-colors">{sectionTitle}</Link>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              <span className="font-medium text-foreground truncate" aria-current="page">{detailCrumb}</span>
            </>
          ) : (
            <span className="font-semibold text-foreground">{sectionTitle}</span>
          )}
        </nav>

        <div className="flex-1" />

        {/* Live status */}
        <StatusPill tone="live" className="mr-1">Live</StatusPill>

        {/* Search trigger */}
        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="flex h-9 w-64 items-center gap-2 rounded-lg border border-border bg-card/80 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium">⌘K</kbd>
        </button>

        {/* Quick create */}
        {createLinks.length > 0 && (
        <div className="relative">
          <button
            ref={newTriggerRef}
            type="button"
            onClick={() => setNewOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={newOpen}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
          {newOpen && (
            <div
              ref={newMenuRef}
              role="menu"
              aria-label="Create new"
              className="absolute right-0 top-11 z-40 w-44 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
            >
              {createLinks.map((l) => (
                <button
                  key={l.to}
                  type="button"
                  role="menuitem"
                  onClick={() => { setNewOpen(false); navigate(l.to); }}
                  className={cn('flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none')}
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}
      </header>

      {/* Mobile action bar — keeps search + create reachable below lg, where the
          desktop header is hidden. Sits under the Sidebar's mobile logo bar. */}
      <div className="lg:hidden sticky top-14 z-20 flex items-center gap-2 border-b border-border/70 bg-background/80 px-4 py-2 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground"
          aria-label="Search"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
        </button>
        {createLinks.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(createLinks[0].to)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
        )}
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </>
  );
}
