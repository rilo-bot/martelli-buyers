import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Centered empty state matching the design reference: a soft filled
 * rounded-square icon tile, a bold heading, a muted one-line helper, and
 * an optional call-to-action. Use `compact` inside cards/panels.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-12' : 'py-20',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl bg-primary/10 text-primary',
          compact ? 'h-12 w-12' : 'h-16 w-16',
        )}
      >
        <Icon className={compact ? 'h-6 w-6' : 'h-8 w-8'} strokeWidth={1.75} />
      </div>
      <h3 className={cn('font-semibold text-foreground', compact ? 'mt-4 text-base' : 'mt-5 text-lg')}>
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
