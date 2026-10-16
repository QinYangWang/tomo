"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cva, type VariantProps } from "class-variance-authority"

import { useControlSize, type ControlSize } from "@/lib/control-size"
import { cn } from "@/lib/utils"

// Box sizes: sm 14px, default 16px, lg 20px. An `xs` inherited from a Field maps to `sm`.
const checkboxVariants = cva("", {
  variants: {
    size: {
      sm: "size-3.5 rounded-[calc(var(--radius)*0.375)]",
      default: "size-4 rounded-sm",
      lg: "size-5 rounded-[calc(var(--radius)*0.625)]",
    },
  },
  defaultVariants: { size: "default" },
})

type CheckboxSize = "sm" | "default" | "lg"

function toToggleSize(size: ControlSize): CheckboxSize {
  return size === "xs" ? "sm" : size
}

/**
 * Checkbox in an inset well. Checking fills it primary and draws the check on
 * stroke by stroke; `indeterminate` swaps in a dash. Presses squish on a spring.
 */
function Checkbox({ className, size: sizeProp, ...props }: CheckboxPrimitive.Root.Props & VariantProps<typeof checkboxVariants>) {
  const size = toToggleSize(useControlSize<ControlSize>(sizeProp))
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      data-size={size}
      className={cn(
        checkboxVariants({ size }),
        "peer group/checkbox relative inline-flex shrink-0 cursor-pointer items-center justify-center bg-background text-primary-foreground shadow-well outline-none dark:bg-input/32",
        "transition-[background-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        // dark:bg-input/32 above is as specific as data-checked:bg-primary and sorts after it, so the dark checked fill is restated.
        "data-checked:bg-primary data-checked:shadow-primary data-indeterminate:bg-primary data-indeterminate:shadow-primary dark:data-checked:bg-primary dark:data-indeterminate:bg-primary",
        "data-invalid:shadow-[inset_0_0_0_1px_var(--destructive)] data-disabled:cursor-not-allowed data-disabled:opacity-64 data-readonly:cursor-default",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        keepMounted
        data-slot="checkbox-indicator"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <svg viewBox="0 0 18 18" fill="none" aria-hidden className="size-full">
          {/* Same path and round caps/joins as CheckIcon; heavier stroke for the filled box. Dash offset 1 → 0 draws it on; retracts quickly on uncheck. */}
          <path
            d="M4.4 9.6l3 3 6.2-6.4"
            pathLength={1}
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="[stroke-dasharray:1] [stroke-dashoffset:1] transition-[stroke-dashoffset] duration-150 ease-out group-data-checked/checkbox:[stroke-dashoffset:0] group-data-checked/checkbox:delay-75 group-data-checked/checkbox:duration-300 group-data-checked/checkbox:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          />
          {/* Indeterminate dash grows out from the centre. */}
          <path
            d="M5.25 9h7.5"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="origin-center scale-x-0 opacity-0 transition-[scale,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-box:fill-box] group-data-indeterminate/checkbox:scale-x-100 group-data-indeterminate/checkbox:opacity-100 motion-reduce:transition-none"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox, checkboxVariants }
export type { CheckboxSize }
