import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import {
  BoltIcon,
  ChevronRightIcon,
  EditIcon,
  FileIcon,
  GlobeIcon,
  LightbulbIcon,
  SearchIcon,
  TerminalIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons"
import { cn } from "@/lib/utils"
import { Loader } from "@/ui/loader"
import { TextShimmer } from "@/ui/text-shimmer"

const EASE = [0.22, 1, 0.36, 1] as const

/** Matches ACP's `ToolKind`, so tool calls map straight onto steps. */
type WorkStepKind = "read" | "edit" | "delete" | "move" | "search" | "execute" | "think" | "fetch" | "switch_mode" | "other"
type WorkStepStatus = "pending" | "in_progress" | "completed" | "failed"

const KIND_ICON: Record<WorkStepKind, React.ComponentType<{ className?: string }>> = {
  read: FileIcon,
  edit: EditIcon,
  delete: TrashIcon,
  move: FileIcon,
  search: SearchIcon,
  execute: TerminalIcon,
  think: LightbulbIcon,
  fetch: GlobeIcon,
  switch_mode: BoltIcon,
  other: BoltIcon,
}

/** "25s", "6m 34s", "1h 2m". */
function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/** Seconds since `startedAt` (ms), ticking once a second while `running`. */
function useElapsed(startedAt: number | undefined, running: boolean) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [running])
  return startedAt === undefined ? 0 : (now - startedAt) / 1000
}

type WorkSummaryProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** Seconds the turn took. While `running`, pass `startedAt` instead to tick live. */
  duration?: number
  /** Epoch ms the work started, for the live "Working for 12s" label. */
  startedAt?: number
  running?: boolean
  /** Replace the "Worked for …" label entirely. */
  label?: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Collapsible log of what an agent did in a turn ("Worked for
 * 25s" row): a quiet header with the elapsed time, opening to the step list.
 * While running the label shimmers and counts up.
 */
function WorkSummary({
  duration,
  startedAt,
  running = false,
  label,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  children,
  ...props
}: WorkSummaryProps) {
  const reduce = useReducedMotion()
  const [openState, setOpenState] = React.useState(defaultOpen)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next)
    onOpenChange?.(next)
  }
  const elapsed = useElapsed(startedAt, running)
  const seconds = running ? elapsed : (duration ?? elapsed)
  const panelId = React.useId()
  const text = label ?? (running ? `Working for ${formatDuration(seconds)}` : `Worked for ${formatDuration(seconds)}`)
  const hasSteps = React.Children.count(children) > 0

  return (
    <div data-slot="work-summary" data-open={open || undefined} data-running={running || undefined} className={cn("flex flex-col", className)} {...props}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={!hasSteps}
        onClick={() => setOpen(!open)}
        className="group/ws -mx-1 flex h-6 w-fit cursor-pointer items-center gap-1 rounded-md px-1 text-ui text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default"
      >
        {running ? <TextShimmer className="tabular-nums">{text}</TextShimmer> : <span className="tabular-nums">{text}</span>}
        {hasSteps && (
          <ChevronRightIcon
            className={cn(
              "size-3.5 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              open && "rotate-90"
            )}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && hasSteps && (
          <motion.div
            id={panelId}
            key="steps"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <ol data-slot="work-summary-steps" className="mt-1 flex flex-col gap-0.5 border-l border-border pl-3">
              {children}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type WorkSummaryStepProps = Omit<React.ComponentProps<"li">, "title"> & {
  kind?: WorkStepKind
  title: React.ReactNode
  /** Short muted detail after the title: a path, a command, a match count. */
  detail?: React.ReactNode
  status?: WorkStepStatus
  /** Custom leading icon (overrides the kind's icon). */
  icon?: React.ReactNode
}

/** One step: kind icon (spinner while in progress, ✕ when failed), title and a muted detail. Children render under it (output, a diff). */
function WorkSummaryStep({ kind = "other", title, detail, status = "completed", icon, className, children, ...props }: WorkSummaryStepProps) {
  const Icon = KIND_ICON[kind] ?? BoltIcon
  return (
    <li data-slot="work-summary-step" data-status={status} className={cn("flex min-w-0 flex-col gap-1 py-0.5", className)} {...props}>
      <div className="flex min-w-0 items-center gap-2 text-ui text-muted-foreground">
        <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-3.5">
          {status === "in_progress" ? (
            <Loader variant="ring" size="sm" label="In progress" className="size-3.5 text-primary" />
          ) : status === "failed" ? (
            <XIcon className="text-destructive" />
          ) : (
            (icon ?? <Icon />)
          )}
        </span>
        <span className={cn("min-w-0 shrink-0 truncate", status === "pending" ? "opacity-64" : "text-foreground/80")}>{title}</span>
        {detail && <span className="min-w-0 truncate font-mono text-ui-sm">{detail}</span>}
      </div>
      {children && <div className="min-w-0 pl-6">{children}</div>}
    </li>
  )
}

export { WorkSummary, WorkSummaryStep, formatDuration, type WorkSummaryProps, type WorkSummaryStepProps, type WorkStepKind, type WorkStepStatus }
