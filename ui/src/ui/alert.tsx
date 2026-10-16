"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from "motion/react"

import { AlertCircleIcon, CheckCircleIcon, InfoIcon, WarningIcon, XIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { IconChip } from "@/ui/icon-chip"
import { useLocale } from "@/ui/locale-provider"

// The surface is an opaque card; the tone is a wash painted underneath the content
// (a ::before layer) so it never changes the text contrast tokens.
const alertVariants = cva(
  "relative isolate flex w-full items-start overflow-hidden bg-card text-card-foreground shadow-raised before:pointer-events-none before:absolute before:inset-0 before:-z-10",
  {
    variants: {
      variant: {
        default: "before:bg-transparent",
        info: "before:bg-primary-subtle",
        success: "before:bg-success-subtle",
        warning: "before:bg-warning-subtle",
        destructive: "before:bg-destructive-subtle",
      },
      size: {
        sm: "gap-2.5 rounded-xl p-2.5 text-ui",
        default: "gap-3 rounded-2xl p-3.5 text-ui",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>
type AlertSize = NonNullable<VariantProps<typeof alertVariants>["size"]>

type AlertContextValue = {
  open: boolean
  variant: AlertVariant
  size: AlertSize
  setOpen: (open: boolean) => void
  dismiss: () => void
}

const AlertContext = React.createContext<AlertContextValue | null>(null)

function useAlert() {
  const ctx = React.useContext(AlertContext)
  if (!ctx) throw new Error("useAlert must be used within <Alert>")
  return ctx
}

const chipTone = {
  default: "neutral",
  info: "primary",
  success: "success",
  warning: "warning",
  destructive: "destructive",
} as const satisfies Record<AlertVariant, string>

const defaultIcon: Record<AlertVariant, React.ComponentType<{ className?: string }>> = {
  default: InfoIcon,
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningIcon,
  destructive: AlertCircleIcon,
}

const EASE = [0.22, 1, 0.36, 1] as const

type AlertProps = Omit<
  HTMLMotionProps<"div">,
  "initial" | "animate" | "exit" | "transition" | "role" | "children"
> & {
  variant?: AlertVariant
  /** `sm` tightens the padding and uses the small icon chip, for alerts inside cards and forms. */
  size?: AlertSize
  /** Controlled visibility. Hiding animates the alert out (height collapses, surface fades). */
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Defaults to "alert" for warning/destructive and "status" otherwise. */
  role?: "alert" | "status"
  /** Classes for the inner surface row (the outer element only animates height). */
  contentClassName?: string
  children?: React.ReactNode
}

/**
 * Inline message surface. Compose with AlertIcon, AlertTitle, AlertDescription,
 * AlertAction and AlertClose. Appears and dismisses with a soft height + scale animation.
 */
function Alert({
  variant = "default",
  size = "default",
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  role,
  className,
  contentClassName,
  children,
  ...props
}: AlertProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : uncontrolled
  const reduce = useReducedMotion() ?? false

  const onOpenChangeRef = React.useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolled(next)
      onOpenChangeRef.current?.(next)
    },
    [controlled]
  )
  const dismiss = React.useCallback(() => setOpen(false), [setOpen])
  const ctx = React.useMemo(() => ({ open, variant, size, setOpen, dismiss }), [open, variant, size, setOpen, dismiss])

  const resolvedRole = role ?? (variant === "warning" || variant === "destructive" ? "alert" : "status")

  return (
    <AlertContext.Provider value={ctx}>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            data-slot="alert"
            data-variant={variant}
            data-size={size}
            role={resolvedRole}
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.96, filter: "blur(2px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto", scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.96, filter: "blur(2px)" }}
            transition={
              reduce
                ? { duration: 0.12 }
                : {
                    height: { type: "spring", stiffness: 420, damping: 38, mass: 0.6 },
                    scale: { type: "spring", stiffness: 480, damping: 30, mass: 0.6 },
                    opacity: { duration: 0.18, ease: EASE },
                    filter: { duration: 0.2, ease: EASE },
                  }
            }
            className={cn("-mx-1 origin-top overflow-hidden", className)}
            {...props}
          >
            {/* padding lives inside (room for the raised shadow) so height collapses to a true 0 */}
            <div className="px-1 pt-px pb-1">
              <div
                data-slot="alert-surface"
                className={cn(alertVariants({ variant, size }), contentClassName)}
              >
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AlertContext.Provider>
  )
}

/** Icon chip. Renders the variant's default icon unless children are given. */
function AlertIcon({ className, children, ...props }: React.ComponentProps<"span">) {
  const { variant, size } = useAlert()
  const Icon = defaultIcon[variant]
  return (
    <IconChip data-slot="alert-icon" tone={chipTone[variant]} size={size === "sm" ? "sm" : "default"} className={className} {...props}>
      {children ?? <Icon />}
    </IconChip>
  )
}

/** Wraps title + description so they stack beside the icon. */
function AlertContent({ className, ...props }: React.ComponentProps<"div">) {
  const { size } = useAlert()
  return (
    <div
      data-slot="alert-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-0.5", size === "sm" ? "pt-0.5" : "pt-1", className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("leading-5 font-medium", className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-ui-sm leading-5 text-muted-foreground [&_a]:underline [&_a]:underline-offset-3", className)}
      {...props}
    />
  )
}

/** Right-aligned slot for buttons (e.g. "Undo", "Review"). */
function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="alert-action" className={cn("ml-auto flex shrink-0 items-center gap-1.5 self-center", className)} {...props} />
  )
}

/** Dismiss button; closes the parent Alert with its exit animation. */
function AlertClose({ className, onClick, children, ...props }: React.ComponentProps<"button">) {
  const { labels } = useLocale()
  const { dismiss, size } = useAlert()
  return (
    <button
      type="button"
      data-slot="alert-close"
      aria-label={labels.dismiss}
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) dismiss()
      }}
      className={cn(
        size === "sm" ? "-mr-0.5 size-6" : "-mt-0.5 -mr-1 size-7",
        "flex shrink-0 cursor-pointer items-center justify-center self-start rounded-full text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-3.5",
        className
      )}
      {...props}
    >
      {children ?? <XIcon />}
    </button>
  )
}

export { Alert, AlertIcon, AlertContent, AlertTitle, AlertDescription, AlertAction, AlertClose, useAlert, alertVariants }
export type { AlertVariant, AlertSize, AlertProps }
