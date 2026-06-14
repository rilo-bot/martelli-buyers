import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

interface AvatarImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
}

interface AvatarFallbackProps {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Avatar({ className, children, style }: AvatarProps) {
  return (
    <div
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

/**
 * Renders the photo over the fallback (Avatar is `relative overflow-hidden`).
 * Returns null when there's no src or the image fails to load, so the sibling
 * AvatarFallback (initials) shows through.
 */
export function AvatarImage({ src, alt, className }: AvatarImageProps) {
  const [failed, setFailed] = useState(false);
  // A new src is a fresh attempt — clear any prior load failure.
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={alt ?? ''}
      onError={() => setFailed(true)}
      className={cn('absolute inset-0 h-full w-full object-cover', className)}
    />
  );
}

export function AvatarFallback({ className, children, style }: AvatarFallbackProps) {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium',
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}
