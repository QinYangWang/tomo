import * as React from "react"
import { useDirection } from "@base-ui/react/direction-provider"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { cva, type VariantProps } from "class-variance-authority"

import { CheckIcon, ChevronsUpDownIcon, SearchIcon, XIcon } from "@/components/icons"
import { ControlSizeContext, useControlSize, type ControlSize } from "@/lib/control-size"
import { cn } from "@/lib/utils"

// Heights match Button (xs 24, sm 28, default 32, lg 36). Set `size` on <Combobox> (or a
// Field) to size the input or trigger and the rows together.
type ComboboxProps<Value, Multiple extends boolean | undefined = false, Item = Value> = ComboboxPrimitive.Root.Props<
  Value,
  Multiple,
  Item
> & {
  size?: ControlSize
}

function Combobox<Value, Multiple extends boolean | undefined = false, Item = Value>({
  size,
  ...props
}: ComboboxProps<Value, Multiple, Item>) {
  const root = <ComboboxPrimitive.Root<Value, Multiple, Item> {...props} />
  if (!size) return root
  return <ControlSizeContext.Provider value={size}>{root}</ControlSizeContext.Provider>
}

const comboboxInputVariants = cva(
  "group/combobox relative flex w-full min-w-48 items-center bg-background dark:bg-input/32 shadow-well transition-[box-shadow,background-color] focus-within:ring-2 focus-within:ring-ring/50 data-disabled:pointer-events-none data-disabled:opacity-64",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 rounded-sm pe-0.5 ps-2",
        sm: "h-7 gap-1.5 rounded-lg pe-1 ps-2.5",
        default: "h-8 gap-1.5 rounded-lg pe-1 ps-2.5",
        lg: "h-9 gap-2 rounded-lg pe-1 ps-3",
      },
    },
    defaultVariants: { size: "default" },
  }
)

const comboboxTriggerVariants = cva(
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

const comboboxItemVariants = cva(
  "relative flex cursor-default items-center gap-2 rounded-lg py-px outline-none select-none transition-[background-color,box-shadow] duration-150 data-disabled:pointer-events-none data-disabled:opacity-64 data-highlighted:bg-secondary [&_svg]:shrink-0",
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

// Clear and chevron buttons inside the input well, per size: [button box, clear icon px].
const inputButton: Record<ControlSize, [string, number]> = {
  xs: ["size-5 rounded-xs", 12],
  sm: ["size-6 rounded-md", 14],
  default: ["size-6 rounded-md", 14],
  lg: ["size-7 rounded-md", 14],
}
const inputText: Record<ControlSize, string> = {
  xs: "md:text-ui-xs",
  sm: "md:text-ui",
  default: "md:text-ui",
  lg: "md:text-ui-lg",
}

const ComboboxValue = ComboboxPrimitive.Value
const ComboboxCollection = ComboboxPrimitive.Collection
const useComboboxFilter = ComboboxPrimitive.useFilter

/**
 * Searchable input in an inset pill well. Typing filters the list; the chevron
 * opens it, and a clear button appears once something is chosen.
 */
function ComboboxInput({
  className,
  showSearchIcon = true,
  showClear = true,
  showTrigger = true,
  size: sizeProp,
  ...props
}: Omit<ComboboxPrimitive.Input.Props, "size"> &
  VariantProps<typeof comboboxInputVariants> & {
    showSearchIcon?: boolean
    showClear?: boolean
    showTrigger?: boolean
  }) {
  const size = useControlSize(sizeProp)
  const [buttonBox, iconSize] = inputButton[size]
  return (
    <ComboboxPrimitive.InputGroup
      data-slot="combobox-input-group"
      data-size={size}
      className={cn(comboboxInputVariants({ size }), className)}
    >
      {showSearchIcon && <SearchIcon size={size === "xs" ? 14 : 16} className="shrink-0 text-muted-foreground" />}
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className={cn("h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/72", inputText[size])}
        {...props}
      />
      {showClear && (
        <ComboboxPrimitive.Clear
          data-slot="combobox-clear"
          aria-label="Clear selection"
          className={cn(
            "flex shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-[color,background-color,opacity,scale] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-ending-style:scale-75 data-ending-style:opacity-0 data-starting-style:scale-75 data-starting-style:opacity-0",
            buttonBox
          )}
        >
          <XIcon size={iconSize} />
        </ComboboxPrimitive.Clear>
      )}
      {showTrigger && (
        <ComboboxPrimitive.Trigger
          data-slot="combobox-trigger"
          aria-label="Show options"
          className={cn(
            "flex shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
            buttonBox
          )}
        >
          <ChevronsUpDownIcon size={size === "xs" ? 14 : 16} />
        </ComboboxPrimitive.Trigger>
      )}
    </ComboboxPrimitive.InputGroup>
  )
}

/**
 * Raised button that shows the chosen value, like SelectTrigger. Pair it
 * with <ComboboxSearch /> inside the popup for the "search in popup" pattern.
 */
function ComboboxTrigger({
  className,
  size: sizeProp,
  children,
  ...props
}: ComboboxPrimitive.Trigger.Props & VariantProps<typeof comboboxTriggerVariants>) {
  const size = useControlSize(sizeProp)
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      data-size={size}
      className={cn(comboboxTriggerVariants({ size }), className)}
      {...props}
    >
      <span className="flex-1 truncate text-start data-placeholder:text-muted-foreground">{children}</span>
      <ChevronsUpDownIcon className="text-muted-foreground" />
    </ComboboxPrimitive.Trigger>
  )
}

/** Search field rendered inside the popup (use with ComboboxTrigger). */
function ComboboxSearch({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <div data-slot="combobox-search" className="p-1 pb-0">
      <div className="flex h-7 items-center gap-2 rounded-lg bg-background px-2 shadow-well dark:bg-input/32">
        <SearchIcon size={15} className="shrink-0 text-muted-foreground" />
        <ComboboxPrimitive.Input
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent text-ui outline-none placeholder:text-muted-foreground",
            className
          )}
          {...props}
        />
      </div>
    </div>
  )
}

function ComboboxContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, "side" | "sideOffset" | "align" | "anchor">) {
  // Portaled popups leave the DOM subtree that sets `dir`; carry the provider direction over.
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  return (
    <ComboboxPrimitive.Portal dir={dir}>
      <ComboboxPrimitive.Positioner
        className="z-50 outline-none"
        side={side}
        sideOffset={sideOffset}
        align={align}
        anchor={anchor}
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "relative flex max-h-[min(var(--available-height),22rem)] w-(--anchor-width) min-w-48 origin-(--transform-origin) flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-surface transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:scale-98 data-starting-style:opacity-0",
            className
          )}
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "min-h-0 flex-1 scroll-py-1 overflow-y-auto overscroll-contain p-1 [scrollbar-width:none] data-empty:p-0 [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    />
  )
}

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  const size = useControlSize()
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      data-size={size}
      className={cn(comboboxItemVariants({ size }), className)}
      {...props}
    >
      <span className="flex flex-1 items-center gap-2 truncate">{children}</span>
      <ComboboxPrimitive.ItemIndicator
        className={cn("absolute flex text-foreground", size === "xs" ? "end-1.5" : size === "lg" ? "end-2.5" : "end-2")}
      >
        <CheckIcon />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return <ComboboxPrimitive.Group data-slot="combobox-group" className={cn("py-0.5", className)} {...props} />
}

function ComboboxLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn("px-2.5 pt-1.5 pb-1 text-ui-sm font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

function ComboboxSeparator({ className, ...props }: ComboboxPrimitive.Separator.Props) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn("mx-1.5 my-1.5 h-px bg-border", className)}
      {...props}
    />
  )
}

/** Shown only when the filter leaves nothing to pick. */
function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn("px-3 py-6 text-center text-ui text-muted-foreground empty:m-0 empty:p-0", className)}
      {...props}
    />
  )
}

export {
  Combobox,
  ComboboxValue,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxSearch,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxSeparator,
  ComboboxEmpty,
  ComboboxCollection,
  useComboboxFilter,
  comboboxInputVariants,
  comboboxTriggerVariants,
  comboboxItemVariants,
}
export type { ComboboxProps }
