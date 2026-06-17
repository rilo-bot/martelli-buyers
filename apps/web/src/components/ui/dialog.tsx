import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Lightweight Dialog matching shadcn/ui's public API surface, implemented
// without Radix (no new dependency) so the template stays small.
//
// Exported names kept IDENTICAL to shadcn/ui so generated code that follows
// standard shadcn patterns "just works":
//   Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter,
//   DialogTitle, DialogDescription, DialogClose
// ---------------------------------------------------------------------------

interface DialogContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  titleId: string
  descId: string
  registerTitle: (present: boolean) => void
  registerDesc: (present: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

let dialogIdCounter = 0
function useDialogIds() {
  // useId is available in React 18 — gives SSR-stable ids; fall back defensively.
  const reactId = React.useId?.()
  const base = reactId ?? React.useMemo(() => `dlg-${++dialogIdCounter}`, [])
  return { titleId: `${base}-title`, descId: `${base}-desc` }
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function useDialogContext(): DialogContextValue {
  const ctx = React.useContext(DialogContext)
  if (!ctx) {
    throw new Error("Dialog subcomponents must be used inside <Dialog>")
  }
  return ctx
}

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  children: React.ReactNode
}

export function Dialog({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
}: DialogProps) {
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
  const { titleId, descId } = useDialogIds()
  const [hasTitle, setHasTitle] = React.useState(false)
  const [hasDesc, setHasDesc] = React.useState(false)
  const value = React.useMemo<DialogContextValue>(
    () => ({
      open,
      setOpen,
      titleId: hasTitle ? titleId : "",
      descId: hasDesc ? descId : "",
      registerTitle: setHasTitle,
      registerDesc: setHasDesc,
    }),
    [open, setOpen, hasTitle, hasDesc, titleId, descId]
  )
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ asChild, onClick, children, ...props }, ref) => {
    const { setOpen } = useDialogContext()
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
DialogTrigger.displayName = "DialogTrigger"

export function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { showClose?: boolean }) {
  const { open, setOpen, titleId, descId } = useDialogContext()
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return

    // Remember what was focused so we can restore it on close.
    const previouslyFocused = document.activeElement as HTMLElement | null

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        return
      }
      // Trap Tab within the dialog.
      if (e.key === "Tab" && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null || el === document.activeElement)
        if (focusable.length === 0) {
          e.preventDefault()
          panelRef.current.focus()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const activeEl = document.activeElement as HTMLElement
        if (e.shiftKey && activeEl === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && activeEl === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener("keydown", handler)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    // Move focus into the dialog (first focusable, else the panel itself).
    const id = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(focusable ?? panelRef.current)?.focus()
    }, 0)

    return () => {
      window.clearTimeout(id)
      document.removeEventListener("keydown", handler)
      document.body.style.overflow = previousOverflow
      // Restore focus to the trigger if it's still in the document.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [open, setOpen])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId || undefined}
        aria-describedby={descId || undefined}
        tabIndex={-1}
        className={cn(
          "relative z-50 w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg focus:outline-none",
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
      {...props}
    />
  )
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2",
        className
      )}
      {...props}
    />
  )
}

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const { titleId, registerTitle } = useDialogContext()
  React.useEffect(() => {
    registerTitle(true)
    return () => registerTitle(false)
  }, [registerTitle])
  return (
    <h2
      ref={ref}
      id={titleId || undefined}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
})
DialogTitle.displayName = "DialogTitle"

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { descId, registerDesc } = useDialogContext()
  React.useEffect(() => {
    registerDesc(true)
    return () => registerDesc(false)
  }, [registerDesc])
  return (
    <p
      ref={ref}
      id={descId || undefined}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})
DialogDescription.displayName = "DialogDescription"

interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export const DialogClose = React.forwardRef<HTMLButtonElement, DialogCloseProps>(
  ({ asChild, onClick, children, ...props }, ref) => {
    const { setOpen } = useDialogContext()
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
DialogClose.displayName = "DialogClose"
