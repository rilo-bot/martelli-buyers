import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkline } from '@/components/ui/sparkline';
import { Stagger, StaggerItem, CountUp } from '@/components/motion';
import { cn } from '@/lib/utils';
import type { KpiDatum } from './dashboardData';

export function KpiCards({ kpis }: { kpis: KpiDatum[] }) {
  return (
    <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4" step={0.06}>
      {kpis.map((k) => {
        const TrendIcon = k.delta > 0 ? ArrowUpRight : k.delta < 0 ? ArrowDownRight : Minus;
        const trendClass = k.delta > 0 ? 'text-success' : k.delta < 0 ? 'text-destructive' : 'text-muted-foreground';
        return (
          <StaggerItem key={k.key}>
            <Link to={k.to} className="block h-full">
              <Card className="kpi-card group h-full border-border/70 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <CardContent className="px-5 py-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
                      <k.icon className="h-[18px] w-[18px] text-primary" />
                    </div>
                    <Sparkline data={k.spark} className="opacity-80 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{k.label}</p>
                  <span className="text-3xl font-bold tabular-nums text-foreground">
                    <CountUp value={k.value} format={k.format} />
                  </span>
                  <div className={cn('mt-1.5 flex items-center gap-1 text-[11px] font-medium', trendClass)}>
                    <TrendIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{k.deltaLabel}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
