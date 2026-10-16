"use client"

import { useDirection } from "@base-ui/react/direction-provider"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"
import { Kbd } from "@/ui/kbd"

function TooltipProvider({ delay = 300, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} {...props} />
}

const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

function TooltipContent({
  className,
  side = "top",
  sideOffset = 8,
  align = "center",
  children,
  ...props
}: TooltipPrimitive.Popup.Props & Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset" | "align">) {
  // Portaled popups leave the DOM subtree that sets `dir`; carry the provider direction over.
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  return (
    <TooltipPrimitive.Portal dir={dir}>
      <TooltipPrimitive.Positioner className="z-50" side={side} sideOffset={sideOffset} align={align}>
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "flex origin-(--transform-origin) items-center gap-1.5 rounded-lg bg-popover px-2 py-1 text-ui-sm text-popover-foreground shadow-surface transition-[opacity,scale,translate] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:scale-98 data-ending-style:opacity-0 data-instant:duration-0 data-starting-style:scale-98 data-starting-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

/** A key inside a tooltip: a `Kbd` on the tooltip's own fill. */
function TooltipKbd({ className, ...props }: React.ComponentProps<typeof Kbd>) {
  return <Kbd data-slot="tooltip-kbd" size="sm" className={cn("-me-1 rounded-sm bg-muted px-1.5 font-mono", className)} {...props} />
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, TooltipKbd }
