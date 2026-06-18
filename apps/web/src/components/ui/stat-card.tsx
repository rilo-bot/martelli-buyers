import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Minus, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkline } from '@/components/ui/sparkline';
import { CountUp } from '@/components/motion';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: number;
  /** Formats the value (e.g. add $ / %). Defaults to a localized integer. */
  format?: (n: number) => string;
  /** Optional leading icon shown in a tinted tile. */
  icon?: LucideIcon;
  /** Optional sparkline series, rendered top-right (implies icon layout). */
  spark?: number[];
  /** Optional period-over-period delta; drives the trend arrow + colour. */
  delta?: number;
  deltaLabel?: string;
  /** Makes the whole card a link. */
  to?: string;
  /** Tints the value text + icon tile with a semantic accent. */
  accent?: 'primary' | 'success' | 'warning' | 'info' | 'teal';
  /** 'lg' bumps the value to text-3xl (dashboard KPIs); 'default' is text-2xl. */
  size?: 'default' | 'lg';
  className?: string;
}

const ACCENT_TEXT: Record<NonNullable<StatCardProps['accent']>, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  teal: 'text-teal',
};

/** Solid brand-colour icon chip — confident, premium, brand-forward. */
const ACCENT_TILE: Record<NonNullable<StatCardProps['accent']>, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  teal: 'bg-teal',
};

/**
 * Single source of truth for the "summary number" tile used on the dashboard,
 * Clients, Properties and other list pages. Optional icon / sparkline / trend /
 * link / accent props cover every existing variant without per-page reinvention.
 */
export function StatCard({
  label,
  value,
  format,
  icon: Icon,
  spark,
  delta,
  deltaLabel,
  to,
  accent,
  size = 'default',
  className,
}: StatCardProps) {
  const hasTrend = typeof delta === 'number';
  const TrendIcon = !hasTrend ? Minus : delta! > 0 ? ArrowUpRight : delta! < 0 ? ArrowDownRight : Minus;
  const trendClass =
    !hasTrend || delta === 0
      ? 'text-muted-foreground'
      : delta! > 0
      ? 'text-success'
      : 'text-destructive';
  const valueClass = cn('tabular-nums', accent ? ACCENT_TEXT[accent] : 'text-foreground');

  const tileClass = accent ? ACCENT_TILE[accent] : 'bg-primary';
  const inner = (
    <Card
      className={cn(
        'kpi-card h-full bg-card',
        to && 'group transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]',
        className,
      )}
    >
      <CardContent className={cn('px-5', size === 'lg' ? 'py-5' : 'py-4')}>
        {(Icon || spark) && (
          <div className="mb-3.5 flex items-center justify-between">
            {Icon ? (
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm ring-1 ring-inset ring-white/20', tileClass)}>
                <Icon className="h-[19px] w-[19px]" />
              </div>
            ) : (
              <span />
            )}
            {spark && spark.length > 0 && (
              <Sparkline data={spark} className="opacity-90 transition-opacity group-hover:opacity-100" />
            )}
          </div>
        )}
        <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <CountUp value={value} format={format} className={cn('block font-bold tracking-[-0.01em]', size === 'lg' ? 'text-[1.9rem]' : 'text-[1.55rem]', valueClass)} />
        {(hasTrend || deltaLabel) && (
          <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium', trendClass)}>
            <TrendIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{deltaLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}
