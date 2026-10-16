"use client"

import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { motion, useReducedMotion } from "motion/react"
import { createHighlighterCore, type HighlighterCore, type LanguageInput } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"

import {
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  CopyIcon,
  GlobeIcon,
  LoaderIcon,
  RefreshIcon,
  StopIcon,
  TerminalIcon,
  XCircleIcon,
} from "@/components/icons"
import { cn } from "@/lib/utils"
import { ActionSwapRollText } from "@/ui/action-swap-roll"
import { IconChip } from "@/ui/icon-chip"
import { useLocale, type LocaleLabels } from "@/ui/locale-provider"

/* -------------------------------------------------------------------------- */
/* Shared agent helpers (also used by tool-approval, streaming-response,      */
/* agent-activity).                                                            */
/* -------------------------------------------------------------------------- */

const AGENT_EASE = [0.22, 1, 0.36, 1] as const

type CodeLanguage = "bash" | "json" | "diff" | "tsx" | "typescript" | "yaml" | "python" | "text"

const LIGHT_THEME = "github-light-default"
const DARK_THEME = "github-dark-default"

// Only these grammars and the two themes reach the bundle, each as its own chunk loaded on first use.
const LANG_LOADERS: Record<Exclude<CodeLanguage, "text">, () => LanguageInput> = {
  bash: () => import("shiki/langs/bash.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  python: () => import("shiki/langs/python.mjs"),
}

type CodeToken = { content: string; light?: string; dark?: string }

let highlighterPromise: Promise<HighlighterCore> | null = null
const langPromises = new Map<string, Promise<void>>()
const tokenCache = new Map<string, CodeToken[][]>()

/** The shared highlighter, with `language` loaded. */
async function getHighlighter(language: Exclude<CodeLanguage, "text">) {
  highlighterPromise ??= createHighlighterCore({
    themes: [import("shiki/themes/github-light-default.mjs"), import("shiki/themes/github-dark-default.mjs")],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  })
  const highlighter = await highlighterPromise
  if (!langPromises.has(language)) langPromises.set(language, highlighter.loadLanguage(LANG_LOADERS[language]()))
  await langPromises.get(language)
  return highlighter
}

/**
 * Highlighter tokens for `code`, loaded lazily on the client. While a new chunk is
 * being highlighted the previous lines keep their colours, so streamed output
 * never flashes back to plain text.
 */
function useCodeTokens(code: string, language: CodeLanguage) {
  const key = `${language}\u0000${code}`
  const [state, setState] = React.useState<{ key: string; lines: CodeToken[][] } | null>(() => {
    const cached = tokenCache.get(key)
    return cached ? { key, lines: cached } : null
  })

  React.useEffect(() => {
    if (language === "text") return
    const cached = tokenCache.get(key)
    if (cached) {
      setState({ key, lines: cached })
      return
    }
    let cancelled = false
    getHighlighter(language)
      .then((highlighter) => {
        if (cancelled) return
        const lines = highlighter
          .codeToTokensWithThemes(code, { lang: language, themes: { light: LIGHT_THEME, dark: DARK_THEME } })
          .map((line) =>
            line.map((token) => ({
              content: token.content,
              light: token.variants.light?.color,
              dark: token.variants.dark?.color,
            }))
          )
        if (tokenCache.size > 200) tokenCache.clear()
        tokenCache.set(key, lines)
        setState({ key, lines })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [code, key, language])

  return language === "text" ? null : (state?.lines ?? null)
}

type CodeHighlightProps = Omit<React.ComponentProps<"pre">, "children"> & {
  code: string
  language?: CodeLanguage
  /** Wrap long lines instead of scrolling horizontally. */
  wrap?: boolean
}

/** Lightweight dual-theme (light/dark) syntax highlight for agent output. */
function CodeHighlight({ code, language = "bash", wrap = false, className, ...props }: CodeHighlightProps) {
  const tokens = useCodeTokens(code, language)
  const lines = code.split("\n")

  return (
    <pre
      data-slot="code-highlight"
      className={cn(
        "m-0 font-mono text-ui-sm leading-5 text-foreground/85",
        wrap ? "break-words whitespace-pre-wrap" : "overflow-x-auto whitespace-pre scrollbar-thin",
        className
      )}
      {...props}
    >
      <code>
        {lines.map((line, i) => {
          const lineTokens = tokens?.[i]
          // Only trust tokens that still describe this exact line (streaming may have grown it).
          const valid = lineTokens && lineTokens.map((t) => t.content).join("") === line
          return (
            <React.Fragment key={i}>
              {valid
                ? lineTokens.map((t, j) => (
                    <span
                      key={j}
                      style={{ "--code-l": t.light, "--code-d": t.dark ?? t.light } as React.CSSProperties}
                      className="text-(--code-l) dark:text-(--code-d)"
                    >
                      {t.content}
                    </span>
                  ))
                : line}
              {i < lines.length - 1 ? "\n" : null}
            </React.Fragment>
          )
        })}
      </code>
    </pre>
  )
}

/** Clipboard helper with a short-lived "copied" flag. */
function useCopyToClipboard(timeout = 1600) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = React.useCallback(
    async (value: string | (() => void | Promise<void>)) => {
      try {
        if (typeof value === "function") await value()
        else await navigator.clipboard?.writeText(value)
      } catch {
        return
      }
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), timeout)
    },
    [timeout]
  )
  return { copied, copy }
}

/** Seconds elapsed while `active` is true; freezes when it turns false. */
function useElapsed(active: boolean) {
  const [elapsed, setElapsed] = React.useState(0)
  React.useEffect(() => {
    if (!active) return
    const start = performance.now() - elapsed * 1000
    const id = window.setInterval(() => setElapsed((performance.now() - start) / 1000), 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
  return elapsed
}

/** Formats seconds as `420ms`, `2.4s` or `1m 05s`. */
function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0s"
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${String(s).padStart(2, "0")}s`
}

/** Controlled-or-uncontrolled boolean state. */
function useControllableOpen(open: boolean | undefined, defaultOpen: boolean, onOpenChange?: (open: boolean) => void) {
  const [internal, setInternal] = React.useState(defaultOpen)
  const current = open ?? internal
  const onChangeRef = React.useRef(onOpenChange)
  onChangeRef.current = onOpenChange
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (open === undefined) setInternal(next)
      onChangeRef.current?.(next)
    },
    [open]
  )
  return [current, setOpen] as const
}

/** Small ghost icon button for agent surfaces (copy, retry, feedback). */
function AgentIconButton({ className, label, pressed, ...props }: React.ComponentProps<"button"> & { label: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      data-slot="agent-icon-button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        "inline-grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-[background-color,color,box-shadow,scale] duration-150 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-muted aria-pressed:text-foreground aria-pressed:shadow-chip [&_svg]:size-3.5",
        className
      )}
      {...props}
    />
  )
}

/** Copy action that flips to a check for a moment. */
function AgentCopyButton({
  value,
  label,
  className,
}: {
  value: string | (() => void | Promise<void>)
  label?: string
  className?: string
}) {
  const { labels } = useLocale()
  const { copied, copy } = useCopyToClipboard()
  return (
    <AgentIconButton label={copied ? labels.copied : (label ?? labels.copy)} onClick={() => copy(value)} className={className}>
      <span className="relative grid size-3.5 place-items-center">
        <CopyIcon
          className={cn(
            "absolute transition-[opacity,scale] duration-200",
            copied ? "scale-50 opacity-0" : "scale-100 opacity-100"
          )}
        />
        <CheckIcon
          className={cn(
            "absolute text-success transition-[opacity,scale] duration-200",
            copied ? "scale-100 opacity-100" : "scale-50 opacity-0"
          )}
        />
      </span>
    </AgentIconButton>
  )
}

/* -------------------------------------------------------------------------- */
/* ToolResult                                                                  */
/* -------------------------------------------------------------------------- */

type ToolResultStatus = "running" | "success" | "error" | "cancelled"
type ToolResultKind = "terminal" | "request" | "custom"

const STATUS_LABEL: Record<ToolResultStatus, keyof LocaleLabels> = {
  running: "toolRunning",
  success: "toolDone",
  error: "toolFailed",
  cancelled: "toolCancelled",
}

const STATUS_TONE: Record<ToolResultStatus, string> = {
  running: "text-primary",
  success: "text-success",
  error: "text-destructive",
  cancelled: "text-muted-foreground",
}

function ToolStatusIcon({ status, className }: { status: ToolResultStatus; className?: string }) {
  const cls = cn("size-3.5", className)
  if (status === "running") return <LoaderIcon className={cn(cls, "animate-spin motion-reduce:animate-none")} />
  if (status === "success") return <CheckCircleIcon className={cls} />
  if (status === "error") return <XCircleIcon className={cls} />
  return <StopIcon className={cls} />
}

const KIND_ICON: Record<ToolResultKind, React.ComponentType<{ className?: string }>> = {
  terminal: TerminalIcon,
  request: GlobeIcon,
  custom: CodeIcon,
}

type ToolResultProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** Tool identifier shown in mono, e.g. `bash` or `http.get`. */
  tool: React.ReactNode
  /** What the call does, e.g. `Run test suite`. */
  title: React.ReactNode
  status?: ToolResultStatus
  kind?: ToolResultKind
  /**
   * Final duration in seconds. While running, elapsed time ticks on its own;
   * when the call never ran in this mount and this is unset, no duration shows.
   */
  duration?: number
  /** Extra header text such as an exit code. */
  meta?: React.ReactNode
  icon?: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Collapse to the compact header once a run finishes. */
  collapseOnComplete?: boolean
  /** Max height of the output well before it scrolls (px). */
  maxHeight?: number
  /** Text (or handler) for the copy action; omit to hide it. */
  copyText?: string | (() => void | Promise<void>)
  onRetry?: () => void
  contentClassName?: string
}

/**
 * Execution disclosure for an agent tool call: a compact header row with live
 * status and duration that opens onto the call's output (terminal log or
 * request/response). Opens while running and folds away when it completes.
 */
function ToolResult({
  tool,
  title,
  status = "running",
  kind = "custom",
  duration,
  meta,
  icon,
  open,
  defaultOpen = true,
  onOpenChange,
  collapseOnComplete = true,
  maxHeight = 240,
  copyText,
  onRetry,
  className,
  contentClassName,
  children,
  ...props
}: ToolResultProps) {
  const reduce = useReducedMotion()
  const { labels } = useLocale()
  const statusLabel = labels[STATUS_LABEL[status]] as string
  const running = status === "running"
  const [isOpen, setOpen] = useControllableOpen(open, defaultOpen, onOpenChange)
  const elapsed = useElapsed(running)
  const shownDuration = duration ?? elapsed
  // Nothing to show for a call that never ran here and has no `duration`.
  const showDuration = duration != null || running || elapsed > 0
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const prevStatus = React.useRef(status)
  const KindIcon = KIND_ICON[kind]

  React.useEffect(() => {
    const prev = prevStatus.current
    prevStatus.current = status
    if (prev !== "running" && status === "running") setOpen(true)
    if (prev === "running" && status !== "running" && collapseOnComplete && status === "success") setOpen(false)
  }, [status, collapseOnComplete, setOpen])

  // Follow the tail of the log while it is streaming.
  React.useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el || !running || !isOpen) return
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" })
  })

  return (
    <CollapsiblePrimitive.Root
      data-slot="tool-result"
      data-status={status}
      open={isOpen}
      onOpenChange={(next) => setOpen(next)}
      aria-busy={running}
      {...props}
      className={cn(
        "w-full overflow-hidden frame-3xl frame-inset-2 bg-card text-ui text-card-foreground shadow-raised",
        className
      )}
    >
      <CollapsiblePrimitive.Trigger
        data-slot="tool-result-trigger"
        className="group/tool-result flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <IconChip size="sm" tone={status === "error" ? "destructive" : "neutral"}>
          {icon ?? <KindIcon />}
        </IconChip>
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="min-w-0 truncate font-medium">{title}</span>
          <span className="hidden min-w-0 shrink truncate font-mono text-ui-xs text-muted-foreground sm:inline">{tool}</span>
        </span>
        {meta ? <span className="shrink-0 font-mono text-ui-xs text-muted-foreground">{meta}</span> : null}
        {showDuration ? (
          <span className="shrink-0 font-mono text-ui-xs text-muted-foreground tabular-nums">
            {formatDuration(shownDuration)}
          </span>
        ) : null}
        <span
          role="status"
          className={cn("inline-flex shrink-0 items-center gap-1 text-ui-sm font-medium", STATUS_TONE[status])}
        >
          <ToolStatusIcon status={status} />
          <ActionSwapRollText value={status}>{statusLabel}</ActionSwapRollText>
        </span>
        <ChevronDownIcon
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-panel-open/tool-result:rotate-180 motion-reduce:transition-none"
        />
      </CollapsiblePrimitive.Trigger>

      <CollapsiblePrimitive.Panel
        data-slot="tool-result-panel"
        className="h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none"
      >
        <div className="px-2 pb-2">
          <div className="overflow-hidden rounded-inner bg-code shadow-well">
            <div
              ref={viewportRef}
              role="log"
              aria-live={running ? "polite" : "off"}
              className="overflow-y-auto scrollbar-thin"
              style={{ maxHeight }}
            >
              <div className={cn("p-3", contentClassName)}>{children}</div>
            </div>
            {copyText || onRetry ? (
              <div className="flex items-center gap-0.5 border-t border-border/60 px-1.5 py-1">
                {copyText ? <AgentCopyButton value={copyText} label={labels.copyOutput} /> : null}
                {onRetry ? (
                  <AgentIconButton label={labels.runAgain} onClick={onRetry} disabled={running}>
                    <RefreshIcon />
                  </AgentIconButton>
                ) : null}
                <span className="ml-auto pr-1.5 text-ui-xs text-muted-foreground">
                  {running ? labels.streamingOutput : labels.finishedIn(statusLabel, formatDuration(shownDuration))}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
  )
}

/** Highlighted output body for a ToolResult (wraps long lines). */
function ToolResultOutput({
  children,
  language = "bash",
  className,
}: {
  children: string
  language?: CodeLanguage
  className?: string
}) {
  return <CodeHighlight data-slot="tool-result-output" code={children} language={language} wrap className={className} />
}

const METHOD_TONE: Record<string, string> = {
  GET: "bg-primary/14 text-primary",
  POST: "bg-success/12 text-success",
  PUT: "bg-warning/14 text-warning",
  PATCH: "bg-warning/14 text-warning",
  DELETE: "bg-destructive/12 text-destructive",
}

/** Request line plus response body, for `kind="request"` results. */
function ToolResultRequest({
  method = "GET",
  url,
  statusCode,
  statusText,
  body,
  language = "json",
  className,
}: {
  method?: string
  url: string
  statusCode?: number
  statusText?: string
  body?: string
  language?: CodeLanguage
  className?: string
}) {
  const ok = statusCode != null && statusCode < 400
  return (
    <div data-slot="tool-result-request" className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex min-w-0 items-center gap-2 font-mono text-ui-sm">
        <span className={cn("rounded-md px-1.5 py-0.5 text-ui-2xs font-semibold", METHOD_TONE[method.toUpperCase()] ?? "bg-muted text-muted-foreground")}>
          {method.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-foreground/85">{url}</span>
        {statusCode != null ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: AGENT_EASE }}
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-ui-2xs font-semibold",
              ok ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive"
            )}
          >
            {statusCode}
            {statusText ? ` ${statusText}` : null}
          </motion.span>
        ) : null}
      </div>
      {body ? <CodeHighlight code={body} language={language} wrap /> : null}
    </div>
  )
}

export {
  ToolResult,
  ToolResultOutput,
  ToolResultRequest,
  ToolStatusIcon,
  CodeHighlight,
  AgentIconButton,
  AgentCopyButton,
  useCodeTokens,
  useCopyToClipboard,
  useElapsed,
  useControllableOpen,
  formatDuration,
  AGENT_EASE,
  type ToolResultProps,
  type ToolResultStatus,
  type ToolResultKind,
  type CodeLanguage,
  type CodeHighlightProps,
}
