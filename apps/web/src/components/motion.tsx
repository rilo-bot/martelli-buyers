import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useReducedMotion,
  useInView,
  type Variants,
  type HTMLMotionProps,
} from 'framer-motion';

// ---------------------------------------------------------------------------
// Subtle, professional motion primitives for the Martelli CRM.
// Everything here honours `prefers-reduced-motion` automatically: when the
// user has reduced motion on, transforms collapse to a plain fade (or nothing).
// ---------------------------------------------------------------------------

/** Standard easing — matches the CSS `--ease-smooth` token. */
const EASE = [0.25, 0.46, 0.45, 0.94] as const;

/**
 * Page-level entrance. Wrap a route's content; it fades + lifts in.
 * Keyed by the caller (usually route path) so it re-runs on navigation.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.26, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger container — children wrapped in <StaggerItem> animate in sequence.
 * Use for lists, KPI grids, card rows.
 */
export function Stagger({
  children,
  className,
  delay = 0,
  step = 0.05,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  step?: number;
}) {
  const reduce = useReducedMotion();
  const container: Variants = {
    hidden: {},
    show: {
      transition: reduce
        ? { staggerChildren: 0 }
        : { staggerChildren: step, delayChildren: delay },
    },
  };
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } },
};
const itemVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

/** A single staggered child. Forwards motion props so it stays flexible. */
export function StaggerItem({
  children,
  className,
  ...rest
}: { children: React.ReactNode; className?: string } & HTMLMotionProps<'div'>) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={reduce ? itemVariantsReduced : itemVariants} {...rest}>
      {children}
    </motion.div>
  );
}

/** Fade + lift a block into view as it scrolls into the viewport (once). */
export function FadeInView({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.4, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Count a number up from 0 to `value` on mount. Falls back to the final
 * value instantly under reduced motion. `format` lets callers add $/%, etc.
 */
export function CountUp({
  value,
  duration = 0.9,
  format = (n) => n.toLocaleString(),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const from = 0;
    const ms = duration * 1000;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / ms, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);

  return <span className={className}>{format(display)}</span>;
}

/** Re-export the configured easing for callers that need it inline. */
export { EASE };
