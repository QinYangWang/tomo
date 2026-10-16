import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { AlertCircleIcon, RefreshIcon, ThumbsDownIcon, ThumbsUpIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/ui/checkbox"
import { Citation, CitationGroup, Citations, type CitationSource } from "@/ui/citations"
import { useLocale } from "@/ui/locale-provider"
import {
  AGENT_EASE,
  AgentCopyButton,
  AgentIconButton,
  CodeHighlight,
  type CodeLanguage,
} from "@/ui/tool-result"

/* -------------------------------------------------------------------------- */
/* Tiny markdown-ish renderer: paragraphs, headings, lists (numbered lists    */
/* keep their first number, task items show a checkbox), fenced code, `code`, */
/* **bold**, *em*, [links](url), bare http(s) links and [n] citation markers. */
/* -------------------------------------------------------------------------- */

type ListItem = { text: string; checked?: boolean }

type Block =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ul" | "ol"; items: ListItem[]; start?: number }
  | { type: "code"; lang: string; code: string }

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") })
    para = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = line.match(/^```\s*([\w-]*)/)
    if (fence) {
      flush()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++])
      blocks.push({ type: "code", lang: fence[1] || "text", code: code.join("\n") })
      continue
    }
    const heading = line.match(/^#{1,4}\s+(.*)/)
    const bullet = line.match(/^\s*[-*+]\s+(.*)/)
    const numbered = line.match(/^\s*(\d{1,9})[.)]\s+(.*)/)
    if (heading) {
      flush()
      blocks.push({ type: "h", text: heading[1] })
    } else if (bullet || numbered) {
      flush()
      const kind = bullet ? "ul" : "ol"
      const last = blocks[blocks.length - 1]
      let item: ListItem = { text: bullet ? bullet[1] : numbered![2] }
      const task = item.text.match(/^\[([ xX])\]\s+(.*)/)
      if (task) item = { text: task[2], checked: task[1] !== " " }
      if (last && last.type === kind) last.items.push(item)
      else blocks.push({ type: kind, items: [item], start: numbered ? Number(numbered[1]) : undefined })
    } else if (!line.trim()) {
      flush()
    } else {
      para.push(line.trim())
    }
  }
  flush()
  return blocks
}

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\)|\[\d+\]|<https?:\/\/[^\s<>]+>|https?:\/\/[^\s<>]+)/g

/** Splits a bare URL from trailing punctuation the way GFM does (`.`, `,`, `?`, an unmatched `)`…). */
function trimUrl(raw: string): [string, string] {
  let url = raw
  for (;;) {
    const last = url.at(-1)
    if (last && /[.,:;!?'"*_~]/.test(last)) url = url.slice(0, -1)
    else if (last === ")" && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) url = url.slice(0, -1)
    else break
  }
  return [url, raw.slice(url.length)]
}

function renderInline(text: string, sources: CitationSource[] | undefined, keyBase: string): React.ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyBase}-${i}`
    if (!part) return null
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1)
      return (
        <code key={key}>
          {part.slice(1, -1)}
        </code>
      )
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return (
        <strong key={key}>
          {part.slice(2, -2)}
        </strong>
      )
    const cite = part.match(/^\[(\d+)\]$/)
    if (cite) {
      const n = Number(cite[1])
      const source = sources?.[n - 1]
      return source ? <Citation key={key} sourceId={source.id} /> : part
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (link)
      return (
        <a key={key} href={link[2]} target="_blank" rel="noreferrer noopener">
          {link[1]}
        </a>
      )
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>
    const angle = part.match(/^<(https?:\/\/[^\s<>]+)>$/)
    if (angle)
      return (
        <a key={key} href={angle[1]} target="_blank" rel="noreferrer noopener">
          {angle[1]}
        </a>
      )
    if (/^https?:\/\//.test(part)) {
      const [url, rest] = trimUrl(part)
      if (url.length <= "https://".length) return part
      return (
        <React.Fragment key={key}>
          <a href={url} target="_blank" rel="noreferrer noopener">
            {url}
          </a>
          {rest}
        </React.Fragment>
      )
    }
    return part
  })
}

/** Blinking caret appended to the tail of streamed text. */
function StreamingCaret({ className }: { className?: string }) {
  return (
    <>
      <style href="qy-streaming-caret" precedence="default">
        {CARET_CSS}
      </style>
      <span
      aria-hidden
      data-slot="streaming-caret"
      className={cn(
        "ml-0.5 inline-block h-[1.05em] w-[0.5em] translate-y-[0.15em] rounded-2xs bg-primary/80 animate-[qy-caret_1s_steps(1)_infinite] motion-reduce:animate-none",
        className
      )}
      />
    </>
  )
}

const CARET_CSS = "@keyframes qy-caret{0%,55%{opacity:1}56%,100%{opacity:0}}"

const CODE_LANGS = new Set(["bash", "json", "diff", "tsx", "typescript", "yaml", "python"])

/** Renders markdown-ish text; the caret rides on the last block while streaming. */
function ResponseMarkdown({
  text,
  sources,
  caret = false,
  className,
}: {
  text: string
  sources?: CitationSource[]
  caret?: boolean
  className?: string
}) {
  const blocks = React.useMemo(() => parseBlocks(text), [text])
  const tail = caret ? <StreamingCaret /> : null
  return (
    <div data-slot="response-markdown" className={cn("typeset typeset-chat text-foreground/90", className)}>
      {blocks.length === 0 && tail ? <p>{tail}</p> : null}
      {blocks.map((block, bi) => {
        const last = bi === blocks.length - 1
        const k = `b${bi}`
        if (block.type === "h")
          return (
            <h3 key={k}>
              {renderInline(block.text, sources, k)}
              {last && tail}
            </h3>
          )
        if (block.type === "code") {
          const lang = (CODE_LANGS.has(block.lang) ? block.lang : "text") as CodeLanguage
          return (
            <div key={k} className="not-typeset mt-(--typeset-flow) overflow-hidden rounded-xl bg-code p-3 shadow-well first:mt-0">
              <CodeHighlight code={block.code} language={lang} />
              {last && tail}
            </div>
          )
        }
        if (block.type === "ul" || block.type === "ol") {
          const List = block.type
          const tasks = block.items.some((item) => item.checked !== undefined)
          return (
            <List key={k} start={block.type === "ol" && block.start !== undefined && block.start !== 1 ? block.start : undefined} className={tasks ? "contains-task-list" : undefined}>
              {block.items.map((item, ii) => (
                <li key={ii} className={item.checked !== undefined ? "task-list-item" : undefined}>
                  {item.checked !== undefined && (
                    <Checkbox size="sm" checked={item.checked} readOnly tabIndex={-1} aria-label={item.text} className="me-2 translate-y-0.5" />
                  )}
                  {renderInline(item.text, sources, `${k}-${ii}`)}
                  {last && ii === block.items.length - 1 && tail}
                </li>
              ))}
            </List>
          )
        }
        if (block.type !== "p") return null
        return (
          <p key={k}>
            {renderInline(block.text, sources, k)}
            {last && tail}
          </p>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* StreamingResponse                                                           */
/* -------------------------------------------------------------------------- */

type StreamingResponseStatus = "streaming" | "complete" | "error"
type StreamingResponseFeedback = "up" | "down" | null

type StreamingResponseProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Markdown-ish text to render (streamed in by appending). */
  text?: string
  /** Custom content instead of `text`, e.g. your own markdown renderer's output. */
  children?: React.ReactNode
  status?: StreamingResponseStatus
  /** Sources for `[n]` markers and the footer list. */
  sources?: CitationSource[]
  defaultSourcesOpen?: boolean
  /** Plain text copied by the copy action (defaults to `text`). */
  copyText?: string
  onRetry?: () => void
  feedback?: StreamingResponseFeedback
  defaultFeedback?: StreamingResponseFeedback
  onFeedbackChange?: (feedback: StreamingResponseFeedback) => void
  /** Message shown when `status="error"`. */
  errorMessage?: React.ReactNode
  /** Hide the completion actions. */
  showActions?: boolean
  contentClassName?: string
}

/**
 * Stable surface for an assistant reply: streamed text with a caret, then
 * copy / retry / feedback actions and an expandable sources list once complete.
 * The actions row reserves its space while streaming, so nothing jumps.
 */
function StreamingResponse({
  text,
  children,
  status = "streaming",
  sources,
  defaultSourcesOpen = false,
  copyText,
  onRetry,
  feedback: feedbackProp,
  defaultFeedback = null,
  onFeedbackChange,
  errorMessage: errorMessageProp,
  showActions = true,
  className,
  contentClassName,
  ...props
}: StreamingResponseProps) {
  const { labels } = useLocale()
  const errorMessage = errorMessageProp ?? labels.responseInterrupted
  const reduce = useReducedMotion()
  const streaming = status === "streaming"
  const [internalFeedback, setInternalFeedback] = React.useState<StreamingResponseFeedback>(defaultFeedback)
  const feedback = feedbackProp ?? internalFeedback
  const copyValue = copyText ?? text ?? ""
  const hasSources = !!sources?.length

  const toggleFeedback = (next: "up" | "down") => {
    const value = feedback === next ? null : next
    if (feedbackProp === undefined) setInternalFeedback(value)
    onFeedbackChange?.(value)
  }

  const body =
    children !== undefined ? (
      <div className="typeset typeset-chat text-foreground/90">
        {children}
        {streaming ? <StreamingCaret /> : null}
      </div>
    ) : (
      <ResponseMarkdown text={text ?? ""} sources={sources} caret={streaming} />
    )

  return (
    <CitationGroup sources={sources ?? []} defaultOpen={defaultSourcesOpen}>
      <div
        data-slot="streaming-response"
        data-status={status}
        aria-busy={streaming}
        className={cn("flex w-full flex-col gap-2", className)}
        {...props}
      >
        <div aria-live={streaming ? "off" : "polite"} className={contentClassName}>
          {body}
        </div>

        <AnimatePresence initial={false}>
          {status === "error" ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: AGENT_EASE }}
              role="alert"
              className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-ui text-destructive shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--destructive)_22%,transparent)]"
            >
              <AlertCircleIcon className="size-4 shrink-0" />
              <span className="flex-1">{errorMessage}</span>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 text-ui-sm font-medium outline-none hover:bg-destructive/12 focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <RefreshIcon className="size-3.5" />
                  Retry
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {showActions ? (
          <motion.div
            data-slot="streaming-response-actions"
            aria-hidden={streaming}
            inert={streaming}
            initial={false}
            animate={streaming ? { opacity: 0, y: reduce ? 0 : -3 } : { opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: AGENT_EASE, delay: streaming ? 0 : 0.08 }}
            className="flex min-h-8 flex-wrap items-center gap-0.5"
          >
            <AgentCopyButton value={copyValue} label={labels.copyResponse} />
            {onRetry ? (
              <AgentIconButton label={labels.regenerate} onClick={onRetry}>
                <RefreshIcon />
              </AgentIconButton>
            ) : null}
            <AgentIconButton label={labels.goodResponse} pressed={feedback === "up"} onClick={() => toggleFeedback("up")}>
              <ThumbsUpIcon className={cn(feedback === "up" && "text-success")} />
            </AgentIconButton>
            <AgentIconButton label={labels.badResponse} pressed={feedback === "down"} onClick={() => toggleFeedback("down")}>
              <ThumbsDownIcon className={cn(feedback === "down" && "text-destructive")} />
            </AgentIconButton>
          </motion.div>
        ) : null}

        {hasSources && !streaming ? (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: AGENT_EASE, delay: 0.12 }}
          >
            <Citations />
          </motion.div>
        ) : null}
      </div>
    </CitationGroup>
  )
}

export {
  StreamingResponse,
  ResponseMarkdown,
  StreamingCaret,
  type StreamingResponseProps,
  type StreamingResponseStatus,
  type StreamingResponseFeedback,
}
