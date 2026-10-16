import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * What a list, table or page shows when there is nothing in it yet: an icon,
 * one line saying what is missing, one line on what to do, and the action.
 *
 *   <EmptyState>
 *     <EmptyStateIcon><InboxIcon /></EmptyStateIcon>
 *     <EmptyStateTitle>No invoices yet</EmptyStateTitle>
 *     <EmptyStateDescription>Invoices appear here after the first charge.</EmptyStateDescription>
 *     <EmptyStateActions><Button size="sm">Create invoice</Button></EmptyStateActions>
 *   </EmptyState>
 */

const emptyStateVariants = cva("flex w-full flex-col items-center justify-center gap-1 text-center text-ui", {
  variants: {
    variant: {
      /** Bare: sits inside a card or table that already has a surface. */
      default: "",
      /** Dashed outline: a drop zone or a page-level placeholder. */
      outline: "rounded-xl border border-dashed border-border",
      /** Quiet translucent fill. */
      muted: "rounded-xl bg-muted",
    },
    size: {
      sm: "px-4 py-6",
      default: "px-6 py-10",
      lg: "px-6 py-16",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
})

function EmptyState({ className, variant, size, ...props }: React.ComponentProps<"div"> & VariantProps<typeof emptyStateVariants>) {
  return <div data-slot="empty-state" className={cn(emptyStateVariants({ variant, size }), className)} {...props} />
}

/** The glyph, in a neutral raised chip (40px, icon 20px). */
function EmptyStateIcon({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state-icon"
      aria-hidden
      className={cn(
        "mb-3 grid size-10 shrink-0 place-items-center rounded-xl bg-card text-muted-foreground shadow-raised [&_svg]:size-5",
        className
      )}
      {...props}
    />
  )
}

function EmptyStateTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="empty-state-title" className={cn("text-ui-lg font-semibold text-balance", className)} {...props} />
}

function EmptyStateDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p data-slot="empty-state-description" className={cn("max-w-sm text-ui text-pretty text-muted-foreground", className)} {...props} />
  )
}

function EmptyStateActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="empty-state-actions" className={cn("mt-4 flex flex-wrap items-center justify-center gap-2", className)} {...props} />
}

export { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription, EmptyStateActions, emptyStateVariants }
