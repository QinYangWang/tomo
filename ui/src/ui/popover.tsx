"use client";

import * as React from "react"
import { useDirection } from "@base-ui/react/direction-provider"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { XIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { useLocale } from "@/ui/locale-provider"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

function PopoverContent({
  className,
  side = "bottom",
  sideOffset = 8,
  align = "center",
  alignOffset = 0,
  collisionPadding = 8,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "side" | "sideOffset" | "align" | "alignOffset" | "collisionPadding">) {
  // Portaled popups leave the DOM subtree that sets `dir`; carry the provider direction over.
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  return (
    <PopoverPrimitive.Portal dir={dir}>
      <PopoverPrimitive.Positioner
        className="z-50 outline-none"
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "relative flex w-64 max-w-[calc(100vw-1rem)] origin-(--transform-origin) flex-col gap-2.5 rounded-xl bg-popover p-3 text-ui text-popover-foreground shadow-surface outline-none",
            "transition-[opacity,scale,translate] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:duration-150",
            "data-starting-style:scale-98 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0",
            "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1 data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1",
            "motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-0",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="popover-header" className={cn("flex flex-col gap-1", className)} {...props} />
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("text-ui font-semibold leading-snug text-balance", className)}
      {...props}
    />
  )
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-ui leading-snug text-muted-foreground", className)}
      {...props}
    />
  )
}

function PopoverFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="popover-footer" className={cn("flex items-center justify-end gap-2", className)} {...props} />
}

/** Plain close part; pass `render` to turn any element (e.g. a Button) into a close control. */
function PopoverClose({ className, ...props }: PopoverPrimitive.Close.Props) {
  return <PopoverPrimitive.Close data-slot="popover-close" className={className} {...props} />
}

/** Round × button pinned to the popover's top-right corner. */
function PopoverCloseButton({ className, ...props }: PopoverPrimitive.Close.Props) {
  const { labels } = useLocale()
  return (
    <PopoverPrimitive.Close
      data-slot="popover-close-button"
      aria-label={labels.close}
      className={cn(
        "absolute top-2 end-2 inline-flex size-6 cursor-pointer items-center justify-center rounded-[max(calc(var(--radius-xl)-var(--spacing)*2),var(--radius-sm))] text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      <XIcon size={14} />
    </PopoverPrimitive.Close>
  )
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverFooter,
  PopoverClose,
  PopoverCloseButton,
}
