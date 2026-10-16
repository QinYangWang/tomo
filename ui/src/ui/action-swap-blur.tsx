"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import {
  EASE_OUT,
  SWAP_SPRING,
  TextCascade,
  useContentWidth,
  WIDTH_SPRING,
} from "@/ui/text-cascade"

/* Shared engine for the action-swap family (blur, roll, cascade). */

type ActionSwapAnimation = "blur" | "roll" | "cascade"

type ActionSwapItem = {
  /** Stable id of the state. */
  value: string
  label: React.ReactNode
  icon?: React.ReactNode
  /** Accessible name when the label is not plain text or the button is icon-only. */
  ariaLabel?: string
}

const BLUR_TRANSITION = { duration: 0.22, ease: EASE_OUT } as const
const ROLL_EXIT = { duration: 0.15, ease: EASE_OUT } as const

const TEXT_VARIANTS: Record<"blur" | "roll", Variants> = {
  blur: {
    initial: { opacity: 0, scale: 0.94, filter: "blur(8px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: BLUR_TRANSITION },
    exit: { opacity: 0, scale: 0.94, filter: "blur(8px)", transition: BLUR_TRANSITION },
  },
  roll: {
    initial: { opacity: 0, y: "90%", filter: "blur(3px)" },
    animate: {
      opacity: 1,
      y: "0%",
      filter: "blur(0px)",
      transition: { ...SWAP_SPRING, opacity: { duration: 0.2 } },
    },
    exit: { opacity: 0, y: "-90%", filter: "blur(3px)", transition: ROLL_EXIT },
  },
}

const ICON_VARIANTS: Record<"blur" | "roll", Variants> = {
  blur: {
    initial: { opacity: 0, scale: 0.3, filter: "blur(6px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: BLUR_TRANSITION },
    exit: { opacity: 0, scale: 0.3, filter: "blur(6px)", transition: BLUR_TRANSITION },
  },
  roll: {
    initial: { opacity: 0, y: "110%", filter: "blur(3px)" },
    animate: {
      opacity: 1,
      y: "0%",
      filter: "blur(0px)",
      transition: { ...SWAP_SPRING, opacity: { duration: 0.2 } },
    },
    exit: { opacity: 0, y: "-110%", filter: "blur(3px)", transition: ROLL_EXIT },
  },
}

const REDUCED_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}

type ActionSwapTextProps = {
  /** Identity of the current label; a new value triggers the swap. */
  value: string
  children: React.ReactNode
  animation?: ActionSwapAnimation
  className?: string
}

/** Label slot that swaps its content with blur, roll or a letter cascade. */
function ActionSwapText({ value, children, animation = "blur", className }: ActionSwapTextProps) {
  const reduce = useReducedMotion()
  const [sizer, width] = useContentWidth<HTMLSpanElement>()

  // Cascade needs plain text to split; anything else rolls as one piece.
  if (animation === "cascade" && typeof children === "string") {
    return <TextCascade data-slot="action-swap-text" text={children} className={className} />
  }
  const core = animation === "cascade" ? "roll" : animation

  return (
    <motion.span
      data-slot="action-swap-text"
      className={cn("relative -my-[0.1em] inline-block py-[0.1em] align-bottom whitespace-nowrap", className)}
      style={{ clipPath: "inset(0 -100vw)" }}
      initial={false}
      animate={width != null ? { width } : undefined}
      transition={reduce ? { duration: 0 } : WIDTH_SPRING}
    >
      <span ref={sizer} aria-hidden className="invisible inline-block whitespace-nowrap">
        {children}
      </span>
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          variants={reduce ? REDUCED_VARIANTS : TEXT_VARIANTS[core]}
          initial="initial"
          animate="animate"
          exit="exit"
          className="absolute top-[0.1em] left-0 inline-block whitespace-nowrap will-change-[transform,filter,opacity]"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}

type ActionSwapIconProps = ActionSwapTextProps

/** Icon slot: the old glyph leaves as the new one arrives, stacked in one cell. */
function ActionSwapIcon({ value, children, animation = "blur", className }: ActionSwapIconProps) {
  const reduce = useReducedMotion()
  const core = animation === "cascade" ? "roll" : animation
  return (
    <span
      data-slot="action-swap-icon"
      aria-hidden
      className={cn(
        "relative inline-grid size-4 shrink-0 place-items-center [&_svg]:size-full",
        core === "roll" && "[clip-path:inset(-2px)]",
        className
      )}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          variants={reduce ? REDUCED_VARIANTS : ICON_VARIANTS[core]}
          initial="initial"
          animate="animate"
          exit="exit"
          className="col-start-1 row-start-1 inline-flex size-full items-center justify-center will-change-[transform,filter,opacity]"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

type ButtonProps = React.ComponentProps<typeof Button>

type ActionSwapButtonProps = Omit<ButtonProps, "children" | "value" | "defaultValue"> & {
  items: ActionSwapItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string, item: ActionSwapItem) => void
  animation?: ActionSwapAnimation
  /** Hide the label and show only the icon slot (defaults on for icon sizes). */
  iconOnly?: boolean
  /** Advance to the next item on click. Turn off to drive `value` yourself. */
  cycle?: boolean
  /** Milliseconds after which the button returns to its first item, e.g. "Copied" → "Copy". */
  resetAfter?: number
}

/** Button whose label and icon swap between states, e.g. a copy button. */
function ActionSwapButton({
  items,
  value,
  defaultValue,
  onValueChange,
  animation = "blur",
  size = "default",
  iconOnly = typeof size === "string" && size.startsWith("icon"),
  cycle = true,
  resetAfter,
  className,
  onClick,
  ...props
}: ActionSwapButtonProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? items[0]?.value)
  const current = value ?? internal
  const index = Math.max(0, items.findIndex((item) => item.value === current))
  const active = items[index]
  const hasIcon = items.some((item) => item.icon != null)

  const changeRef = React.useRef(onValueChange)
  changeRef.current = onValueChange
  const select = React.useCallback(
    (item: ActionSwapItem) => {
      if (value === undefined) setInternal(item.value)
      changeRef.current?.(item.value, item)
    },
    [value]
  )

  const resetItem = items[0]
  React.useEffect(() => {
    if (!resetAfter || !resetItem || !active || active.value === resetItem.value) return
    const timer = window.setTimeout(() => select(resetItem), resetAfter)
    return () => window.clearTimeout(timer)
  }, [resetAfter, resetItem, active, select])

  if (!active) return null
  const labelText = active.ariaLabel ?? (typeof active.label === "string" ? active.label : undefined)

  return (
    <Button
      data-slot="action-swap-button"
      size={size}
      aria-label={iconOnly ? labelText : active.ariaLabel}
      className={cn("overflow-hidden", className)}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || !cycle || items.length < 2) return
        select(items[(index + 1) % items.length])
      }}
      {...props}
    >
      {hasIcon ? (
        <ActionSwapIcon value={active.value} animation={animation}>
          {active.icon}
        </ActionSwapIcon>
      ) : null}
      {!iconOnly ? (
        <ActionSwapText value={active.value} animation={animation}>
          {active.label}
        </ActionSwapText>
      ) : null}
      {/* Announce the new state; the button's name alone may not be re-read. */}
      <span className="sr-only" aria-live="polite">
        {labelText}
      </span>
    </Button>
  )
}

/* Blur preset: the label and icon dissolve and re-form with blur, fade and scale. */

type ActionSwapBlurButtonProps = Omit<ActionSwapButtonProps, "animation">
type ActionSwapBlurTextProps = Omit<ActionSwapTextProps, "animation">
type ActionSwapBlurIconProps = Omit<ActionSwapIconProps, "animation">

function ActionSwapBlurButton(props: ActionSwapBlurButtonProps) {
  return <ActionSwapButton {...props} animation="blur" />
}
function ActionSwapBlurText(props: ActionSwapBlurTextProps) {
  return <ActionSwapText {...props} animation="blur" />
}
function ActionSwapBlurIcon(props: ActionSwapBlurIconProps) {
  return <ActionSwapIcon {...props} animation="blur" />
}

export {
  ActionSwapButton,
  ActionSwapText,
  ActionSwapIcon,
  ActionSwapBlurButton,
  ActionSwapBlurText,
  ActionSwapBlurIcon,
  type ActionSwapAnimation,
  type ActionSwapItem,
  type ActionSwapButtonProps,
  type ActionSwapTextProps,
  type ActionSwapIconProps,
  type ActionSwapBlurButtonProps,
  type ActionSwapBlurTextProps,
  type ActionSwapBlurIconProps,
}
