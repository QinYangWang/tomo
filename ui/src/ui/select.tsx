"use client";

import * as React from "react"
import { useDirection } from "@base-ui/react/direction-provider"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cva, type VariantProps } from "class-variance-authority"

import { CheckIcon, ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "@/components/icons"
import { ControlSizeContext, useControlSize, type ControlSize } from "@/lib/control-size"
import { cn } from "@/lib/utils"

// Trigger heights match Button (xs 24, sm 28, default 32, lg 36). Rows follow a size set
// on <Select> or a sized Field; a size on the trigger alone keeps full-size rows.
const selectTriggerVariants = cva(
  "inline-flex w-full min-w-36 cursor-pointer items-center gap-2 bg-card shadow-raised transition-[box-shadow,background-color] duration-150 ease-out outline-none select-none hover:shadow-raised-hover focus-visible:ring-2 focus-visible:ring-ring/50 data-disabled:pointer-events-none data-disabled:opacity-64 data-popup-open:shadow-raised-hover [&_svg]:shrink-0",
  {
    variants: {
      size: {
        xs: "h-6 gap-1.5 rounded-sm pe-1.5 ps-2 text-ui-xs [&_svg]:size-3",
        sm: "h-7 rounded-lg pe-2 ps-2.5 text-ui-sm [&_svg]:size-3.5",
        default: "h-8 rounded-lg pe-2 ps-2.5 text-ui [&_svg]:size-3.5",
        lg: "h-9 rounded-lg pe-2.5 ps-3 text-ui-lg [&_svg]:size-4",
      },
    },
    defaultVariants: { size: "default" },
  }
)

const selectItemVariants = cva(
  "relative flex cursor-default items-center gap-2 rounded-lg py-px outline-none select-none transition-colors duration-150 data-disabled:pointer-events-none data-disabled:opacity-64 data-highlighted:bg-secondary [&_svg]:shrink-0",
  {
    variants: {
      size: {
        xs: "min-h-6 pe-6 ps-1.5 text-ui-xs [&_svg]:size-3",
        sm: "min-h-6 pe-7 ps-2 text-ui-sm [&_svg]:size-3.5",
        default: "min-h-6.5 pe-7 ps-2 text-ui [&_svg]:size-3.5",
        lg: "min-h-8 pe-8 ps-2.5 text-ui-lg [&_svg]:size-4",
      },
    },
    defaultVariants: { size: "default" },
  }
)

type SelectProps<Value, Multiple extends boolean | undefined = false> = SelectPrimitive.Root.Props<Value, Multiple> & {
  /** Sizes the trigger and the rows together. */
  size?: ControlSize
}

function Select<Value, Multiple extends boolean | undefined = false>({ size, ...props }: SelectProps<Value, Multiple>) {
  const root = <SelectPrimitive.Root<Value, Multiple> {...props} />
  if (!size) return root
  return <ControlSizeContext.Provider value={size}>{root}</ControlSizeContext.Provider>
}

const SelectGroup = SelectPrimitive.Group

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex-1 truncate text-start data-placeholder:text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size: sizeProp,
  children,
  ...props
}: SelectPrimitive.Trigger.Props & VariantProps<typeof selectTriggerVariants>) {
  const size = useControlSize(sizeProp)
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(selectTriggerVariants({ size }), className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-muted-foreground">
        <ChevronsUpDownIcon />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "center",
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, "side" | "sideOffset" | "align" | "alignItemWithTrigger">) {
  // Portaled popups leave the DOM subtree that sets `dir`; carry the provider direction over.
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  return (
    <SelectPrimitive.Portal dir={dir}>
      <SelectPrimitive.Positioner
        className="z-50 outline-none select-none"
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignItemWithTrigger={alignItemWithTrigger}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "relative max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-surface transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:scale-98 data-ending-style:opacity-0 data-[side=none]:data-ending-style:scale-100 data-starting-style:scale-98 data-starting-style:opacity-0 data-[side=none]:data-starting-style:scale-100",
            className
          )}
          {...props}
        >
          <SelectPrimitive.ScrollUpArrow className="top-0 z-10 flex h-6 w-full cursor-default items-center justify-center rounded-t-xl bg-popover text-muted-foreground">
            <ChevronUpIcon size={14} />
          </SelectPrimitive.ScrollUpArrow>
          <SelectPrimitive.List className="max-h-(--available-height) scroll-py-6 overflow-y-auto overscroll-contain p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</SelectPrimitive.List>
          <SelectPrimitive.ScrollDownArrow className="bottom-0 z-10 flex h-6 w-full cursor-default items-center justify-center rounded-b-xl bg-popover text-muted-foreground">
            <ChevronDownIcon size={14} />
          </SelectPrimitive.ScrollDownArrow>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  const size = useControlSize()
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      data-size={size}
      className={cn(selectItemVariants({ size }), className)}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 items-center gap-2 truncate">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className={cn("absolute flex text-foreground", size === "xs" ? "end-1.5" : size === "lg" ? "end-2.5" : "end-2")}>
        <CheckIcon />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 pt-1.5 pb-1 text-ui-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return <SelectPrimitive.Separator data-slot="select-separator" className={cn("mx-2 my-1 h-px bg-border", className)} {...props} />
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  selectTriggerVariants,
  selectItemVariants,
}
export type { SelectProps }
