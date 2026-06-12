import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Stagger, StaggerItem } from '@/components/motion';
import type { AttentionItem } from './dashboardData';

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">You're all caught up</p>
          <p className="text-xs text-muted-foreground">No follow-ups, stalled campaigns, or overdue invoices right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Needs attention</p>
      <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" step={0.05}>
        {items.map((item) => (
          <StaggerItem key={item.key}>
            <Link
              to={item.to}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                <item.icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold tabular-nums leading-none text-foreground">{item.count}</span>
                  <span className="truncate text-[12px] font-medium leading-tight text-foreground">{item.label}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.sub}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
