import { cn } from '@/lib/utils';

/**
 * Consistent page header used across every screen:
 *   ┌ title ─────────────────────────── [status] [actions] ┐
 *   └ subtitle                                              ┘
 *
 * `status` sits flush-right (e.g. a <StatusPill>); `actions` holds buttons.
 */
export function PageHeader({
  title,
  subtitle,
  status,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {status}
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
