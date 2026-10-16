"use client"

import * as React from "react"

import { FolderIcon, GitBranchIcon, GitPullRequestIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Loader } from "@/ui/loader"

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
  /** Trailing content on the title line (a time, a menu that shows on hover). */
  trailing?: React.ReactNode
}

/**
 * Two-line thread row: provider icon and title, then
 * repo, pull request number in its status colour, and branch, all truncating
 * so the branch gives way first.
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
  className,
  ...props
}: ThreadListItemProps) {
  const meta = repo || pr || branch
  return (
    <button
      type="button"
      role="listitem"
      data-slot="thread-list-item"
      data-active={active || undefined}
      data-running={running || undefined}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group/thread flex w-full min-w-0 cursor-pointer flex-col gap-0.5 rounded-inner px-2 py-1.5 text-left outline-none transition-colors duration-150 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50 data-active:bg-foreground/6",
        className
      )}
      {...props}
    >
      <span className="flex w-full min-w-0 items-center gap-2">
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground group-data-active/thread:text-foreground [&_svg]:size-3.5">
          {running ? <Loader variant="ring" size="sm" label="Working" className="size-3.5 text-primary" /> : icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-ui text-foreground/90 group-data-active/thread:text-foreground">{title}</span>
        {unread && <span aria-label="Unread" className="size-1.5 shrink-0 rounded-full bg-primary" />}
        {trailing}
      </span>
      {meta && (
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
}

export { ThreadList, ThreadListGroup, ThreadListItem, type ThreadListItemProps, type ThreadListGroupProps, type PullRequestStatus }
