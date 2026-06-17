import { cn } from '@/lib/utils';

type Tone = 'live' | 'success' | 'warning' | 'info' | 'muted';

const TONES: Record<Tone, { dot: string; text: string; ring: string }> = {
  live: { dot: 'bg-success', text: 'text-success', ring: 'border-success/25 bg-success/5' },
  success: { dot: 'bg-success', text: 'text-success', ring: 'border-success/25 bg-success/5' },
  warning: { dot: 'bg-warning', text: 'text-warning', ring: 'border-warning/30 bg-warning/5' },
  info: { dot: 'bg-info', text: 'text-info', ring: 'border-info/25 bg-info/5' },
  muted: { dot: 'bg-muted-foreground/50', text: 'text-muted-foreground', ring: 'border-border bg-muted/40' },
};

/**
 * Small status indicator pill (e.g. the "Live" badge in the reference).
 * A pulsing dot + label inside a soft tinted capsule.
 */
export function StatusPill({
  children,
  tone = 'live',
  pulse,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  /** Animate the dot. Defaults on for the "live" tone. */
  pulse?: boolean;
  className?: string;
}) {
  const t = TONES[tone];
  const shouldPulse = pulse ?? tone === 'live';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        t.ring,
        t.text,
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {shouldPulse && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden', t.dot)} />
        )}
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', t.dot)} />
      </span>
      {children}
    </span>
  );
}
