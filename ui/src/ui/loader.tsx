"use client";

import * as React from "react"

import { cn } from "@/lib/utils"
import { useLocale } from "@/ui/locale-provider"

type LoaderVariant = "spinner" | "ring" | "dots" | "bars" | "pulse" | "ripple" | "orbit" | "typing"
/** `default` is an alias of `md`, matching the other components' size names. */
type LoaderSize = "xs" | "sm" | "md" | "default" | "lg"

const SIZES: Record<LoaderSize, number> = { xs: 12, sm: 16, md: 24, default: 24, lg: 32 }
const IN_OUT = "cubic-bezier(0.45,0,0.55,1)"

// Every loop is a CSS keyframe animation shipped with the component (React
// hoists and dedupes it by href). CSS keeps the loops on the compositor, so
// they never stall on a busy main thread and never restart on re-render.
// Each keyframe ends where it starts (or fades to 0 before it resets), and
// staggered parts are offset with negative delays that divide the period, so
// every part runs in phase from the first frame.
const LOADER_CSS =
  "@keyframes qy-loader-tick{from{opacity:1}to{opacity:.2}}" +
  "@keyframes qy-loader-spin{to{rotate:360deg}}" +
  "@keyframes qy-loader-bounce{0%,80%,100%{translate:0 0;opacity:.55}40%{translate:0 var(--qy-lift);opacity:1}}" +
  "@keyframes qy-loader-bar{0%,100%{scale:1 .35}50%{scale:1 1}}" +
  "@keyframes qy-loader-breathe{0%,100%{scale:1}50%{scale:.82}}" +
  "@keyframes qy-loader-wave{0%{scale:var(--qy-from);opacity:0}18%{opacity:var(--qy-peak);animation-timing-function:cubic-bezier(0.33,0,0.67,1)}100%{scale:1;opacity:0}}" +
  "@keyframes qy-loader-type{0%,100%{opacity:.3;scale:.85;translate:0 0}50%{opacity:1;scale:1.1;translate:0 var(--qy-lift)}}" +
  "@keyframes qy-loader-fade{0%,100%{opacity:1}50%{opacity:.35}}" +
  "@media (prefers-reduced-motion: reduce){" +
  "[data-slot=loader] [data-reduce=hide]{display:none}" +
  "[data-slot=loader] [data-reduce=fade]{animation-name:qy-loader-fade!important;animation-duration:var(--qy-fade)!important;animation-timing-function:" +
  IN_OUT +
  "!important;scale:none!important;translate:none!important;rotate:none!important}}"

type PartProps = { s: number; d: (seconds: number) => number }

/** Inline animation for one part; `phase` (0–1) is how far into the loop it starts late. */
function anim(name: string, duration: number, ease: string, phase = 0): React.CSSProperties {
  return {
    animation: `${name} ${duration}s ${ease} infinite`,
    animationDelay: phase ? `${-((1 - phase) * duration).toFixed(3)}s` : undefined,
  }
}

function Spinner({ s, d }: PartProps) {
  // Opacity-only, so it keeps running under reduced motion.
  const ticks = 8
  const dur = d(0.9)
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {Array.from({ length: ticks }, (_, i) => (
        <rect
          key={i}
          x={10.75}
          y={1.5}
          width={2.5}
          height={6.5}
          rx={1.25}
          fill="currentColor"
          transform={`rotate(${(360 / ticks) * i} 12 12)`}
          style={anim("qy-loader-tick", dur, "linear", i / ticks)}
        />
      ))}
    </svg>
  )
}

function Ring({ s, d }: PartProps) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      data-reduce="fade"
      style={{ ...anim("qy-loader-spin", d(0.8), "linear"), transformOrigin: "center" }}
    >
      <circle cx={12} cy={12} r={9.5} stroke="currentColor" strokeOpacity={0.18} strokeWidth={3} />
      <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  )
}

function Dots({ s, d }: PartProps) {
  const size = Math.max(3, Math.round(s / 4.5))
  const dur = d(0.9)
  return (
    <span className="flex items-center" style={{ height: s, gap: size * 0.6 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          data-reduce="fade"
          className="block rounded-full bg-current"
          style={
            {
              width: size,
              height: size,
              "--qy-lift": `${-size * 0.9}px`,
              ...anim("qy-loader-bounce", dur, IN_OUT, (i * 2) / 15),
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  )
}

function Bars({ s, d }: PartProps) {
  const w = Math.max(2, Math.round(s / 8))
  const dur = d(0.9)
  return (
    <span className="flex items-center" style={{ height: s, gap: w * 0.75 }}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          data-reduce="fade"
          className="block rounded-full bg-current"
          style={{ width: w, height: s * 0.8, ...anim("qy-loader-bar", dur, IN_OUT, i / 9) }}
        />
      ))}
    </span>
  )
}

function Pulse({ s, d }: PartProps) {
  const dur = d(1.4)
  const core = 0.38
  return (
    <span className="relative flex items-center justify-center" style={{ width: s, height: s }}>
      {/* The halo spawns at the core's size with opacity 0, as the core
          finishes its breath, so the reset is invisible. */}
      <span
        data-reduce="hide"
        className="absolute inset-0 rounded-full bg-current"
        style={
          {
            "--qy-from": core,
            "--qy-peak": 0.4,
            scale: core,
            opacity: 0,
            ...anim("qy-loader-wave", dur, "cubic-bezier(0.25,0.4,0.45,1)"),
          } as React.CSSProperties
        }
      />
      <span
        data-reduce="fade"
        className="relative block rounded-full bg-current"
        style={{ width: s * core, height: s * core, ...anim("qy-loader-breathe", dur, IN_OUT) }}
      />
    </span>
  )
}

function Ripple({ s, d }: PartProps) {
  const dur = d(1.8)
  const rings = 3
  return (
    <span className="relative block" style={{ width: s, height: s }}>
      {Array.from({ length: rings }, (_, i) => (
        <span
          key={i}
          data-reduce={i ? "hide" : "fade"}
          className="absolute inset-0 rounded-full border-current"
          style={
            {
              borderWidth: Math.max(1.5, s / 14),
              "--qy-from": 0.15,
              "--qy-peak": 1,
              ...anim("qy-loader-wave", dur, "cubic-bezier(0.3,0.5,0.5,1)", i / rings),
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  )
}

function Orbit({ s, d }: PartProps) {
  const size = Math.max(3, s / 5)
  const dur = d(1.1)
  return (
    <span className="relative block" style={{ width: s, height: s }}>
      <span
        className="absolute rounded-full bg-current opacity-30"
        style={{ width: size, height: size, left: (s - size) / 2, top: (s - size) / 2 }}
      />
      {[0, 1].map((i) => (
        <span key={i} className="absolute inset-0" style={{ rotate: `${i * 180}deg` }}>
          <span
            data-reduce="fade"
            className="absolute inset-0"
            style={anim("qy-loader-spin", dur, "cubic-bezier(0.6,0.1,0.4,0.9)")}
          >
            <span
              className="absolute rounded-full bg-current"
              style={{ width: size, height: size, left: (s - size) / 2, top: 0, opacity: i ? 0.6 : 1 }}
            />
          </span>
        </span>
      ))}
    </span>
  )
}

function Typing({ s, d }: PartProps) {
  const size = Math.max(3, Math.round(s / 5.5))
  const dur = d(1.1)
  return (
    <span
      className="flex items-center justify-center rounded-full"
      style={{
        height: s,
        paddingInline: s * 0.32,
        gap: size * 0.7,
        backgroundColor: "color-mix(in oklch, currentColor 12%, transparent)",
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          data-reduce="fade"
          className="block rounded-full bg-current"
          style={
            {
              width: size,
              height: size,
              "--qy-lift": `${-size * 0.35}px`,
              ...anim("qy-loader-type", dur, IN_OUT, i / 6),
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  )
}

const PARTS: Record<LoaderVariant, (props: PartProps) => React.ReactNode> = {
  spinner: Spinner,
  ring: Ring,
  dots: Dots,
  bars: Bars,
  pulse: Pulse,
  ripple: Ripple,
  orbit: Orbit,
  typing: Typing,
}

/**
 * Loading indicator in eight styles. Inherits `currentColor`, so set colour
 * with a text-* class. Reduced motion swaps movement for a soft fade.
 */
function Loader({
  className,
  variant = "spinner",
  size = "md",
  speed = 1,
  label: labelProp,
  style,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  variant?: LoaderVariant
  size?: LoaderSize
  /** Multiplier on animation speed; 2 is twice as fast. */
  speed?: number
  /** Announced to screen readers. */
  label?: string
}) {
  const { labels } = useLocale()
  const label = labelProp ?? labels.loading
  const Part = PARTS[variant]
  const s = SIZES[size]
  const rate = speed > 0 ? speed : 1
  const d = (seconds: number) => +(seconds / rate).toFixed(3)
  return (
    <>
      <style href="qy-loader" precedence="default">
        {LOADER_CSS}
      </style>
      <span
        role="status"
        aria-label={label}
        data-slot="loader"
        data-variant={variant}
        data-size={size === "default" ? "md" : size}
        className={cn("inline-flex shrink-0 items-center justify-center text-current", className)}
        style={{ "--qy-fade": `${d(1.4)}s`, ...style } as React.CSSProperties}
        {...props}
      >
        <Part s={s} d={d} />
      </span>
    </>
  )
}

export { Loader, type LoaderVariant, type LoaderSize }
