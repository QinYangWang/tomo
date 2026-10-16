import * as React from "react"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cva, type VariantProps } from "class-variance-authority"
import { LayoutGroup, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/*
 * Pick one of a few options in place: billing cycle, chart type, light / dark,
 * date range. Looks like TabsList (raised thumb on a well) but is a radio group,
 * because it changes a value rather than switching panels. Arrow keys move the
 * selection.
 *
 *   <SegmentedControl value={cycle} onValueChange={setCycle} aria-label="Billing cycle">
 *     <SegmentedControlItem value="monthly">Monthly</SegmentedControlItem>
 *     <SegmentedControlItem value="yearly">Yearly</SegmentedControlItem>
 *   </SegmentedControl>
 */

// Outer heights match Button (xs 24, sm 28, default 32, lg 36): items are 4px shorter
// inside the p-0.5 well, and their radius is the well's minus 2px (the well is a frame, so this holds at
// every radius preset).
const segmentedControlVariants = cva("relative inline-flex w-fit items-center gap-0.5 bg-muted frame-p-0.5 shadow-well", {
  variants: {
    size: {
      xs: "frame-sm",
      sm: "frame-lg",
      default: "frame-lg",
      lg: "frame-lg",
    },
  },
  defaultVariants: { size: "default" },
})

const segmentedControlItemVariants = cva(
  "relative inline-flex cursor-pointer items-center select-none justify-center gap-1.5 font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-checked:text-foreground data-disabled:pointer-events-none data-disabled:opacity-64 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      size: {
        xs: "h-5 rounded-inner px-2 text-ui-xs [&_svg]:size-3",
        sm: "h-6 rounded-inner px-2.5 text-ui-sm",
        default: "h-7 rounded-inner px-3 text-ui",
        lg: "h-8 rounded-inner px-3.5 text-ui-lg [&_svg]:size-4",
      },
    },
    defaultVariants: { size: "default" },
  }
)

type SegmentedControlSize = NonNullable<VariantProps<typeof segmentedControlVariants>["size"]>


const SegmentedContext = React.createContext<{ id: string; size: SegmentedControlSize; value: unknown; reduce: boolean } | null>(null)

type SegmentedControlProps = Omit<RadioGroupPrimitive.Props<string>, "onValueChange"> & {
  onValueChange?: (value: string) => void
  size?: SegmentedControlSize
}

function SegmentedControl({ className, size = "default", value, defaultValue, onValueChange, ...props }: SegmentedControlProps) {
  const id = React.useId()
  const reduce = useReducedMotion() ?? false
  const [inner, setInner] = React.useState<unknown>(defaultValue)
  const current = value !== undefined ? value : inner
  return (
    <SegmentedContext.Provider value={{ id, size, value: current, reduce }}>
      <LayoutGroup id={id}>
        <RadioGroupPrimitive
          data-slot="segmented-control"
          data-size={size}
          value={value}
          defaultValue={defaultValue}
          onValueChange={(v) => {
            setInner(v)
            onValueChange?.(String(v))
          }}
          className={cn(segmentedControlVariants({ size }), className)}
          {...props}
        />
      </LayoutGroup>
    </SegmentedContext.Provider>
  )
}

function SegmentedControlItem({ className, children, value, ...props }: RadioPrimitive.Root.Props<string>) {
  const ctx = React.useContext(SegmentedContext)
  const selected = ctx?.value === value
  const size = ctx?.size ?? "default"
  return (
    <RadioPrimitive.Root
      data-slot="segmented-control-item"
      data-size={size}
      value={value}
      className={cn(segmentedControlItemVariants({ size }), className)}
      {...props}
    >
      {selected && (
        <motion.span
          aria-hidden
          layoutId={`${ctx?.id}-thumb`}
          transition={ctx?.reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
          className="absolute inset-0 rounded-inner bg-card shadow-raised"
        />
      )}
      <span className="relative inline-flex items-center gap-1.5">{children}</span>
    </RadioPrimitive.Root>
  )
}

export { SegmentedControl, SegmentedControlItem, segmentedControlVariants, segmentedControlItemVariants }
export type { SegmentedControlProps, SegmentedControlSize }
