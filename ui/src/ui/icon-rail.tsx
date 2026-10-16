"use client";

import * as React from "react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipKbd, TooltipTrigger } from "@/ui/tooltip"
import { useLocale } from "@/ui/locale-provider"

type RailOrientation = "vertical" | "horizontal"
type RailSide = "right" | "left" | "top" | "bottom"

type IconRailProps = React.ComponentProps<"nav"> & {
  /** `vertical`: a 48px column (desktop). `horizontal`: a 48px row, e.g. at the bottom of a mobile drawer. */
  orientation?: RailOrientation
  /** Which side the tooltips open on. Defaults to `right` (vertical) or `top` (horizontal). */
  tooltipSide?: RailSide
}

const RailContext = React.createContext<{ side: RailSide; orientation: RailOrientation }>({ side: "right", orientation: "vertical" })

/**
 * Narrow app rail: a column (or, with `orientation="horizontal"`, a row) of
 * 32px icon buttons with tooltips. Put `IconRailSpacer` between the leading
 * and trailing groups. Icons follow the nav rules: solid family, 16px, muted,
 * active foreground. A horizontal rail scrolls sideways when it runs out of room.
 */
function IconRail({ orientation = "vertical", tooltipSide, className, ...props }: IconRailProps) {
  const side = tooltipSide ?? (orientation === "horizontal" ? "top" : "right")
  const ctx = React.useMemo(() => ({ side, orientation }), [side, orientation])
  return (
    <RailContext.Provider value={ctx}>
      <nav
        data-slot="icon-rail"
        data-orientation={orientation}
        className={cn(
          "flex shrink-0 items-center gap-1",
          orientation === "horizontal"
            ? "h-12 w-full min-w-0 flex-row overflow-x-auto overscroll-x-contain px-2 scrollbar-none"
            : "h-full w-12 flex-col py-2",
          className
        )}
        {...props}
      />
    </RailContext.Provider>
  )
}

type IconRailItemProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** Accessible name, also shown in the tooltip. */
  label: string
  icon: React.ReactNode
  /** Keyboard shortcut shown in the tooltip, e.g. `⌘1`. */
  shortcut?: string
  active?: boolean
  /** A count badge (number) or an attention dot (`true`). */
  badge?: number | boolean
  /** Render as another element (a link), keeping the rail styles. */
  render?: React.ReactElement<Record<string, unknown>>
}

function IconRailItem({ label, icon, shortcut, active = false, badge, render, className, ...props }: IconRailItemProps) {
  const { labels } = useLocale()
  const { side } = React.useContext(RailContext)
  const classes = cn(
    "relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-inner text-muted-foreground outline-none transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-active:bg-foreground/6 data-active:text-foreground [&_svg]:size-4.5 [&_svg]:shrink-0",
    className
  )
  const content = (
    <>
      {icon}
      {badge !== undefined && badge !== false && (
        <span
          data-slot="icon-rail-badge"
          className={cn(
            "absolute top-0.5 right-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-shell",
            badge === true ? "size-2" : "h-3.5 min-w-3.5 px-1 text-ui-2xs font-semibold tabular-nums"
          )}
        >
          {badge === true ? <span className="sr-only">{labels.newActivity}</span> : badge > 99 ? "99+" : badge}
        </span>
      )}
    </>
  )
  const element = render ? (
    React.cloneElement(render, {
      "data-slot": "icon-rail-item",
      "data-active": active || undefined,
      "aria-current": active ? "page" : undefined,
      "aria-label": label,
      className: cn(classes, render.props.className as string | undefined),
      children: content,
    })
  ) : (
    <button
      type="button"
      data-slot="icon-rail-item"
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={classes}
      {...props}
    >
      {content}
    </button>
  )
  return (
    <Tooltip>
      <TooltipTrigger render={element} />
      <TooltipContent side={side} sideOffset={6}>
        {label}
        {shortcut && <TooltipKbd>{shortcut}</TooltipKbd>}
      </TooltipContent>
    </Tooltip>
  )
}

type IconRailAvatarProps = Omit<React.ComponentProps<"button">, "children"> & {
  label: string
  /** Avatar content: a provider glyph, initials or an <img>. */
  children: React.ReactNode
  /** Status ring: connected, working, failed. */
  status?: "online" | "busy" | "error" | "offline"
  /** Extra tooltip text after the label. */
  hint?: string
}

/** Round avatar button for the bottom of the rail (accounts, agent providers) with a status ring. */
function IconRailAvatar({ label, status = "offline", hint, className, children, ...props }: IconRailAvatarProps) {
  const { side } = React.useContext(RailContext)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-slot="icon-rail-avatar"
            data-status={status}
            aria-label={hint ? `${label}, ${hint}` : label}
            className={cn(
              "flex size-7 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-card shadow-raised outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-ring/50 data-[status=busy]:ring-2 data-[status=busy]:ring-warning/70 data-[status=error]:ring-2 data-[status=error]:ring-destructive/60 data-[status=online]:ring-2 data-[status=online]:ring-success/70 [&_svg]:size-3.5",
              className
            )}
            {...props}
          >
            {children}
          </button>
        }
      />
      <TooltipContent side={side} sideOffset={6}>
        {label}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

function IconRailGroup({ className, ...props }: React.ComponentProps<"div">) {
  const { orientation } = React.useContext(RailContext)
  return (
    <div
      data-slot="icon-rail-group"
      role="group"
      className={cn("flex shrink-0 items-center gap-1", orientation === "horizontal" ? "flex-row" : "flex-col", className)}
      {...props}
    />
  )
}

function IconRailSeparator({ className, ...props }: React.ComponentProps<"div">) {
  const { orientation } = React.useContext(RailContext)
  return (
    <div
      data-slot="icon-rail-separator"
      role="separator"
      aria-orientation={orientation === "horizontal" ? "vertical" : "horizontal"}
      className={cn("shrink-0 bg-border", orientation === "horizontal" ? "mx-1 h-5 w-px" : "my-1 h-px w-5", className)}
      {...props}
    />
  )
}

/** Pushes the following items to the bottom of the rail. */
function IconRailSpacer({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="icon-rail-spacer" aria-hidden className={cn("min-w-2 flex-1", className)} {...props} />
}

export {
  IconRail,
  IconRailItem,
  IconRailAvatar,
  IconRailGroup,
  IconRailSeparator,
  IconRailSpacer,
  type IconRailProps,
  type IconRailItemProps,
  type IconRailAvatarProps,
  type RailOrientation as IconRailOrientation,
}
