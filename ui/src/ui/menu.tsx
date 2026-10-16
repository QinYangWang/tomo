import * as React from "react"
import { useDirection } from "@base-ui/react/direction-provider"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { CheckIcon, ChevronRightIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

const Menu = MenuPrimitive.Root
const MenuTrigger = MenuPrimitive.Trigger
const MenuSub = MenuPrimitive.SubmenuRoot

// Labels may sit inside a group (announced as its label) or stand alone as a heading.
const MenuInGroupContext = React.createContext(false)

function MenuGroup(props: MenuPrimitive.Group.Props) {
  return (
    <MenuInGroupContext.Provider value={true}>
      <MenuPrimitive.Group {...props} />
    </MenuInGroupContext.Provider>
  )
}

function MenuRadioGroup(props: MenuPrimitive.RadioGroup.Props) {
  return (
    <MenuInGroupContext.Provider value={true}>
      <MenuPrimitive.RadioGroup {...props} />
    </MenuInGroupContext.Provider>
  )
}

const popupClass =
  "min-w-44 origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-2xl bg-popover p-1 text-popover-foreground shadow-surface outline-none transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:scale-98 data-starting-style:opacity-0"

const itemClass =
  "relative flex min-h-6.5 cursor-default items-center gap-2 rounded-lg px-2 py-px text-ui outline-none select-none transition-colors duration-150 data-disabled:pointer-events-none data-disabled:opacity-64 data-highlighted:bg-secondary [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-highlighted:[&_svg]:text-foreground"

function MenuContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "side" | "sideOffset" | "align" | "alignOffset">) {
  // Portaled popups leave the DOM subtree that sets `dir`; carry the provider direction over.
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  return (
    <MenuPrimitive.Portal dir={dir}>
      <MenuPrimitive.Positioner
        className="z-50 outline-none"
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
      >
        <MenuPrimitive.Popup data-slot="menu-content" className={cn(popupClass, className)} {...props} />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function MenuItem({
  className,
  variant = "default",
  inset,
  ...props
}: MenuPrimitive.Item.Props & { variant?: "default" | "destructive"; inset?: boolean }) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      data-variant={variant}
      className={cn(
        itemClass,
        inset && "ps-7.5",
        "data-[variant=destructive]:text-destructive data-[variant=destructive]:[&_svg]:text-destructive/80 data-[variant=destructive]:data-highlighted:bg-destructive/8",
        className
      )}
      {...props}
    />
  )
}

function MenuCheckboxItem({ className, children, ...props }: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem data-slot="menu-checkbox-item" className={cn(itemClass, "ps-7.5", className)} {...props}>
      <span className="absolute start-2 flex size-4 items-center justify-center">
        <MenuPrimitive.CheckboxItemIndicator className="transition-[opacity,scale] duration-150 data-ending-style:scale-50 data-ending-style:opacity-0 data-starting-style:scale-50 data-starting-style:opacity-0">
          <CheckIcon className="!text-primary" />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function MenuRadioItem({ className, children, ...props }: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem data-slot="menu-radio-item" className={cn(itemClass, "ps-7.5", className)} {...props}>
      <span className="absolute start-2 flex size-4 items-center justify-center">
        <MenuPrimitive.RadioItemIndicator className="size-2 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_22%,transparent)] transition-[opacity,scale] duration-150 data-ending-style:scale-0 data-starting-style:scale-0" />
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function MenuLabel({ className, inset, ...props }: MenuPrimitive.GroupLabel.Props & { inset?: boolean }) {
  const inGroup = React.useContext(MenuInGroupContext)
  const base = cn("px-2 pt-1.5 pb-1 text-ui-sm text-muted-foreground", inset && "ps-7.5")
  if (!inGroup) {
    // Outside a group the primitive label throws, so render a plain heading.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { render: _render, ...rest } = props
    return (
      <div
        data-slot="menu-label"
        role="presentation"
        className={cn(base, typeof className === "string" && className)}
        {...(rest as React.ComponentProps<"div">)}
      />
    )
  }
  return (
    <MenuPrimitive.GroupLabel
      data-slot="menu-label"
      className={typeof className === "function" ? (state) => cn(base, className(state)) : cn(base, className)}
      {...props}
    />
  )
}

function MenuSeparator({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator data-slot="menu-separator" className={cn("mx-2 my-1 h-px bg-border", className)} {...props} />
  )
}

function MenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menu-shortcut"
      // Key glyphs keep their order in right-to-left text.
      dir="ltr"
      // design-check-ignore tracking -- shortcut glyphs are spaced wide (rule 11 allows it)
      className={cn("ms-auto ps-4 font-sans text-ui-xs tracking-widest text-muted-foreground/72", className)}
      {...props}
    />
  )
}

function MenuSubTrigger({ className, children, ...props }: MenuPrimitive.SubmenuTrigger.Props) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="menu-sub-trigger"
      className={cn(itemClass, "data-popup-open:bg-secondary", className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ms-auto rtl:rotate-180" />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function MenuSubContent(props: React.ComponentProps<typeof MenuContent>) {
  return <MenuContent side="inline-end" align="start" sideOffset={4} alignOffset={-4} {...props} />
}

export {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuCheckboxItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuGroup,
  MenuLabel,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubTrigger,
  MenuSubContent,
}
