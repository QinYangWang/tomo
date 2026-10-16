import * as React from "react"
import { useDirection } from "@base-ui/react/direction-provider"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"

/*
 * A dialog that interrupts for a decision. Unlike Dialog it has no close button and a
 * backdrop click does not dismiss it: the user answers with Cancel or the action.
 */
const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger

function AlertDialogContent({
  className,
  size = "default",
  initialFocus,
  ...props
}: AlertDialogPrimitive.Popup.Props & { size?: "sm" | "default" }) {
  const popupRef = React.useRef<HTMLDivElement>(null)
  // Cancel takes initial focus, so Enter never confirms by accident.
  const focusCancel = React.useCallback(
    () => popupRef.current?.querySelector<HTMLElement>("[data-alert-dialog-cancel]") ?? true,
    []
  )
  // Portaled popups leave the DOM subtree that sets `dir`; carry the provider direction over.
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  return (
    <AlertDialogPrimitive.Portal dir={dir}>
      <AlertDialogPrimitive.Backdrop
        data-slot="alert-dialog-backdrop"
        className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0"
      />
      <AlertDialogPrimitive.Viewport data-slot="alert-dialog-viewport" className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <AlertDialogPrimitive.Popup
          ref={popupRef}
          data-slot="alert-dialog-content"
          data-size={size}
          initialFocus={initialFocus ?? focusCancel}
          className={cn(
            "group/alert-dialog relative flex max-h-full w-full flex-col gap-3 overflow-y-auto overscroll-contain rounded-3xl bg-popover p-5 text-popover-foreground shadow-xl outline-none",
            "transition-[opacity,scale,translate] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:scale-98 data-starting-style:opacity-0",
            "motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100",
            size === "sm" ? "max-w-xs" : "max-w-md",
            className
          )}
          {...props}
        />
      </AlertDialogPrimitive.Viewport>
    </AlertDialogPrimitive.Portal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-1 group-data-[size=sm]/alert-dialog:items-center group-data-[size=sm]/alert-dialog:text-center", className)}
      {...props}
    />
  )
}

/** An IconChip or icon above the title. */
function AlertDialogMedia({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-media" className={cn("mb-2 flex", className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end group-data-[size=sm]/alert-dialog:grid group-data-[size=sm]/alert-dialog:grid-cols-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg leading-tight font-semibold text-balance", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({ className, ...props }: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-ui leading-snug text-pretty text-muted-foreground", className)}
      {...props}
    />
  )
}

/** Confirms and closes. Pass `variant="destructive"` for a delete. */
function AlertDialogAction({ variant = "default", ...props }: React.ComponentProps<typeof Button>) {
  return <AlertDialogPrimitive.Close render={<Button data-slot="alert-dialog-action" variant={variant} {...props} />} />
}

/** Dismisses without acting. Receives initial focus. */
function AlertDialogCancel({ variant = "secondary", ...props }: React.ComponentProps<typeof Button>) {
  return <AlertDialogPrimitive.Close render={<Button data-slot="alert-dialog-cancel" data-alert-dialog-cancel="" variant={variant} {...props} />} />
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
}
