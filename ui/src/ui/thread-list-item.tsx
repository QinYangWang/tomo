"use client"

import * as React from "react"

import { FolderIcon, GitBranchIcon, GitPullRequestIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Loader } from "@/ui/loader"
import { useLocale } from "@/ui/locale-provider"

type PullRequestStatus = "open" | "draft" | "merged" | "closed"

const PR_TONE: Record<PullRequestStatus, string> = {
  open: "text-success",
  draft: "text-muted-foreground",
  merged: "text-chart-3",
  closed: "text-destructive",
}

/** A list of threads (agent chats). Group rows with `ThreadListGroup`. */
function ThreadList({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="thread-list" role="list" className={cn("flex flex-col gap-3", className)} {...props} />
}

type ThreadListGroupProps = React.ComponentProps<"div"> & { label: React.ReactNode; action?: React.ReactNode }

/** Labelled section of rows: "Recent", "Today", "Yesterday". */
function ThreadListGroup({ label, action, className, children, ...props }: ThreadListGroupProps) {
  const id = React.useId()
  return (
    <div data-slot="thread-list-group" role="group" aria-labelledby={id} className={cn("flex flex-col gap-px", className)} {...props}>
      <div className="flex h-7 items-center justify-between px-2">
        <span id={id} className="text-ui-sm text-muted-foreground">
          {label}
        </span>
        {action}
      </div>
      {children}
    </div>
  )
}

type ThreadListItemProps = Omit<React.ComponentProps<"button">, "title"> & {
  title: React.ReactNode
  /** Provider / agent glyph shown before the title. */
  icon?: React.ReactNode
  /** Repository or project name. */
  repo?: string
  /** Linked pull request; its number takes the status colour. */
  pr?: { number: number; status: PullRequestStatus }
  branch?: string
  active?: boolean
  /** Agent is working: the icon becomes a spinner. */
  running?: boolean
  /** New activity since last opened: a dot after the title. */
  unread?: boolean
  /** Trailing content inside the row button. Put interactive controls in `actions` instead. */
  trailing?: React.ReactNode
  /** Free second line (a subtitle, a brief); truncates. Shown above `repo` / `pr` / `branch`. */
  description?: React.ReactNode
  /** Quiet text at the end of the title line, such as a relative time. `actions` replace it on hover. */
  meta?: React.ReactNode
  /**
   * Controls for the row (a "⋯" menu), placed over its end outside the row button. Shown on hover,
   * keyboard focus, while active or while a menu they opened is open; always shown on touch screens.
   */
  actions?: React.ReactNode
}

/**
 * Two-line thread row: provider icon and title, then a description or the
 * repo, pull request number in its status colour, and branch, all truncating
 * so the branch gives way first. With `actions` the row becomes a list item
 * holding the row button and the actions side by side, so no button nests in another.
 */
function ThreadListItem({
  title,
  icon,
  repo,
  pr,
  branch,
  active = false,
  running = false,
  unread = false,
  trailing,
  description,
  meta,
  actions,
  className,
  ...props
}: ThreadListItemProps) {
  const { labels } = useLocale()
  const refs = repo || pr || branch
  const hasActions = actions != null && actions !== false
  const row = (
    <button
      type="button"
      role={hasActions ? undefined : "listitem"}
      data-slot={hasActions ? "thread-list-item-button" : "thread-list-item"}
      data-active={active || undefined}
      data-running={running || undefined}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group/thread flex w-full min-w-0 cursor-pointer flex-col gap-0.5 rounded-inner px-2 py-1.5 text-left outline-none transition-colors duration-150 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50 data-active:bg-foreground/6",
        // Room for the actions: always without `meta`, on touch screens (actions stay visible) with it.
        hasActions && (meta != null && meta !== false ? "pointer-coarse:pe-9" : "pe-9"),
        hasActions && "group-hover/thread-item:bg-secondary group-data-active/thread-item:bg-foreground/6",
        !hasActions && className
      )}
      {...props}
    >
      <span className="flex w-full min-w-0 items-center gap-2">
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground group-data-active/thread:text-foreground [&_svg]:size-3.5">
          {running ? <Loader variant="ring" size="sm" label={labels.working} className="size-3.5 text-primary" /> : icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-ui text-foreground/90 group-data-active/thread:text-foreground">{title}</span>
        {unread && <span role="img" aria-label={labels.unread} className="size-1.5 shrink-0 rounded-full bg-primary" />}
        {meta != null && meta !== false && (
          <span
            data-slot="thread-list-item-meta"
            className={cn(
              "shrink-0 text-ui-xs text-muted-foreground tabular-nums transition-opacity duration-150",
              hasActions && "min-w-7 text-end",
              hasActions &&
                "pointer-fine:group-hover/thread-item:opacity-0 pointer-fine:group-focus-within/thread-item:opacity-0 pointer-fine:group-data-active/thread-item:opacity-0 pointer-fine:group-has-[[data-popup-open]]/thread-item:opacity-0"
            )}
          >
            {meta}
          </span>
        )}
        {trailing}
      </span>
      {description != null && description !== false && (
        <span data-slot="thread-list-item-description" className="w-full min-w-0 truncate pl-6 text-ui-xs text-muted-foreground">
          {description}
        </span>
      )}
      {refs && (
        <span className="flex w-full min-w-0 items-center gap-2.5 pl-6 text-ui-xs text-muted-foreground">
          {repo && (
            <span className="flex min-w-0 shrink items-center gap-1">
              <FolderIcon className="size-3 shrink-0" />
              <span className="truncate">{repo}</span>
            </span>
          )}
          {pr && (
            <span className={cn("flex shrink-0 items-center gap-1 tabular-nums", PR_TONE[pr.status])}>
              <GitPullRequestIcon className="size-3" />#{pr.number}
              <span className="sr-only">({pr.status})</span>
            </span>
          )}
          {branch && (
            <span className="flex min-w-0 flex-1 items-center gap-1">
              <GitBranchIcon className="size-3 shrink-0" />
              <span className="truncate">{branch}</span>
            </span>
          )}
        </span>
      )}
    </button>
  )
  if (!hasActions) return row
  return (
    <div
      role="listitem"
      data-slot="thread-list-item"
      data-active={active || undefined}
      data-running={running || undefined}
      className={cn("group/thread-item relative min-w-0", className)}
    >
      {row}
      <div
        data-slot="thread-list-item-actions"
        className="absolute end-1 top-1 flex h-6 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/thread-item:opacity-100 group-focus-within/thread-item:opacity-100 group-data-active/thread-item:opacity-100 group-has-[[data-popup-open]]/thread-item:opacity-100 pointer-coarse:opacity-100"
      >
        {actions}
      </div>
    </div>
  )
}

export { ThreadList, ThreadListGroup, ThreadListItem, type ThreadListItemProps, type ThreadListGroupProps, type PullRequestStatus }
