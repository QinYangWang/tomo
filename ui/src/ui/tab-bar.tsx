"use client";

import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import { cn } from "@/lib/utils"
import { useLocale } from "@/ui/locale-provider"

/**
 * Bottom navigation for phones: evenly spaced items, each an icon above its label. The bar pads
 * itself by the bottom safe-area inset, so it can sit flush with the screen edge.
 *
 *   <TabBar className="fixed inset-x-0 bottom-0">
 *     <TabBarItem icon={<InboxIcon />} label="Inbox" active />
 *     <TabBarItem icon={<CalendarDaysIcon />} label="Calendar" render={<Link href="/calendar" />} />
 *   </TabBar>
 */
function TabBar({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="tab-bar"
      className={cn(
        "flex w-full min-w-0 items-stretch border-t border-border bg-background px-1 pb-[env(safe-area-inset-bottom)]",
        className
      )}
      {...props}
    />
  )
}

type TabBarItemProps = Omit<useRender.ComponentProps<"button">, "children"> & {
  icon: React.ReactNode
  /** Visible label under the icon; also the accessible name. */
  label: React.ReactNode
  active?: boolean
  /** A count badge (number) or an attention dot (`true`). */
  badge?: number | boolean
}

/**
 * One destination. Pass your router's link with `render={<Link href="…" />}`. The item has no
 * corners of its own (it fills the bar edge to edge, often inside a rounded screen); hover, press
 * and the keyboard focus ring all sit on the round icon pill.
 */
function TabBarItem({ icon, label, active = false, badge, render, className, ...props }: TabBarItemProps) {
  const { labels } = useLocale()
  const showBadge = badge !== undefined && badge !== false && badge !== 0
  return useRender({
    defaultTagName: "button",
    render,
    props: mergeProps<"button">(
      {
        type: render ? undefined : "button",
        "aria-current": active ? "page" : undefined,
        className: cn(
          "group/tab flex h-14 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-muted-foreground outline-none transition-colors duration-150 select-none data-active:text-foreground [-webkit-tap-highlight-color:transparent]",
          className
        ),
        children: (
          <>
            <span
              data-slot="tab-bar-icon"
              className="relative flex h-7 w-12 items-center justify-center rounded-full transition-[box-shadow,background-color] duration-150 group-hover/tab:bg-secondary group-focus-visible/tab:ring-2 group-focus-visible/tab:ring-ring/50 group-active/tab:bg-foreground/10 [&_svg]:size-5 [&_svg]:shrink-0"
            >
              {icon}
              {showBadge && (
                <span
                  data-slot="tab-bar-badge"
                  className={cn(
                    "absolute top-0.5 left-[calc(50%+0.375rem)] flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background",
                    badge === true ? "size-2" : "h-3.5 min-w-3.5 px-1 text-ui-2xs font-semibold tabular-nums"
                  )}
                >
                  {badge === true ? <span className="sr-only">{labels.newActivity}</span> : (badge as number) > 99 ? "99+" : badge}
                </span>
              )}
            </span>
            <span data-slot="tab-bar-label" className="max-w-full truncate px-1 text-ui-2xs font-medium">
              {label}
            </span>
          </>
        ),
      },
      props
    ),
    state: { slot: "tab-bar-item", active },
  })
}

export { TabBar, TabBarItem, type TabBarItemProps }
