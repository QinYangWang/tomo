"use client";

import * as React from "react"

import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  ANSI parsing                                                              */
/* -------------------------------------------------------------------------- */

type AnsiColor = "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | "gray"

type AnsiStyle = {
  fg?: AnsiColor
  bg?: AnsiColor
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  inverse?: boolean
}

type AnsiSegment = AnsiStyle & { text: string }

const BASE: AnsiColor[] = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"]

/** Closest of the 8 base colours for a 24-bit colour, by hue (greys by lightness). */
function nearest(r: number, g: number, b: number): AnsiColor {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max - min < 24) return max < 64 ? "black" : max > 200 ? "white" : "gray"
  let h = 0
  if (max === r) h = ((g - b) / (max - min)) % 6
  else if (max === g) h = (b - r) / (max - min) + 2
  else h = (r - g) / (max - min) + 4
  h = (h * 60 + 360) % 360
  if (h < 20 || h >= 330) return "red"
  if (h < 70) return "yellow"
  if (h < 160) return "green"
  if (h < 200) return "cyan"
  if (h < 260) return "blue"
  return "magenta"
}

function color256(n: number): AnsiColor {
  if (n < 8) return BASE[n]
  if (n < 16) return n === 8 ? "gray" : BASE[n - 8]
  if (n >= 232) return n < 244 ? "gray" : "white"
  const c = n - 16
  const v = (x: number) => (x === 0 ? 0 : 55 + x * 40)
  return nearest(v(Math.floor(c / 36)), v(Math.floor(c / 6) % 6), v(c % 6))
}

function applySgr(params: number[], style: AnsiStyle): AnsiStyle {
  const s = { ...style }
  if (params.length === 0) params = [0]
  for (let i = 0; i < params.length; i++) {
    const p = params[i]
    if (p === 0) {
      for (const k of Object.keys(s)) delete s[k as keyof AnsiStyle]
    } else if (p === 1) s.bold = true
    else if (p === 2) s.dim = true
    else if (p === 3) s.italic = true
    else if (p === 4) s.underline = true
    else if (p === 7) s.inverse = true
    else if (p === 22) s.bold = s.dim = false
    else if (p === 23) s.italic = false
    else if (p === 24) s.underline = false
    else if (p === 27) s.inverse = false
    else if (p >= 30 && p <= 37) s.fg = BASE[p - 30]
    else if (p === 39) delete s.fg
    else if (p >= 40 && p <= 47) s.bg = BASE[p - 40]
    else if (p === 49) delete s.bg
    else if (p >= 90 && p <= 97) s.fg = p === 90 ? "gray" : BASE[p - 90]
    else if (p >= 100 && p <= 107) s.bg = p === 100 ? "gray" : BASE[p - 100]
    else if (p === 38 || p === 48) {
      const key = p === 38 ? "fg" : "bg"
      if (params[i + 1] === 5) {
        s[key] = color256(params[i + 2] ?? 0)
        i += 2
      } else if (params[i + 1] === 2) {
        s[key] = nearest(params[i + 2] ?? 0, params[i + 3] ?? 0, params[i + 4] ?? 0)
        i += 4
      }
    }
  }
  return s
}

// CSI sequences (colours and cursor moves), OSC titles/links, and lone ESC pairs.
const ESCAPES = /\u001b\[([0-9;?]*)([A-Za-z])|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]/g

/**
 * Split text with ANSI escape codes into styled lines. SGR colours, bold,
 * dim, italic, underline and inverse are kept; cursor moves are dropped and a
 * carriage return rewrites the current line, so progress bars settle.
 */
function parseAnsi(input: string): AnsiSegment[][] {
  const lines: AnsiSegment[][] = [[]]
  let style: AnsiStyle = {}
  const push = (text: string) => {
    const parts = text.split("\n")
    parts.forEach((part, i) => {
      if (i > 0) lines.push([])
      // "\r" without "\n" returns to the line start: keep only what comes after it.
      const cr = part.lastIndexOf("\r")
      if (cr >= 0) {
        lines[lines.length - 1] = []
        part = part.slice(cr + 1)
      }
      if (part) lines[lines.length - 1].push({ ...style, text: part })
    })
  }
  const src = input.replace(/\r\n/g, "\n")
  let last = 0
  for (const m of src.matchAll(ESCAPES)) {
    push(src.slice(last, m.index))
    last = (m.index ?? 0) + m[0].length
    if (m[2] === "m") style = applySgr(m[1] ? m[1].split(";").map((n) => Number(n) || 0) : [], style)
  }
  push(src.slice(last))
  if (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop()
  return lines
}

/** Plain text with every escape code removed. */
function stripAnsi(input: string) {
  return input.replace(ESCAPES, "")
}

const FG: Record<AnsiColor, string> = {
  black: "text-foreground/80",
  red: "text-destructive",
  green: "text-success",
  yellow: "text-warning",
  blue: "text-primary",
  magenta: "text-chart-5",
  cyan: "text-chart-7",
  white: "text-foreground",
  gray: "text-muted-foreground",
}

const BG: Record<AnsiColor, string> = {
  black: "bg-foreground/80",
  red: "bg-destructive/16",
  green: "bg-success/16",
  yellow: "bg-warning/16",
  blue: "bg-primary/16",
  magenta: "bg-chart-5/16",
  cyan: "bg-chart-7/16",
  white: "bg-foreground/8",
  gray: "bg-muted-foreground/16",
}

function segmentClass(s: AnsiStyle) {
  return cn(
    s.inverse ? "bg-foreground text-background" : [s.fg && FG[s.fg], s.bg && BG[s.bg]],
    s.bold && "font-semibold",
    s.dim && "opacity-64",
    s.italic && "italic",
    s.underline && "underline underline-offset-2"
  )
}

/* -------------------------------------------------------------------------- */
/*  Components                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Monospace surface for a shell: output, an input line and a status line stack
 * inside it. `embedded` is the compact inset well used inside chat steps.
 */
function Terminal({ variant = "default", className, ...props }: React.ComponentProps<"div"> & { variant?: "default" | "embedded" }) {
  return (
    <div
      data-slot="terminal"
      data-variant={variant}
      className={cn(
        "group/terminal flex min-h-0 flex-col font-mono leading-normal text-foreground",
        variant === "default" ? "bg-background text-ui-sm" : "overflow-hidden rounded-lg bg-code text-ui-xs shadow-well",
        className
      )}
      {...props}
    />
  )
}

type TerminalOutputProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Raw output, ANSI escape codes included. */
  text: string
  /** Keep the view pinned to the end while new output arrives (until the reader scrolls up). */
  follow?: boolean
  /** Wrap long lines instead of scrolling sideways. */
  wrap?: boolean
}

/**
 * Scrollable terminal output with ANSI colours mapped to theme tokens (red →
 * destructive, green → success, yellow → warning, blue → primary, magenta and
 * cyan → chart colours), so it follows light and dark mode and the accent.
 */
function TerminalOutput({ text, follow = true, wrap = true, className, ...props }: TerminalOutputProps) {
  const lines = React.useMemo(() => parseAnsi(text), [text])
  const ref = React.useRef<HTMLDivElement>(null)
  const pinned = React.useRef(true)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (el && follow && pinned.current) el.scrollTop = el.scrollHeight
  }, [lines, follow])
  return (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      data-slot="terminal-output"
      onScroll={(e) => {
        const el = e.currentTarget
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 16
      }}
      className={cn("min-h-0 flex-1 overflow-auto px-3 py-2 scrollbar-thin group-data-[variant=embedded]/terminal:px-2.5 group-data-[variant=embedded]/terminal:py-1.5", className)}
      {...props}
    >
      {lines.map((line, i) => (
        <div key={i} className={cn("min-h-[1.5em]", wrap ? "break-words whitespace-pre-wrap" : "whitespace-pre")}>
          {line.map((seg, j) =>
            Object.keys(seg).length === 1 ? (
              <React.Fragment key={j}>{seg.text}</React.Fragment>
            ) : (
              <span key={j} className={segmentClass(seg)}>
                {seg.text}
              </span>
            )
          )}
        </div>
      ))}
    </div>
  )
}

type TerminalInputProps = Omit<React.ComponentProps<"input">, "onSubmit" | "prefix"> & {
  /** Prompt glyph before the input. */
  prompt?: React.ReactNode
  onSubmit?: (command: string) => void
}

/** Command line with a prompt glyph and ↑ / ↓ history of what was submitted. */
function TerminalInput({ prompt = "❯", onSubmit, className, onKeyDown, ...props }: TerminalInputProps) {
  const [value, setValue] = React.useState("")
  const history = React.useRef<string[]>([])
  const cursor = React.useRef(-1)
  return (
    <label data-slot="terminal-input" className={cn("flex items-center gap-2 border-t border-border px-3 py-1.5", className)}>
      <span aria-hidden className="shrink-0 text-muted-foreground">
        {prompt}
      </span>
      <input
        value={value}
        spellCheck={false}
        autoComplete="off"
        aria-label="Terminal command"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          if (e.defaultPrevented) return
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault()
            const cmd = value
            if (cmd.trim()) history.current.unshift(cmd)
            cursor.current = -1
            setValue("")
            onSubmit?.(cmd)
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            const h = history.current
            if (!h.length) return
            e.preventDefault()
            cursor.current = Math.max(-1, Math.min(h.length - 1, cursor.current + (e.key === "ArrowUp" ? 1 : -1)))
            setValue(cursor.current < 0 ? "" : h[cursor.current])
          }
        }}
        className="min-w-0 flex-1 bg-transparent caret-foreground outline-none placeholder:text-muted-foreground"
        {...props}
      />
    </label>
  )
}

/** One or two lines of status under the prompt (model, branch, context use). Accepts ANSI text too. */
function TerminalStatusLine({ text, className, children, ...props }: React.ComponentProps<"div"> & { text?: string }) {
  return (
    <div data-slot="terminal-status" className={cn("px-3 pb-2 text-ui-xs text-muted-foreground", className)} {...props}>
      {text !== undefined ? <TerminalOutput text={text} follow={false} className="overflow-hidden p-0" /> : children}
    </div>
  )
}

export {
  Terminal,
  TerminalOutput,
  TerminalInput,
  TerminalStatusLine,
  parseAnsi,
  stripAnsi,
  type AnsiSegment,
  type AnsiStyle,
  type AnsiColor,
  type TerminalOutputProps,
  type TerminalInputProps,
}
