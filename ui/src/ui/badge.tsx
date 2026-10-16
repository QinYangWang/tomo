import type * as React from "react"

import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full font-medium whitespace-nowrap transition-[box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        chip: "bg-muted text-foreground shadow-chip [a]:hover:shadow-raised-hover",
        primary: "bg-primary-subtle text-primary inset-ring inset-ring-primary-border",
        success: "bg-success-subtle text-success inset-ring inset-ring-success-border",
        warning: "bg-warning-subtle text-warning inset-ring inset-ring-warning-border",
        destructive:
          "bg-destructive-subtle text-destructive inset-ring inset-ring-destructive-border",
        outline: "text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)]",
      },
      size: {
        default: "h-6 px-2 text-ui-sm has-data-[slot=badge-avatar]:pl-1",
        sm: "h-5 px-1.5 text-ui-xs [&>svg]:size-3",
      },
    },
    defaultVariants: {
      variant: "chip",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "chip",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant, size }), className) }, props),
    render,
    state: { slot: "badge", variant, size },
  })
}

/** Small round mark at the start of a chip, e.g. a vendor initial. */
function BadgeAvatar({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge-avatar"
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-full bg-foreground text-ui-2xs font-semibold text-background",
        className
      )}
      {...props}
    />
  )
}

export { Badge, BadgeAvatar, badgeVariants }
