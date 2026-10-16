"use client"

import * as React from "react"
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import { MessageBubbleGroup, MessageSideContext, type MessageSide } from "@/ui/message-bubble"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip"

type MessageFrom = "user" | "assistant" | "system"

const MessageFromContext = React.createContext<MessageFrom>("assistant")

const sideOf = (from: MessageFrom): MessageSide => (from === "user" ? "end" : "start")

/** Vertical stack of message rows. */
function MessageList({
  spacing = "default",
  className,
  ...props
}: React.ComponentProps<"div"> & { spacing?: "compact" | "default" }) {
  return (
    <div
      data-slot="message-list"
      className={cn("flex w-full flex-col", spacing === "compact" ? "gap-2" : "gap-5", className)}
      {...props}
    />
  )
}

/**
 * One conversation row. `user` rows hug the right edge, `assistant` and
 * `system` rows the left. `animateIn` plays a pop-up from the sender's
 * corner once on mount, for rows that were just sent.
 */
function Message({
  from = "assistant",
  animateIn = false,
  className,
  style,
  children,
  ...props
}: Omit<HTMLMotionProps<"article">, "children"> & {
  from?: MessageFrom
  animateIn?: boolean
  children?: React.ReactNode
}) {
  const reduce = useReducedMotion() ?? false
  const side = sideOf(from)
  return (
    <MessageFromContext.Provider value={from}>
      <MessageSideContext.Provider value={side}>
        <motion.article
          data-slot="message"
          data-from={from}
          aria-label={props["aria-label"] ?? `${from} message`}
          initial={animateIn ? (reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.94 }) : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 480, damping: 32, mass: 0.6 }}
          style={{ transformOrigin: side === "end" ? "100% 100%" : "0% 100%", ...style }}
          className={cn(
            "group/message flex w-full min-w-0 items-end gap-2.5",
            side === "end" && "flex-row-reverse",
            className
          )}
          {...props}
        >
          {children}
        </motion.article>
      </MessageSideContext.Provider>
    </MessageFromContext.Provider>
  )
}

/**
 * Round avatar slot. Pass an `<img>`, initials or an icon. Use `placeholder`
 * on follow-up rows to keep bubbles aligned without repeating the avatar.
 */
function MessageAvatar({
  placeholder = false,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { placeholder?: boolean }) {
  return (
    <div
      data-slot="message-avatar"
      aria-hidden={placeholder || undefined}
      className={cn(
        "relative mb-0.5 grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-card text-ui-sm font-semibold text-muted-foreground shadow-raised [&_img]:size-full [&_img]:object-cover [&_svg]:size-4",
        placeholder && "invisible",
        className
      )}
      {...props}
    >
      {placeholder ? null : children}
    </div>
  )
}

/**
 * Column holding the row's bubbles, metadata and actions. Bubbles inside are
 * grouped automatically: consecutive bubbles join with tightened corners.
 */
function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  const from = React.useContext(MessageFromContext)
  const side = sideOf(from)
  return (
    <MessageBubbleGroup
      data-slot="message-content"
      align={side}
      className={cn("max-w-[min(80%,36rem)] gap-1", className)}
      {...props}
    />
  )
}

/** Small line above the bubbles: sender name, model or role. */
function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "mb-0.5 flex items-center gap-1.5 px-1 text-ui-sm font-medium text-muted-foreground group-data-[from=user]/message:flex-row-reverse",
        className
      )}
      {...props}
    />
  )
}

/** Timestamp / delivery status line below the bubbles. */
function MessageMeta({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-meta"
      className={cn(
        "mt-0.5 flex items-center gap-1.5 px-1 text-ui-xs text-muted-foreground tabular-nums group-data-[from=user]/message:flex-row-reverse [&_svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

/**
 * Row of quiet icon actions (copy, retry, feedback…). Fades in on hover or
 * keyboard focus of the message; pass `visible` to keep it shown, e.g. on the
 * latest assistant reply.
 */
function MessageActions({
  visible = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { visible?: boolean }) {
  return (
    <div
      role="toolbar"
      data-slot="message-actions"
      data-visible={visible || undefined}
      className={cn(
        "mt-0.5 flex items-center gap-0.5 transition-opacity duration-200 group-data-[from=user]/message:flex-row-reverse",
        !visible &&
          "opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100 pointer-coarse:opacity-100",
        className
      )}
      {...props}
    />
  )
}

/** Icon button for `MessageActions` with a tooltip from its `label`. */
function MessageAction({
  label,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "aria-label"> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className={cn("size-7 text-muted-foreground hover:text-foreground [&_svg]:size-3.5", className)}
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Three-dot typing indicator in a bubble-shaped chip. */
function MessageTyping({ label = "Typing", className, ...props }: React.ComponentProps<"div"> & { label?: string }) {
  const reduce = useReducedMotion() ?? false
  return (
    <div
      role="status"
      aria-label={label}
      data-slot="message-typing"
      className={cn(
        "flex h-10 w-16 items-center justify-center gap-1 self-start rounded-3xl rounded-bl-md bg-card shadow-[var(--skeuo-well),var(--skeuo-primary)]",
        className
      )}
      {...props}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground"
          animate={reduce ? { opacity: [0.4, 1, 0.4] } : { y: [0, -3, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  )
}

/** Centred divider between turns: a date, "New", or a system note. */
function MessageMarker({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="separator"
      data-slot="message-marker"
      className={cn(
        "flex items-center gap-3 text-ui-xs font-medium text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border",
        className
      )}
      {...props}
    >
      <span className="rounded-full bg-muted px-2.5 py-0.5 shadow-chip">{children}</span>
    </div>
  )
}

export {
  MessageList,
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageMeta,
  MessageActions,
  MessageAction,
  MessageTyping,
  MessageMarker,
  type MessageFrom,
}
export {
  MessageBubble,
  MessageBubbleGroup,
  MessageBubbleCollapsible,
} from "@/ui/message-bubble"
