import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A vertical schedule: a time column, a dot on a hairline, the content and an optional trailing
 * action per entry.
 *
 *   <Timeline>
 *     <TimelineItem time="09:00" action={<Button size="xs" variant="ghost">Delete</Button>}>
 *       <TimelineTitle>Daily digest</TimelineTitle>
 *       <TimelineDescription>Every weekday</TimelineDescription>
 *     </TimelineItem>
 *   </Timeline>
 */
function Timeline({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol data-slot="timeline" className={cn("flex min-w-0 flex-col", className)} {...props} />
}

type TimelineTone = "default" | "primary" | "success" | "warning" | "destructive"

const DOT_TONE: Record<TimelineTone, string> = {
  default: "bg-muted-foreground/48",
  primary: "bg-primary ring-4 ring-primary/16",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
}

type TimelineItemProps = Omit<React.ComponentProps<"li">, "title"> & {
  /** Text in the time column ("09:00", "Mon"). Leave it out on every item to drop the column. */
  time?: React.ReactNode
  /** A quieter second line under the time, such as a date. */
  timeDetail?: React.ReactNode
  /** Dot colour; `primary` marks the current or next entry. */
  tone?: TimelineTone
  /** Trailing control (a menu, a delete button), aligned with the first line. */
  action?: React.ReactNode
}

/** One entry. Children are its content: a title and description, or a card. */
function TimelineItem({ time, timeDetail, tone = "default", action, className, children, ...props }: TimelineItemProps) {
  const hasTime = time != null && time !== false
  const hasAction = action != null && action !== false
  return (
    <li
      data-slot="timeline-item"
      data-tone={tone}
      className={cn(
        "group/timeline-item grid min-w-0 gap-x-3",
        hasTime
          ? hasAction
            ? "grid-cols-[var(--timeline-time,3.5rem)_0.5rem_minmax(0,1fr)_auto]"
            : "grid-cols-[var(--timeline-time,3.5rem)_0.5rem_minmax(0,1fr)]"
          : hasAction
            ? "grid-cols-[0.5rem_minmax(0,1fr)_auto]"
            : "grid-cols-[0.5rem_minmax(0,1fr)]",
        className
      )}
      {...props}
    >
      {hasTime && (
        <div data-slot="timeline-time" className="flex min-w-0 flex-col items-end pt-px text-end">
          <span className="text-ui-sm leading-5 text-muted-foreground tabular-nums">{time}</span>
          {timeDetail != null && timeDetail !== false && <span className="text-ui-xs text-muted-foreground/72 tabular-nums">{timeDetail}</span>}
        </div>
      )}
      {/* The hairline runs from this dot to the next one; it starts at the first dot and stops at the last. */}
      <div aria-hidden data-slot="timeline-rail" className="relative flex justify-center">
        <span className="absolute top-0 bottom-0 w-px bg-border group-first/timeline-item:top-2.5 group-last/timeline-item:bottom-auto group-last/timeline-item:h-2.5 group-only/timeline-item:hidden" />
        <span data-slot="timeline-dot" className={cn("relative mt-1.75 size-2 shrink-0 rounded-full", DOT_TONE[tone])} />
      </div>
      <div data-slot="timeline-content" className="flex min-w-0 flex-col gap-0.5 pb-5 group-last/timeline-item:pb-0">
        {children}
      </div>
      {hasAction && (
        <div data-slot="timeline-action" className="flex h-5 items-center">
          {action}
        </div>
      )}
    </li>
  )
}

function TimelineTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="timeline-title" className={cn("text-ui leading-5 font-medium", className)} {...props} />
}

function TimelineDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="timeline-description" className={cn("text-ui-sm text-pretty text-muted-foreground", className)} {...props} />
}

export { Timeline, TimelineItem, TimelineTitle, TimelineDescription, type TimelineItemProps, type TimelineTone }
