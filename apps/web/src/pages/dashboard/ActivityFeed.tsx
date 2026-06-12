import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { ActivityItem } from './dashboardData';

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(ts).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/50 px-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 bg-primary/10">
            <Activity className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-[14px] font-bold">Activity</CardTitle>
            <p className="text-[11px] text-muted-foreground">Recent movement across your CRM</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <EmptyState compact icon={Activity} title="No activity yet" description="Actions across leads, campaigns, and invoices will show up here." />
        ) : (
          <ol className="relative px-5 py-3">
            {/* timeline rail */}
            <span className="absolute left-[34px] top-5 bottom-5 w-px bg-border" aria-hidden="true" />
            {items.map((item, i) => (
              <li key={item.id} className={cn('relative flex items-start gap-3', i < items.length - 1 && 'pb-4')}>
                <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
                  <item.icon className="h-3.5 w-3.5" />
                </span>
                <Link to={item.to} className="group min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-[12.5px] font-medium leading-tight text-foreground transition-colors group-hover:text-primary">{item.text}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{item.sub} · {relTime(item.ts)}</p>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
