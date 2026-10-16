import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { ChevronDownIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

type MessageSide = "start" | "end"

/**
 * Which side the surrounding conversation row sits on. `Message` provides it;
 * a bubble inherits its alignment from it unless `align` is set explicitly.
 */
const MessageSideContext = React.createContext<MessageSide | null>(null)

/** Set when a bubble lives inside a group, so its joined corners tighten. */
const MessageBubbleGroupContext = React.createContext<MessageSide | null>(null)

function useMessageSide(align?: MessageSide): MessageSide {
  const group = React.useContext(MessageBubbleGroupContext)
  const side = React.useContext(MessageSideContext)
  return align ?? group ?? side ?? "start"
}

const messageBubbleVariants = cva(
  "relative w-fit max-w-full rounded-3xl px-4 py-2.5 text-ui-lg leading-relaxed wrap-break-word transition-[box-shadow,background-color,scale] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&_a]:underline [&_a]:underline-offset-2",
  {
    variants: {
      tone: {
        // Hairline drawn inside (well) plus the primary tone's drop, not the
        // outer raised ring: an outer ring eats 1px of the gap on each side, so
        // stacked incoming bubbles read tighter than stacked outgoing ones.
        default: "bg-card text-secondary-foreground shadow-[var(--skeuo-well),var(--skeuo-primary)]",
        primary:
          "bg-primary text-primary-foreground shadow-primary [&_a]:text-primary-foreground",
        muted: "bg-muted text-foreground shadow-well",
        outline: "bg-transparent text-foreground shadow-[inset_0_0_0_1px_var(--border)]",
        destructive:
          "bg-destructive/10 text-destructive shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--destructive),transparent_70%)]",
        ghost: "bg-transparent px-0 py-0 text-foreground shadow-none",
      },
      size: {
        default: "",
        sm: "rounded-2xl px-3 py-1.5 text-ui",
      },
    },
    defaultVariants: { tone: "default", size: "default" },
  }
)

type MessageBubbleProps = useRender.ComponentProps<"div"> &
  VariantProps<typeof messageBubbleVariants> & {
    /** Side the bubble hugs. Inherited from `Message` / `MessageBubbleGroup` when omitted. */
    align?: MessageSide
    /** Draw the small "tail" corner toward the sender. Defaults to true. */
    tail?: boolean
  }

/**
 * A single conversational surface. Tones cover sender, system and error
 * messages; pass `render={<a href="…" />}` or `render={<button />}` to make the
 * whole bubble interactive.
 */
function MessageBubble({ className, tone, size, align, tail = true, render, ...props }: MessageBubbleProps) {
  const side = useMessageSide(align)
  const grouped = React.useContext(MessageBubbleGroupContext) !== null
  const interactive = render !== undefined

  return useRender({
    defaultTagName: "div",
    render,
    state: { slot: "message-bubble", align: side, tone: tone ?? "default" },
    props: mergeProps<"div">(
      {
        className: cn(
          messageBubbleVariants({ tone, size }),
          side === "end" ? "self-end" : "self-start",
          tail && tone !== "ghost" && (side === "end" ? "rounded-br-md" : "rounded-bl-md"),
          grouped && tone !== "ghost" && (side === "end"
              ? "[[data-slot=message-bubble]+&]:rounded-tr-md"
              : "[[data-slot=message-bubble]+&]:rounded-tl-md"),
          interactive &&
            "cursor-pointer text-left no-underline select-none active:scale-98",
          className
        ),
      },
      props
    ),
  })
}

/** Stacks consecutive bubbles from one sender with tight, joined corners. */
function MessageBubbleGroup({
  align,
  className,
  ...props
}: React.ComponentProps<"div"> & { align?: MessageSide }) {
  const inherited = React.useContext(MessageSideContext)
  const side = align ?? inherited ?? "start"
  return (
    <MessageBubbleGroupContext.Provider value={side}>
      <div
        data-slot="message-bubble-group"
        data-align={side}
        className={cn("flex min-w-0 flex-col gap-1", side === "end" ? "items-end" : "items-start", className)}
        {...props}
      />
    </MessageBubbleGroupContext.Provider>
  )
}

/**
 * Long content clipped to `collapsedHeight` with a soft fade and a
 * "Show more" toggle. Renders plainly when the content already fits.
 */
function MessageBubbleCollapsible({
  collapsedHeight = 120,
  defaultExpanded = false,
  moreLabel = "Show more",
  lessLabel = "Show less",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  collapsedHeight?: number
  defaultExpanded?: boolean
  moreLabel?: string
  lessLabel?: string
}) {
  const innerRef = React.useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = React.useState(defaultExpanded)
  const [full, setFull] = React.useState<number | null>(null)
  const id = React.useId()

  React.useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    const measure = () => setFull(el.scrollHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const overflows = full !== null && full > collapsedHeight + 8
  const height = !overflows ? undefined : expanded ? full : collapsedHeight

  return (
    <div data-slot="message-bubble-collapsible" className={cn("flex flex-col", className)} {...props}>
      <div
        id={id}
        style={{ height }}
        className={cn(
          "relative overflow-hidden transition-[height] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          overflows &&
            !expanded &&
            "mask-b-from-[calc(100%-2.5rem)] mask-b-to-100%"
        )}
      >
        <div ref={innerRef}>{children}</div>
      </div>
      {overflows && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex w-fit cursor-pointer items-center gap-1 rounded-full text-ui-sm font-medium opacity-75 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {expanded ? lessLabel : moreLabel}
          <ChevronDownIcon
            className={cn(
              "size-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              expanded && "rotate-180"
            )}
          />
        </button>
      )}
    </div>
  )
}

export {
  MessageBubble,
  MessageBubbleGroup,
  MessageBubbleCollapsible,
  MessageSideContext,
  messageBubbleVariants,
  type MessageSide,
  type MessageBubbleProps,
}
