"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { EyeIcon, EyeOffIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { useControlSize, type ControlSize } from "@/lib/control-size"
import { Input } from "@/ui/input"

/*
 * Password field with a show / hide button inside its end edge. Takes every
 * Input prop (it is a Field control inside <Field>), plus `revealed` /
 * `onRevealedChange` to control the visibility yourself. `size` follows Input.
 */

// The reveal button stays a square inset 2-4px from the field edge at every size.
const revealClass: Record<ControlSize, string> = {
  xs: "right-0.5 size-5 rounded-xs [&_svg]:size-3.5",
  sm: "right-0.5 size-6 rounded-md [&_svg]:size-4",
  default: "right-1 size-6 rounded-md [&_svg]:size-4",
  lg: "right-1 size-7 rounded-md [&_svg]:size-4",
}

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  revealed?: boolean
  defaultRevealed?: boolean
  onRevealedChange?: (revealed: boolean) => void
}

function PasswordInput({ revealed: revealedProp, defaultRevealed = false, onRevealedChange, className, disabled, size: sizeProp, ...props }: PasswordInputProps) {
  const size = useControlSize(sizeProp)
  const reduce = useReducedMotion()
  const [inner, setInner] = React.useState(defaultRevealed)
  const revealed = revealedProp ?? inner
  const toggle = () => {
    if (revealedProp === undefined) setInner(!revealed)
    onRevealedChange?.(!revealed)
  }
  return (
    <div data-slot="password-input" data-size={size} className="relative flex w-full">
      <Input type={revealed ? "text" : "password"} size={size} disabled={disabled} className={cn(size === "xs" ? "pr-6" : size === "sm" ? "pr-8" : "pr-9", className)} {...props} />
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={revealed ? "Hide password" : "Show password"}
        aria-pressed={revealed}
        className={cn(
          "absolute top-1/2 flex -translate-y-1/2 cursor-pointer items-center justify-center text-muted-foreground outline-none transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-64",
          revealClass[size]
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={revealed ? "hide" : "show"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="flex"
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  )
}

export { PasswordInput }
export type { PasswordInputProps }
