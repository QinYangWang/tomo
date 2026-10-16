import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { ArrowUpIcon, FileIcon, MicIcon, PlusIcon, StopIcon, TerminalIcon, XIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import { Tooltip, TooltipContent, TooltipKbd, TooltipTrigger } from "@/ui/tooltip"

type ComposerMention = {
  /** Inserted after the `@`, e.g. a workspace-relative path. */
  value: string
  description?: string
  icon?: React.ReactNode
}

type ComposerCommand = {
  /** Inserted after the `/`. */
  name: string
  description?: string
  /** Hint for the argument, e.g. "query". */
  hint?: string
}

type Suggestion = { key: string; label: string; description?: string; icon: React.ReactNode; insert: string }

type Trigger = { char: "@" | "/"; query: string; start: number; end: number }

/** The `@word` or leading `/word` that ends at the caret, if any. */
function findTrigger(text: string, caret: number): Trigger | null {
  const before = text.slice(0, caret)
  const m = /(^|\s)([@/])([^\s@]*)$/.exec(before)
  if (!m) return null
  const char = m[2] as "@" | "/"
  const start = before.length - m[3].length - 1
  // Slash commands only at the start of the message.
  if (char === "/" && before.slice(0, start).trim() !== "") return null
  return { char, query: m[3], start, end: caret }
}

function score(query: string, text: string) {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (!q) return 1
  const base = t.split("/").pop() ?? t
  if (base.startsWith(q)) return 4
  if (t.startsWith(q)) return 3
  if (base.includes(q)) return 2
  if (t.includes(q)) return 1
  // Subsequence match.
  let i = 0
  for (const c of t) if (c === q[i]) i++
  return i === q.length ? 0.5 : 0
}

type AgentComposerProps = Omit<React.ComponentProps<"form">, "onSubmit" | "children"> & {
  placeholder?: string
  /** Controlled text. */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Called with the trimmed text; the composer clears itself. */
  onSubmit?: (text: string) => void
  /** Agent is working: the send button becomes stop. */
  busy?: boolean
  onStop?: () => void
  /** Files offered after `@`. */
  mentions?: ComposerMention[]
  /** Commands offered after a leading `/`. */
  commands?: ComposerCommand[]
  onAttach?: () => void
  onVoice?: () => void
  /** Controls after the attach button (access mode). */
  toolbarStart?: React.ReactNode
  /** Controls before the mic and send buttons (model, effort). */
  toolbarEnd?: React.ReactNode
  /** Stacked above the input inside the same frame: banners, a pending approval, queued messages. */
  header?: React.ReactNode
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * Coding-agent composer: auto-growing input with `@file`
 * mentions and `/command` suggestions, attach and voice buttons, slots for
 * mode / model / effort pickers, and a send button that turns into stop while
 * the agent works. Enter sends, Shift+Enter adds a line, Esc stops.
 */
const AgentComposer = React.forwardRef<HTMLTextAreaElement, AgentComposerProps>(function AgentComposer(
  {
    placeholder = "Ask anything, @tag files/folders, or use / to show available commands",
    value: valueProp,
    defaultValue = "",
    onValueChange,
    onSubmit,
    busy = false,
    onStop,
    mentions = [],
    commands = [],
    onAttach,
    onVoice,
    toolbarStart,
    toolbarEnd,
    header,
    disabled = false,
    autoFocus,
    className,
    ...props
  },
  forwardedRef
) {
  const reduce = useReducedMotion()
  const [valueState, setValueState] = React.useState(defaultValue)
  const value = valueProp ?? valueState
  const setValue = (next: string) => {
    if (valueProp === undefined) setValueState(next)
    onValueChange?.(next)
  }
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  React.useImperativeHandle(forwardedRef, () => inputRef.current!, [])
  const [trigger, setTrigger] = React.useState<Trigger | null>(null)
  const [active, setActive] = React.useState(0)
  const listId = React.useId()

  const suggestions = React.useMemo<Suggestion[]>(() => {
    if (!trigger) return []
    if (trigger.char === "@")
      return mentions
        .map((m) => ({ m, s: score(trigger.query, m.value) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 8)
        .map(({ m }) => ({
          key: `@${m.value}`,
          label: m.value,
          description: m.description,
          icon: m.icon ?? <FileIcon />,
          insert: `@${m.value} `,
        }))
    return commands
      .map((c) => ({ c, s: score(trigger.query, c.name) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map(({ c }) => ({
        key: `/${c.name}`,
        label: `/${c.name}${c.hint ? ` ${c.hint}` : ""}`,
        description: c.description,
        icon: <TerminalIcon />,
        insert: `/${c.name} `,
      }))
  }, [trigger, mentions, commands])

  const menuOpen = trigger !== null && suggestions.length > 0
  const canSend = value.trim().length > 0 && !disabled

  const sync = (text: string, caret: number) => {
    const next = findTrigger(text, caret)
    setTrigger(next)
    setActive(0)
  }

  const choose = (s: Suggestion) => {
    if (!trigger) return
    const next = value.slice(0, trigger.start) + s.insert + value.slice(trigger.end)
    setValue(next)
    setTrigger(null)
    const caret = trigger.start + s.insert.length
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(caret, caret)
    })
  }

  const submit = () => {
    if (!canSend || busy) return
    onSubmit?.(value.trim())
    setValue("")
    setTrigger(null)
  }

  return (
    <form
      data-slot="agent-composer"
      data-busy={busy || undefined}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className={cn(
        "relative flex w-full min-w-0 flex-col rounded-3xl bg-card shadow-raised transition-shadow duration-150 focus-within:shadow-raised-hover",
        className
      )}
      {...props}
    >
      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.div
            key="suggest"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-full z-20 mb-2 frame-xl frame-p-1 origin-bottom bg-popover shadow-surface"
          >
            <div className="px-2 pt-1 pb-1 text-ui-xs text-muted-foreground">
              {trigger?.char === "@" ? "Files and folders" : "Commands"}
            </div>
            <ul id={listId} role="listbox" aria-label={trigger?.char === "@" ? "Files" : "Commands"} className="flex max-h-64 flex-col overflow-y-auto overscroll-contain">
              {suggestions.map((s, i) => (
                <li
                  key={s.key}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onPointerDown={(e) => e.preventDefault()}
                  onPointerMove={() => setActive(i)}
                  onClick={() => choose(s)}
                  className="flex min-h-7 cursor-default items-center gap-2 rounded-inner px-2 text-ui aria-selected:bg-secondary [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
                >
                  {s.icon}
                  <span className="min-w-0 shrink-0 truncate font-mono text-ui-sm">{s.label}</span>
                  {s.description && <span className="min-w-0 truncate text-ui-sm text-muted-foreground">{s.description}</span>}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      {header && <div data-slot="agent-composer-header" className="flex flex-col gap-1 border-b border-border p-1">{header}</div>}
      <textarea
        ref={inputRef}
        data-slot="agent-composer-input"
        rows={1}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? listId : undefined}
        aria-activedescendant={menuOpen ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        aria-label="Message"
        onChange={(e) => {
          setValue(e.target.value)
          sync(e.target.value, e.target.selectionStart)
        }}
        onSelect={(e) => sync(e.currentTarget.value, e.currentTarget.selectionStart)}
        onBlur={() => setTrigger(null)}
        onKeyDown={(e) => {
          if (menuOpen) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault()
              const d = e.key === "ArrowDown" ? 1 : -1
              setActive((a) => (a + d + suggestions.length) % suggestions.length)
              return
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault()
              choose(suggestions[active])
              return
            }
            if (e.key === "Escape") {
              e.preventDefault()
              setTrigger(null)
              return
            }
          }
          if (e.key === "Escape" && busy) {
            e.preventDefault()
            onStop?.()
          }
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
        className="field-sizing-content max-h-60 min-h-14 w-full resize-none bg-transparent px-3.5 pt-3 text-ui-lg outline-none placeholder:text-muted-foreground disabled:opacity-64"
      />
      {/* Named container: mode / effort pickers drop their labels when this row is under 28rem (phones, tablets, split panes). */}
      <div data-slot="agent-composer-toolbar" className="@container/composer-toolbar flex min-w-0 items-center gap-1 p-2 pt-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Attach files" onClick={onAttach} className="text-muted-foreground">
                <PlusIcon />
              </Button>
            }
          />
          <TooltipContent>Attach files</TooltipContent>
        </Tooltip>
        <div className="flex min-w-0 shrink items-center gap-1">{toolbarStart}</div>
        <div className="flex-1" />
        <div className="flex min-w-0 shrink items-center justify-end gap-1">{toolbarEnd}</div>
        {onVoice && (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Dictate" onClick={onVoice} className="text-muted-foreground">
            <MicIcon />
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              busy ? (
                <Button type="button" size="icon-sm" aria-label="Stop" onClick={onStop} className="rounded-full">
                  <StopIcon />
                </Button>
              ) : (
                <Button type="submit" size="icon-sm" aria-label="Send" disabled={!canSend} className="rounded-full">
                  <ArrowUpIcon />
                </Button>
              )
            }
          />
          <TooltipContent>
            {busy ? "Stop" : "Send"}
            <TooltipKbd>{busy ? "Esc" : "↵"}</TooltipKbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </form>
  )
})

type AgentComposerBannerProps = Omit<React.ComponentProps<"div">, "title"> & {
  icon?: React.ReactNode
  title: React.ReactNode
  /** Primary action button label. */
  actionLabel?: string
  onAction?: () => void
  onDismiss?: () => void
}

/** One-line suggestion above the input ("Want to turn on auto-fix for this PR?"), with an action and dismiss. */
function AgentComposerBanner({ icon, title, actionLabel, onAction, onDismiss, className, ...props }: AgentComposerBannerProps) {
  return (
    <div
      data-slot="agent-composer-banner"
      role="status"
      className={cn("flex min-h-9 items-center gap-2 frame-[calc(var(--radius-3xl)-var(--spacing))] frame-inset-1.5 px-2.5 text-ui text-foreground/90 [&>[data-slot=button]]:rounded-inner-or-sm", className)}
      {...props}
    >
      {icon && <span className="flex shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {actionLabel && (
        <Button type="button" variant="outline" size="xs" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {onDismiss && (
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={onDismiss} className="text-muted-foreground">
          <XIcon />
        </Button>
      )}
    </div>
  )
}

export { AgentComposer, AgentComposerBanner, findTrigger, type AgentComposerProps, type AgentComposerBannerProps, type ComposerMention, type ComposerCommand }
