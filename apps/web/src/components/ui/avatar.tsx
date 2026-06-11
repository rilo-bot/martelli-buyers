import { cn } from '@/lib/utils';

interface AvatarProps {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
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
