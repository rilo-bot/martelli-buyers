import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, Home, Star, Mail, ShieldCheck, UserCheck,
  Settings, Search, CornerDownLeft, Plus,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CommandItem {
  label: string;
  to: string;
  icon: React.ElementType;
  group: 'Go to' | 'Create';
  keywords?: string;
}

const ITEMS: CommandItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, group: 'Go to' },
  { label: 'Leads', to: '/leads', icon: Users, group: 'Go to' },
  { label: 'Clients', to: '/clients', icon: UserCheck, group: 'Go to' },
  { label: 'Buyer Journeys', to: '/journeys', icon: FileText, group: 'Go to', keywords: 'deals campaigns journeys' },
  { label: 'Properties', to: '/properties', icon: Home, group: 'Go to' },
  { label: 'Agents', to: '/agents', icon: Star, group: 'Go to' },
  { label: 'Emails', to: '/emails', icon: Mail, group: 'Go to', keywords: 'templates campaigns' },
  { label: 'Due Diligence', to: '/due-diligence', icon: ShieldCheck, group: 'Go to', keywords: 'dd' },
  { label: 'Settings', to: '/settings', icon: Settings, group: 'Go to' },
  { label: 'New lead', to: '/leads?new=1', icon: Plus, group: 'Create' },
  { label: 'New buyer journey', to: '/journeys?new=1', icon: Plus, group: 'Create', keywords: 'deal campaign' },
  { label: 'New client', to: '/clients?new=1', icon: Plus, group: 'Create' },
  { label: 'New agent', to: '/agents?new=1', icon: Plus, group: 'Create' },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter((i) => (i.label + ' ' + (i.keywords ?? '')).toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Focus the input once the dialog has mounted.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  const select = (item: CommandItem) => {
    onOpenChange(false);
    navigate(item.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) select(results[active]); }
  };

  let lastGroup = '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0 top-[20%] translate-y-0">
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search or jump to…"
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[320px] overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No results.</p>
          ) : (
            results.map((item, idx) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={item.to}>
                  {showGroup && (
                    <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.group}</p>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => select(item)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors',
                      idx === active ? 'bg-primary/8 text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0', idx === active ? 'text-primary' : '')} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {idx === active && <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
