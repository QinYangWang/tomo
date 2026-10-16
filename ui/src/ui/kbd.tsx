import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const kbdVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-0.5 bg-card font-sans font-medium text-muted-foreground shadow-chip select-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      size: {
        sm: "h-4 min-w-4 rounded-2xs px-1 text-ui-2xs [&_svg:not([class*='size-'])]:size-2.5",
        default: "h-5 min-w-5 rounded-xs px-1 text-ui-xs [&_svg:not([class*='size-'])]:size-3",
        lg: "h-6 min-w-6 rounded-sm px-1.5 text-ui-sm [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: { size: "default" },
  }
)

type KbdProps = React.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>

/** One key. Inside a tooltip or a primary button it picks up a muted fill instead of a chip. */
function Kbd({ className, size = "default", ...props }: KbdProps) {
  return <kbd data-slot="kbd" data-size={size} dir="ltr" className={cn(kbdVariants({ size }), className)} {...props} />
}

/** Keys pressed together or in sequence, spaced evenly. */
function KbdGroup({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd data-slot="kbd-group" dir="ltr" className={cn("inline-flex items-center gap-1 align-middle", className)} {...props} />
}

export { Kbd, KbdGroup, kbdVariants }
export type { KbdProps }
