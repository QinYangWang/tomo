import * as React from "react"
import { useDirection } from "@base-ui/react/direction-provider"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { XIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { useLocale } from "@/ui/locale-provider"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: DialogPrimitive.Popup.Props & { showClose?: boolean }) {
  const { labels } = useLocale()
  // Portaled popups leave the DOM subtree that sets `dir`; carry the provider direction over.
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  return (
    <DialogPrimitive.Portal dir={dir}>
      <DialogPrimitive.Backdrop
        data-slot="dialog-backdrop"
        className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0"
      />
      <DialogPrimitive.Viewport
        data-slot="dialog-viewport"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "relative flex max-h-full w-full max-w-md flex-col gap-3 overflow-y-auto overscroll-contain rounded-3xl bg-popover p-5 text-popover-foreground shadow-xl transition-[opacity,scale,translate] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:scale-98 data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100",
            className
          )}
          {...props}
        >
          {children}
          {showClose && (
            // Last in the DOM (so focus order and initial focus are unchanged) but shown first
            // (`order-first`) as a zero-height sticky row: it sits 16px from the top-right corner
            // like an absolute button, and stays pinned there while long content scrolls under it.
            <div data-slot="dialog-close-row" className="sticky top-0 z-10 order-first -mb-4 flex h-0 shrink-0 justify-end">
              <DialogPrimitive.Close
                data-slot="dialog-close"
                aria-label={labels.close}
                className="-mt-1.5 -me-1.5 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-popover text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <XIcon size={16} />
              </DialogPrimitive.Close>
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1 pe-8", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-footer" className={cn("flex items-center justify-end gap-2 pt-2", className)} {...props} />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-tight font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-ui leading-snug text-pretty text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
