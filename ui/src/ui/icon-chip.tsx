import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * The house frame for an icon that labels a title, header or card: a small
 * raised squircle that holds one puffy icon. Every title-level icon in the
 * library sits in one of these so headers read as one family; nav, menu and
 * inline icons stay bare (16px, muted, active = foreground).
 *
 * - neutral  raised secondary surface, muted icon (the default)
 * - tinted   primary / success / warning / destructive wash with a hairline ring
 * - solid    filled primary, for a brand or hero mark
 */
const iconChipVariants = cva(
  "relative inline-grid shrink-0 place-items-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-card text-muted-foreground shadow-raised",
        primary: "bg-primary-subtle text-primary inset-ring inset-ring-primary-border",
        success: "bg-success-subtle text-success inset-ring inset-ring-success-border",
        warning: "bg-warning-subtle text-warning inset-ring inset-ring-warning-border",
        destructive:
          "bg-destructive-subtle text-destructive inset-ring inset-ring-destructive-border",
        solid: "bg-primary text-primary-foreground shadow-primary",
      },
      size: {
        sm: "size-6 rounded-lg [&_svg]:size-3.5",
        default: "size-8 rounded-lg [&_svg]:size-4",
        lg: "size-10 rounded-xl [&_svg]:size-5",
        xl: "size-12 rounded-2xl [&_svg]:size-6",
      },
    },
    defaultVariants: { tone: "neutral", size: "default" },
  }
)

function IconChip({
  className,
  tone = "neutral",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof iconChipVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { className: cn(iconChipVariants({ tone, size }), className), "aria-hidden": true },
      props
    ),
    render,
    state: { slot: "icon-chip", tone, size },
  })
}

export { IconChip, iconChipVariants }
