import { useId } from 'react';

/**
 * Tiny dependency-free SVG sparkline. Renders a smooth-ish area + line for a
 * small series of numbers. Colour defaults to the brand primary.
 */
export function Sparkline({
  data,
  width = 72,
  height = 24,
  strokeWidth = 1.5,
  className,
  color = 'hsl(var(--primary))',
}: {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
}) {
  const id = useId();
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const pad = strokeWidth;
  const h = height - pad * 2;

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = pad + h - ((v - min) / range) * h;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`sl-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sl-${id})`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
