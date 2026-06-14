import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Right-side drawer ("Sheet"), used for create/edit forms across the CRM.
//
// Mirrors the public API of ./dialog.tsx (same context model, controlled/
// uncontrolled `open`, ESC + overlay close, body scroll-lock) so converting a
// form is a near-mechanical Dialog* -> Sheet* rename. The one addition is
// <SheetBody>: the scrollable region between a sticky header and sticky footer,
// which replaces the per-dialog `max-h-[85vh] overflow-y-auto` hack.
//
//   Sheet, SheetTrigger, SheetContent, SheetHeader, SheetBody, SheetFooter,
//   SheetTitle, SheetDescription, SheetClose
// ---------------------------------------------------------------------------

interface SheetContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const SheetContext = React.createContext<SheetContextValue | null>(null)

function useSheetContext(): SheetContextValue {
  const ctx = React.useContext(SheetContext)
  if (!ctx) {
    throw new Error("Sheet subcomponents must be used inside <Sheet>")
  }
  return ctx
}

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  children: React.ReactNode
}

export function Sheet({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
}: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange]
  )
  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  )
}

interface SheetTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetTriggerProps>(
  ({ asChild, onClick, children, ...props }, ref) => {
    const { setOpen } = useSheetContext()
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      if (!e.defaultPrevented) setOpen(true)
    }
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{
        onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
      }>
      return React.cloneElement(child, {
        ...(props as object),
        ref,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          child.props.onClick?.(e)
          if (!e.defaultPrevented) setOpen(true)
        },
      } as React.HTMLAttributes<HTMLButtonElement>)
    }
    return (
      <button ref={ref} type="button" onClick={handleClick} {...props}>
        {children}
      </button>
    )
  }
)
SheetTrigger.displayName = "SheetTrigger"

type SheetSize = "sm" | "md" | "lg" | "xl"

// Mobile is full-width; the cap kicks in at the `sm` breakpoint upward.
const SIZE_CLASS: Record<SheetSize, string> = {
  sm: "sm:max-w-sm",   // ~24rem
  md: "sm:max-w-md",   // ~28rem
  lg: "sm:max-w-lg",   // ~32rem
  xl: "sm:max-w-2xl",  // ~42rem
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SheetSize
}

export function SheetContent({
  className,
  children,
  size = "md",
  ...props
}: SheetContentProps) {
  const { open, setOpen } = useSheetContext()
  // Drives the slide-in: mount hidden (translate-x-full), then flip on the next
  // frame so the transition runs. Kept internal so callers don't manage it.
  const [shown, setShown] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setShown(false)
      return
    }
    const raf = requestAnimationFrame(() => setShown(true))
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handler)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener("keydown", handler)
      document.body.style.overflow = previousOverflow
    }
  }, [open, setOpen])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={cn(
          "fixed inset-0 bg-background/50 transition-opacity duration-200"
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l border-border bg-background shadow-xl",
          "transition-transform duration-200 ease-out will-change-transform",
          SIZE_CLASS[size],
          shown ? "translate-x-0" : "translate-x-full",
          className
        )}
        {...props}
      >
        {children}
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col space-y-1.5 border-b border-border px-6 py-4 pr-12 text-left",
        className
      )}
      {...props}
    />
  )
}

export function SheetBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)} {...props} />
  )
}

export function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end sm:space-x-2 sm:space-x-reverse",
        className
      )}
      {...props}
    />
  )
}

export const SheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
SheetTitle.displayName = "SheetTitle"

export const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
SheetDescription.displayName = "SheetDescription"

interface SheetCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export const SheetClose = React.forwardRef<HTMLButtonElement, SheetCloseProps>(
  ({ asChild, onClick, children, ...props }, ref) => {
    const { setOpen } = useSheetContext()
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      if (!e.defaultPrevented) setOpen(false)
    }
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{
        onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
      }>
      return React.cloneElement(child, {
        ...(props as object),
        ref,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          child.props.onClick?.(e)
          if (!e.defaultPrevented) setOpen(false)
        },
      } as React.HTMLAttributes<HTMLButtonElement>)
    }
    return (
      <button ref={ref} type="button" onClick={handleClick} {...props}>
        {children}
      </button>
    )
  }
)
SheetClose.displayName = "SheetClose"
