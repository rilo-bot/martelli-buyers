import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Search, Plus, ChevronRight } from 'lucide-react';
import { CommandPalette } from '@/components/CommandPalette';
import { StatusPill } from '@/components/ui/status-pill';
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
  settings: 'Settings',
};

const CREATE_LINKS = [
  { label: 'New lead', to: '/leads?new=1' },
  { label: 'New buyer journey', to: '/journeys?new=1' },
  { label: 'New client', to: '/clients?new=1' },
  { label: 'New agent', to: '/agents?new=1' },
];

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const newRef = useRef<HTMLDivElement>(null);

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

  // Close the "New" menu on outside click.
  useEffect(() => {
    if (!newOpen) return;
    const onClick = (e: MouseEvent) => {
      if (newRef.current && !newRef.current.contains(e.target as Node)) setNewOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [newOpen]);

  const segments = location.pathname.split('/').filter(Boolean);
  const section = segments[0] ?? 'dashboard';
  const sectionTitle = SECTION_TITLES[section] ?? section.charAt(0).toUpperCase() + section.slice(1);
  const isDetail = segments.length > 1;
  const sectionPath = `/${section}`;

  return (
    <>
      <header
        className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-border px-6 lg:flex"
        style={{ background: 'hsl(var(--sidebar-bg))' }}
      >
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          {isDetail ? (
            <>
              <Link to={sectionPath} className="text-muted-foreground hover:text-foreground transition-colors">{sectionTitle}</Link>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              <span className="font-medium text-foreground truncate">Detail</span>
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
          className="flex h-9 w-64 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium">⌘K</kbd>
        </button>

        {/* Quick create */}
        <div className="relative" ref={newRef}>
          <button
            type="button"
            onClick={() => setNewOpen((o) => !o)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
          {newOpen && (
            <div className="absolute right-0 top-11 z-40 w-44 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg">
              {CREATE_LINKS.map((l) => (
                <button
                  key={l.to}
                  type="button"
                  onClick={() => { setNewOpen(false); navigate(l.to); }}
                  className={cn('flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted')}
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </>
  );
}
