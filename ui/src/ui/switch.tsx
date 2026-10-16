"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cva, type VariantProps } from "class-variance-authority"

import { useControlSize, type ControlSize } from "@/lib/control-size"
import { cn } from "@/lib/utils"

// Track sizes: sm 26x16, default 32x20, lg 40x24; the thumb is the track height minus 4px.
// An `xs` inherited from a Field maps to `sm`.
const switchVariants = cva(
  "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full bg-foreground/16 p-0.5 transition-[background-color,box-shadow] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-checked:bg-primary data-checked:shadow-none data-disabled:cursor-not-allowed data-disabled:opacity-64",
  {
    variants: {
      size: {
        sm: "h-4 w-6.5",
        default: "h-5 w-8",
        lg: "h-6 w-10",
      },
    },
    defaultVariants: { size: "default" },
  }
)

const thumbSize = {
  sm: "size-3 data-checked:translate-x-2.5 rtl:data-checked:-translate-x-2.5",
  default: "size-4 data-checked:translate-x-3 rtl:data-checked:-translate-x-3",
  lg: "size-5 data-checked:translate-x-4 rtl:data-checked:-translate-x-4",
} as const

type SwitchSize = keyof typeof thumbSize

function Switch({ className, size: sizeProp, ...props }: SwitchPrimitive.Root.Props & VariantProps<typeof switchVariants>) {
  const inherited = useControlSize<ControlSize>(sizeProp)
  const size: SwitchSize = inherited === "xs" ? "sm" : inherited
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(switchVariants({ size }), className)}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-background shadow-raised transition-transform duration-200 ease-out dark:bg-foreground dark:data-checked:bg-background",
          thumbSize[size]
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch, switchVariants }
export type { SwitchSize }
