import { Link } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { FunnelStage } from './dashboardData';

const money = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);

export function PipelineFunnel({ stages }: { stages: FunnelStage[] }) {
  const total = stages.reduce((s, st) => s + st.count, 0);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/50 px-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 bg-primary/10">
            <Filter className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-[14px] font-bold">Pipeline Funnel</CardTitle>
            <p className="text-[11px] text-muted-foreground">Active campaigns by stage · value-weighted</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 py-4">
        {total === 0 ? (
          <EmptyState compact icon={Filter} title="No active campaigns" description="Convert a qualified lead to populate the pipeline." />
        ) : (
          <div className="space-y-2.5">
            {stages.map((st, i) => {
              // Funnel depth → progressively lighter blue.
              const opacity = 1 - i * 0.11;
              return (
                <Link key={st.stage} to="/deals" className="group block">
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-medium text-foreground transition-colors group-hover:text-primary">{st.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      <span className="font-bold text-foreground">{st.count}</span>
                      {st.value > 0 && <span className="ml-1.5">· {money(st.value)}</span>}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(st.count > 0 ? 6 : 0, st.pct)}%`, background: `hsl(var(--primary) / ${opacity.toFixed(2)})` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
