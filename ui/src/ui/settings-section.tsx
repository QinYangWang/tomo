import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import { cn } from "@/lib/utils"

/*
 * Settings pages in the native desktop shape: a section title, then a grouped
 * card of rows (label + help on the left, control on the right) split by
 * hairlines, with an optional footer band for Save. A sub-nav moves between
 * pages.
 *
 *   <SettingsSection>
 *     <SettingsSectionHeader>
 *       <SettingsSectionTitle>Notifications</SettingsSectionTitle>
 *       <SettingsSectionDescription>Choose what reaches your inbox.</SettingsSectionDescription>
 *     </SettingsSectionHeader>
 *     <SettingsGroup>
 *       <SettingsRow>
 *         <SettingsRowText>
 *           <SettingsRowTitle>Weekly digest</SettingsRowTitle>
 *           <SettingsRowDescription>Every Monday at 9:00.</SettingsRowDescription>
 *         </SettingsRowText>
 *         <Switch />
 *       </SettingsRow>
 *       <SettingsGroupFooter><Button size="sm">Save</Button></SettingsGroupFooter>
 *     </SettingsGroup>
 *   </SettingsSection>
 */

function SettingsSection({ className, ...props }: React.ComponentProps<"section">) {
  return <section data-slot="settings-section" className={cn("flex min-w-0 flex-col gap-3", className)} {...props} />
}

function SettingsSectionHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="settings-section-header" className={cn("flex flex-col gap-1 px-1", className)} {...props} />
}

function SettingsSectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="settings-section-title" className={cn("text-ui-lg font-semibold", className)} {...props} />
}

function SettingsSectionDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="settings-section-description" className={cn("text-ui text-pretty text-muted-foreground", className)} {...props} />
}

/** The grouped card. `tone="destructive"` frames a danger zone. */
function SettingsGroup({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"div"> & { tone?: "default" | "destructive" }) {
  return (
    <div
      data-slot="settings-group"
      data-tone={tone}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-card text-ui text-card-foreground shadow-raised",
        tone === "destructive" && "ring-1 ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

/** One setting. Wraps the control under the text below `sm`. A `<label>` via `render` makes the whole row toggle its control. */
function SettingsRow({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          "flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 not-first:border-t not-first:border-border",
          className
        ),
      },
      props
    ),
    state: { slot: "settings-row" },
  })
}

function SettingsRowText({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="settings-row-text" className={cn("flex min-w-0 flex-1 basis-56 flex-col gap-0.5", className)} {...props} />
}

function SettingsRowTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="settings-row-title" className={cn("text-ui font-medium", className)} {...props} />
}

function SettingsRowDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="settings-row-description" className={cn("text-ui-sm text-pretty text-muted-foreground", className)} {...props} />
}

/** Holds the row's control(s); stays at its natural width. */
function SettingsRowControl({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="settings-row-control" className={cn("flex shrink-0 items-center gap-2", className)} {...props} />
}

/** A band under the rows for a note and the Save / Cancel actions. */
function SettingsGroupFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-group-footer"
      className={cn(
        "flex min-h-12 flex-wrap items-center justify-end gap-2 border-t border-border bg-muted px-4 py-2.5 text-ui-sm text-muted-foreground has-data-[slot=settings-footer-note]:justify-between",
        className
      )}
      {...props}
    />
  )
}

function SettingsFooterNote({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="settings-footer-note" className={cn("min-w-0 text-ui-sm text-muted-foreground", className)} {...props} />
}

/* ───────────────────────── Sub-nav ───────────────────────── */

/** Vertical list of settings pages (a horizontal, scrolling strip below `md`). */
function SettingsNav({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="settings-nav"
      className={cn(
        "flex min-w-0 gap-0.5 overflow-x-auto scrollbar-none max-md:-mx-1 max-md:px-1 md:flex-col md:overflow-visible",
        className
      )}
      {...props}
    />
  )
}

type SettingsNavItemProps = useRender.ComponentProps<"a"> & {
  isActive?: boolean
  icon?: React.ReactNode
}

/** A page link. Pass your router's link with `render={<Link href="…" />}`. */
function SettingsNavItem({ isActive = false, icon, render, className, children, ...props }: SettingsNavItemProps) {
  return useRender({
    defaultTagName: "a",
    render,
    props: mergeProps<"a">(
      {
        "aria-current": isActive ? "page" : undefined,
        className: cn(
          "flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-ui whitespace-nowrap text-foreground/80 outline-none transition-[background-color,color] duration-150 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0",
          isActive && "bg-foreground/6 text-foreground hover:bg-foreground/6",
          className
        ),
        children: (
          <>
            {icon && (
              <span aria-hidden className={cn("flex text-muted-foreground", isActive && "text-foreground")}>
                {icon}
              </span>
            )}
            {children}
          </>
        ),
      },
      props
    ),
    state: { slot: "settings-nav-item", active: isActive },
  })
}

export {
  SettingsSection,
  SettingsSectionHeader,
  SettingsSectionTitle,
  SettingsSectionDescription,
  SettingsGroup,
  SettingsRow,
  SettingsRowText,
  SettingsRowTitle,
  SettingsRowDescription,
  SettingsRowControl,
  SettingsGroupFooter,
  SettingsFooterNote,
  SettingsNav,
  SettingsNavItem,
}
export type { SettingsNavItemProps }
