import * as React from "react"
import { useDirection } from "@base-ui/react/direction-provider"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react"

import { XIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

type DrawerSide = "left" | "right"

type DrawerContextValue = { open: boolean; side: DrawerSide }

const DrawerContext = React.createContext<DrawerContextValue | null>(null)

function useDrawer() {
  const ctx = React.useContext(DrawerContext)
  if (!ctx) throw new Error("Drawer parts must be used inside <Drawer>")
  return ctx
}

const SLIDE: Transition = { type: "spring", stiffness: 420, damping: 40, mass: 0.9 }
const FADE: Transition = { duration: 0.2, ease: [0.22, 1, 0.36, 1] }

type DrawerProps = Omit<DialogPrimitive.Root.Props, "open" | "defaultOpen" | "onOpenChange" | "children"> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean, details: DialogPrimitive.Root.ChangeEventDetails) => void
  /** Edge the panel slides in from. */
  side?: DrawerSide
  children?: React.ReactNode
}

function Drawer({ open: openProp, defaultOpen = false, onOpenChange, side = "right", children, ...props }: DrawerProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen)
  const open = openProp ?? uncontrolled
  const handleOpenChange = React.useCallback(
    (next: boolean, details: DialogPrimitive.Root.ChangeEventDetails) => {
      if (openProp === undefined) setUncontrolled(next)
      onOpenChange?.(next, details)
    },
    [openProp, onOpenChange]
  )
  const value = React.useMemo(() => ({ open, side }), [open, side])
  return (
    <DrawerContext.Provider value={value}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    </DrawerContext.Provider>
  )
}

const DrawerTrigger = DialogPrimitive.Trigger
const DrawerClose = DialogPrimitive.Close

function DrawerContent({
  className,
  children,
  showClose = true,
  ...props
}: Omit<DialogPrimitive.Popup.Props, "render"> & { showClose?: boolean }) {
  const { open, side } = useDrawer()
  const reduce = useReducedMotion()
  const offscreen = side === "right" ? "100%" : "-100%"

  // Portaled popups leave the DOM subtree that sets `dir`; carry the provider direction over.
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  return (
    <AnimatePresence>
      {open && (
        // keepMounted hands unmounting to AnimatePresence so the exit spring can play.
        <DialogPrimitive.Portal keepMounted dir={dir}>
          <DialogPrimitive.Backdrop
            data-slot="drawer-backdrop"
            className="fixed inset-0 z-50 bg-black/30"
            render={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} />}
          />
          <DialogPrimitive.Popup
            data-slot="drawer-content"
            data-side={side}
            className={cn(
              "fixed inset-y-2 z-50 flex w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-3xl bg-popover text-popover-foreground shadow-xl outline-none",
              "data-[side=left]:left-2 data-[side=right]:right-2",
              className
            )}
            render={
              <motion.div
                initial={reduce ? { opacity: 0 } : { x: offscreen }}
                animate={reduce ? { opacity: 1 } : { x: 0 }}
                exit={reduce ? { opacity: 0 } : { x: offscreen, transition: { type: "spring", stiffness: 520, damping: 50 } }}
                transition={reduce ? FADE : SLIDE}
              />
            }
            {...props}
          >
            {children}
            {showClose && (
              <DialogPrimitive.Close
                data-slot="drawer-close"
                aria-label="Close"
                className="absolute top-4 end-4 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <XIcon size={16} />
              </DialogPrimitive.Close>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="drawer-header" className={cn("flex flex-col gap-1.5 px-6 pt-6 pe-14 pb-4", className)} {...props} />
}

function DrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 text-ui", className)}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex items-center justify-end gap-2 border-t border-border px-6 py-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-lg leading-snug font-semibold", className)}
      {...props}
    />
  )
}

function DrawerDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-ui leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
export type { DrawerSide }
