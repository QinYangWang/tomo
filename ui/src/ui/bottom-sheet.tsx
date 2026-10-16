"use client";

import * as React from "react"
import { useDirection } from "@base-ui/react/direction-provider"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import {
  animate,
  AnimatePresence,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type DragControls,
  type PanInfo,
  type Transition,
} from "motion/react"

import { cn } from "@/lib/utils"

const SETTLE: Transition = { type: "spring", stiffness: 380, damping: 38, mass: 0.9 }
const FADE: Transition = { duration: 0.2, ease: [0.22, 1, 0.36, 1] }

type SheetContextValue = {
  open: boolean
  /** Closes through the dialog primitive, so `onOpenChange` gets real event details. */
  close: () => void
  snapPoints: number[]
  snap: number
  setSnap: (index: number) => void
  defaultSnap: number
  dismissible: boolean
  dragControls: DragControls
}

const SheetContext = React.createContext<SheetContextValue | null>(null)

function useSheet() {
  const ctx = React.useContext(SheetContext)
  if (!ctx) throw new Error("BottomSheet parts must be used inside <BottomSheet>")
  return ctx
}

function useViewportHeight() {
  const [h, setH] = React.useState(() => (typeof window === "undefined" ? 800 : window.innerHeight))
  React.useEffect(() => {
    const update = () => setH(window.innerHeight)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])
  return h
}

type BottomSheetProps = Omit<DialogPrimitive.Root.Props, "open" | "defaultOpen" | "onOpenChange" | "children"> & {
  open?: boolean
  defaultOpen?: boolean
  /** Same signature as Drawer: a drag-down dismissal arrives with reason `"imperative-action"`. */
  onOpenChange?: (open: boolean, details: DialogPrimitive.Root.ChangeEventDetails) => void
  /** Visible heights as fractions of the viewport, smallest first. */
  snapPoints?: number[]
  /** Index into `snapPoints` the sheet opens at. */
  defaultSnap?: number
  /** Controlled snap index. */
  snap?: number
  onSnapChange?: (index: number) => void
  /** Allow drag-down, Esc and backdrop press to close. */
  dismissible?: boolean
  children?: React.ReactNode
}

function BottomSheet({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  snapPoints = [0.5, 0.92],
  defaultSnap = 0,
  snap: snapProp,
  onSnapChange,
  dismissible = true,
  children,
  actionsRef: actionsRefProp,
  ...props
}: BottomSheetProps) {
  const [openState, setOpenState] = React.useState(defaultOpen)
  const open = openProp ?? openState
  const [snapState, setSnapState] = React.useState(defaultSnap)
  const snap = snapProp ?? snapState
  const dragControls = useDragControls()

  const ownActionsRef = React.useRef<DialogPrimitive.Root.Actions | null>(null)
  const actionsRef = actionsRefProp ?? ownActionsRef
  const close = React.useCallback(() => actionsRef.current?.close(), [actionsRef])
  const setSnap = React.useCallback(
    (index: number) => {
      if (snapProp === undefined) setSnapState(index)
      onSnapChange?.(index)
    },
    [snapProp, onSnapChange]
  )

  // Every open starts at the default snap.
  const wasOpen = React.useRef(open)
  React.useEffect(() => {
    if (open && !wasOpen.current && snapProp === undefined) setSnapState(defaultSnap)
    wasOpen.current = open
  }, [open, defaultSnap, snapProp])

  const sorted = React.useMemo(() => [...snapPoints].sort((a, b) => a - b), [snapPoints])

  const value = React.useMemo(
    () => ({ open, close, snapPoints: sorted, snap, setSnap, defaultSnap, dismissible, dragControls }),
    [open, close, sorted, snap, setSnap, defaultSnap, dismissible, dragControls]
  )

  return (
    <SheetContext.Provider value={value}>
      <DialogPrimitive.Root
        open={open}
        actionsRef={actionsRef}
        onOpenChange={(next, details) => {
          if (!next && !dismissible && details.reason !== "close-press") {
            details.cancel()
            return
          }
          if (openProp === undefined) setOpenState(next)
          onOpenChange?.(next, details)
        }}
        {...props}
      >
        {children}
      </DialogPrimitive.Root>
    </SheetContext.Provider>
  )
}

const BottomSheetTrigger = DialogPrimitive.Trigger
const BottomSheetClose = DialogPrimitive.Close

function BottomSheetContent({
  className,
  children,
  showHandle = true,
  ...props
}: Omit<DialogPrimitive.Popup.Props, "render"> & { showHandle?: boolean }) {
  const { open } = useSheet()
  // Portaled popups leave the DOM subtree that sets `dir`; carry the provider direction over.
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal keepMounted dir={dir}>
          <SheetSurface className={className} showHandle={showHandle} {...props}>
            {children}
          </SheetSurface>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  )
}

function SheetSurface({
  className,
  children,
  showHandle,
  ...props
}: Omit<DialogPrimitive.Popup.Props, "render"> & { showHandle: boolean }) {
  const { close, snapPoints, snap, setSnap, dismissible, dragControls } = useSheet()
  const reduce = useReducedMotion()
  const vh = useViewportHeight()

  // The sheet is always as tall as its highest snap; lower snaps translate it down.
  const height = Math.round(snapPoints[snapPoints.length - 1] * vh)
  const offsetFor = React.useCallback(
    (i: number) => height - Math.round(snapPoints[Math.max(0, Math.min(i, snapPoints.length - 1))] * vh),
    [height, snapPoints, vh]
  )

  const y = useMotionValue(reduce ? offsetFor(snap) : height)
  const backdropOpacity = useTransform(y, [offsetFor(0), height], [1, 0], { clamp: true })

  // Glide to the current snap whenever it (or the viewport) changes.
  React.useEffect(() => {
    const controls = animate(y, offsetFor(snap), reduce ? { duration: 0 } : SETTLE)
    return () => controls.stop()
  }, [snap, offsetFor, reduce, y])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const current = y.get()
    // Project where a fling would land so a flick moves a whole snap.
    const projected = current + info.velocity.y * 0.18
    const lowest = offsetFor(0)
    if (dismissible && (projected > lowest + Math.min(140, (height - lowest) * 0.45) || info.velocity.y > 1100)) {
      close()
      return
    }
    let nearest = 0
    snapPoints.forEach((_, i) => {
      if (Math.abs(offsetFor(i) - projected) < Math.abs(offsetFor(nearest) - projected)) nearest = i
    })
    if (nearest === snap) animate(y, offsetFor(nearest), SETTLE)
    else setSnap(nearest)
  }

  return (
    <>
      <DialogPrimitive.Backdrop
        data-slot="bottom-sheet-backdrop"
        className="fixed inset-0 z-50 bg-black/30"
        render={
          reduce ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} />
          ) : (
            // Fades with the sheet's position, so dragging down lightens the scrim.
            <motion.div style={{ opacity: backdropOpacity }} />
          )
        }
      />
      <DialogPrimitive.Popup
        data-slot="bottom-sheet-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-xl flex-col rounded-t-[min(calc(var(--radius)*2.8),var(--radius-max))] bg-popover text-popover-foreground shadow-xl outline-none",
          // Extends below the viewport so an upward overdrag never shows a gap.
          "after:absolute after:inset-x-0 after:top-full after:h-[50vh] after:bg-popover",
          className
        )}
        render={
          <motion.div
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: offsetFor(snapPoints.length - 1), bottom: height }}
            dragElastic={{ top: 0.08, bottom: 0.6 }}
            dragMomentum={false}
            onDragEnd={onDragEnd}
            exit={reduce ? { opacity: 0, transition: FADE } : { y: height, transition: { ...SETTLE, stiffness: 460 } }}
            initial={reduce ? { opacity: 0 } : false}
            animate={reduce ? { opacity: 1 } : undefined}
            style={{ y, height }}
          />
        }
        {...props}
      >
        {showHandle && <BottomSheetHandle />}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </DialogPrimitive.Popup>
    </>
  )
}

/** Grip at the top of the sheet: drag to resize/dismiss, or press to cycle snap points. */
function BottomSheetHandle({ className, ...props }: React.ComponentProps<"button">) {
  const { snapPoints, snap, setSnap, dragControls } = useSheet()
  const multiple = snapPoints.length > 1
  return (
    <button
      type="button"
      data-slot="bottom-sheet-handle"
      aria-label={multiple ? (snap === snapPoints.length - 1 ? "Collapse sheet" : "Expand sheet") : "Drag to close"}
      onPointerDown={(e) => dragControls.start(e)}
      onClick={() => multiple && setSnap(snap === snapPoints.length - 1 ? 0 : snap + 1)}
      className={cn(
        "group/handle flex h-7 w-full shrink-0 cursor-grab touch-none items-center justify-center rounded-t-[min(calc(var(--radius)*2.8),var(--radius-max))] outline-none active:cursor-grabbing",
        className
      )}
      {...props}
    >
      <span className="h-1.5 w-10 rounded-full bg-muted shadow-well transition-[width,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/handle:w-12 group-focus-visible/handle:bg-primary/60 group-active/handle:w-14" />
    </button>
  )
}

/** Header doubles as a drag zone, so the sheet can be pulled from anywhere above the body. */
function BottomSheetHeader({ className, onPointerDown, ...props }: React.ComponentProps<"div">) {
  const { dragControls } = useSheet()
  return (
    <div
      data-slot="bottom-sheet-header"
      onPointerDown={(e) => {
        onPointerDown?.(e)
        if (!(e.target as HTMLElement).closest("button,a,input,textarea,select,[role=button]")) dragControls.start(e)
      }}
      className={cn("flex shrink-0 touch-none flex-col gap-1 px-6 pt-1 pb-4", className)}
      {...props}
    />
  )
}

function BottomSheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 text-ui", className)}
      {...props}
    />
  )
}

function BottomSheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-footer"
      className={cn("flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]", className)}
      {...props}
    />
  )
}

function BottomSheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="bottom-sheet-title"
      className={cn("text-lg leading-snug font-semibold", className)}
      {...props}
    />
  )
}

function BottomSheetDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="bottom-sheet-description"
      className={cn("text-ui leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetHandle,
  BottomSheetHeader,
  BottomSheetBody,
  BottomSheetFooter,
  BottomSheetTitle,
  BottomSheetDescription,
}
