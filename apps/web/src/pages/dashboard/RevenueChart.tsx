import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RevenuePoint } from './dashboardData';

const money = (n: number) => `$${n.toLocaleString()}`;

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-foreground">{money(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const totalCollected = data.reduce((s, d) => s + d.collected, 0);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/50 px-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 bg-primary/10">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-[14px] font-bold">Revenue</CardTitle>
              <p className="text-[11px] text-muted-foreground">Collected vs invoiced · last 6 months</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums text-foreground">{money(totalCollected)}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">collected</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 py-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 6, right: 12, left: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="rev-collected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} dy={6} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeOpacity: 0.2 }} />
            <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
            <Area type="monotone" dataKey="collected" name="Collected" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rev-collected)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
