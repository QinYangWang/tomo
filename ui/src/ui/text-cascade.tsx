"use client";

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react"

import { cn } from "@/lib/utils"

const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

/** Spring used whenever a label trades places inside a control. */
const SWAP_SPRING = { type: "spring", stiffness: 460, damping: 32, mass: 0.55 } as const
/** Spring for the container easing to its new width. */
const WIDTH_SPRING = { type: "spring", stiffness: 520, damping: 42, mass: 0.6 } as const
const EASE_OUT = [0.22, 1, 0.36, 1] as const

/**
 * Tracks the rendered width of an in-flow sizer, so a wrapper can glide to the
 * next label's width instead of snapping. Shared by the swap components.
 */
function useContentWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  const [width, setWidth] = React.useState<number | null>(null)
  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

const LETTER_VARIANTS: Variants = {
  initial: { opacity: 0, y: "100%", filter: "blur(3px)" },
  animate: (delay: number = 0) => ({
    opacity: 1,
    y: "0%",
    filter: "blur(0px)",
    transition: { ...SWAP_SPRING, delay, opacity: { duration: 0.2, delay } },
  }),
  exit: (delay: number = 0) => ({
    opacity: 0,
    y: "-100%",
    filter: "blur(3px)",
    // Exits run at half the stagger so the tail of the old word lingers a beat.
    transition: { duration: 0.18, ease: EASE_OUT, delay: delay * 0.5 },
  }),
}

const FADE_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

type TextCascadeProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** Current text. Changing it rolls the letters, left to right, to the new value. */
  text: string
  /** Seconds between neighbouring letters. */
  stagger?: number
  /** Glide the wrapper between the old and new widths (otherwise it snaps). */
  animateWidth?: boolean
}

/**
 * Letter-by-letter slot roll: the old letters lift out as the new ones land.
 * Old and new strings are separate layers, so proportional glyph widths never jitter.
 */
function TextCascade({
  text,
  stagger = 0.025,
  animateWidth = true,
  className,
  style,
  ...props
}: TextCascadeProps) {
  const reduce = useReducedMotion()
  const [sizer, width] = useContentWidth<HTMLSpanElement>()
  const letters = Array.from(text)

  return (
    <motion.span
      data-slot="text-cascade"
      className={cn("relative -my-[0.1em] inline-block py-[0.1em] align-baseline whitespace-pre", className)}
      style={{ clipPath: "inset(0 -100vw)", ...style }}
      initial={false}
      animate={animateWidth && width != null ? { width } : undefined}
      transition={reduce ? { duration: 0 } : WIDTH_SPRING}
      {...(props as React.ComponentProps<typeof motion.span>)}
    >
      <span ref={sizer} aria-hidden className="invisible inline-block whitespace-pre">
        {text}
      </span>
      <span className="sr-only">{text}</span>
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          aria-hidden
          initial="initial"
          animate="animate"
          exit="exit"
          variants={reduce ? FADE_VARIANTS : undefined}
          className="absolute top-[0.1em] left-0 inline-block whitespace-pre"
        >
          {reduce
            ? text
            : letters.map((char, i) => (
                <motion.span
                  // The position is the slot: the letter at a position is what rolls.
                  key={i}
                  custom={i * stagger}
                  variants={LETTER_VARIANTS}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="inline-block whitespace-pre will-change-[transform,filter,opacity]"
                >
                  {char}
                </motion.span>
              ))}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}

export { TextCascade, useContentWidth, SWAP_SPRING, WIDTH_SPRING, EASE_OUT, type TextCascadeProps }
