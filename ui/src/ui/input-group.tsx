import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { ControlSizeContext, useControlSize, type ControlSize } from "@/lib/control-size"
import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"

/*
 * One well that holds an input (or textarea) plus addons: icons, text, buttons, a kbd.
 * The group owns the well, focus ring and height; the input inside is bare.
 *
 *   <InputGroup>
 *     <InputGroupAddon><SearchIcon /></InputGroupAddon>
 *     <InputGroupInput placeholder="Search" />
 *     <InputGroupAddon align="inline-end"><InputGroupButton>Go</InputGroupButton></InputGroupAddon>
 *   </InputGroup>
 */
const inputGroupVariants = cva(
  "group/input-group relative flex w-full min-w-0 items-center bg-background shadow-well transition-[box-shadow,background-color] outline-none dark:bg-input/32 has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control][aria-invalid=true]]:ring-2 has-[[data-slot=input-group-control][aria-invalid=true]]:ring-destructive/30 has-[[data-slot=input-group-control]:disabled]:opacity-64 has-[textarea]:h-auto has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col",
  {
    variants: {
      size: {
        xs: "frame-sm frame-inset-0.5 h-6 text-ui-xs",
        sm: "frame-lg frame-inset-0.5 h-7 text-ui",
        default: "frame-lg frame-inset-1 h-8 text-ui",
        lg: "frame-lg frame-inset-1 h-9 text-ui-lg",
      },
    },
    defaultVariants: { size: "default" },
  }
)

function InputGroup({ className, size, ...props }: React.ComponentProps<"div"> & VariantProps<typeof inputGroupVariants>) {
  const resolved = useControlSize(size) as ControlSize
  return (
    <ControlSizeContext.Provider value={resolved}>
      <div
        role="group"
        data-slot="input-group"
        data-size={resolved}
        className={cn(inputGroupVariants({ size: resolved }), className)}
        {...props}
      />
    </ControlSizeContext.Provider>
  )
}

const addonVariants = cva(
  "flex shrink-0 cursor-text items-center gap-1.5 text-muted-foreground select-none [&>kbd]:rounded-[max(calc(var(--frame-inner-1)-var(--spacing)*0.5),min(var(--radius-xs),var(--radius-sm)))] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 group-data-[size=xs]/input-group:[&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      align: {
        "inline-start": "order-first ps-2.5 has-[>svg]:pe-2 has-[>kbd]:pe-2 has-[>button]:ps-1 group-data-[size=xs]/input-group:ps-2 group-data-[size=xs]/input-group:has-[>button]:ps-0.5",
        "inline-end": "order-last pe-2.5 has-[>svg]:ps-2 has-[>kbd]:ps-2 has-[>button]:pe-1 group-data-[size=xs]/input-group:pe-2 group-data-[size=xs]/input-group:has-[>button]:pe-0.5",
        "block-start": "order-first w-full justify-start px-2.5 pt-2",
        "block-end": "order-last w-full justify-start px-2.5 pb-2",
      },
    },
    defaultVariants: { align: "inline-start" },
  }
)

/** Holds icons, text or buttons beside the control. A click on the addon focuses the input. */
function InputGroupAddon({
  className,
  align = "inline-start",
  onMouseDown,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof addonVariants>) {
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      onMouseDown={(e) => {
        onMouseDown?.(e)
        if (e.defaultPrevented || (e.target as HTMLElement).closest("button,a,input,[role=button]")) return
        e.preventDefault()
        e.currentTarget.parentElement?.querySelector<HTMLElement>("[data-slot=input-group-control]")?.focus()
      }}
      className={cn(addonVariants({ align }), className)}
      {...props}
    />
  )
}

const controlClass =
  "min-w-0 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-muted-foreground/72 disabled:pointer-events-none md:text-[length:inherit]"

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input-group-control"
      className={cn(
        controlClass,
        "h-full self-stretch px-2.5 group-data-[size=xs]/input-group:px-2 group-data-[size=lg]/input-group:px-3",
        "[[data-align=inline-start]~&]:ps-0 [&:has(~[data-align=inline-end])]:pe-0",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="input-group-control"
      className={cn(controlClass, "field-sizing-content min-h-16 w-full resize-none self-stretch px-2.5 py-2", className)}
      {...props}
    />
  )
}

/** Plain text inside an addon, such as a unit or a URL prefix. */
function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="input-group-text" className={cn("whitespace-nowrap", className)} {...props} />
}

/** A compact ghost button sized to sit inside the well, concentric with it. */
function InputGroupButton({
  className,
  variant = "ghost",
  size,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="input-group-button"
      variant={variant}
      size={size ?? "xs"}
      className={cn("rounded-inner group-data-[size=xs]/input-group:h-5 group-data-[size=xs]/input-group:data-[size=icon-xs]:w-5 group-data-[size=lg]/input-group:h-7 group-data-[size=lg]/input-group:data-[size=icon-xs]:w-7", className)}
      {...props}
    />
  )
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText, InputGroupTextarea, inputGroupVariants }
