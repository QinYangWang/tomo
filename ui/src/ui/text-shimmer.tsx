import * as React from "react"

import { cn } from "@/lib/utils"

type TextShimmerTag = "span" | "p" | "div" | "h1" | "h2" | "h3" | "h4"

type TextShimmerProps = React.HTMLAttributes<HTMLElement> & {
  as?: TextShimmerTag
  /** Seconds for one sweep. */
  duration?: number
  /** Width of the bright band; 14 spans about half the text. */
  spread?: number
}

// Shipped with the component (React hoists and dedupes it by href) so an
// installed copy brings its own keyframes and reduced-motion rule.
const SHIMMER_CSS =
  "@keyframes qy-text-shimmer{from{background-position:100% 0}to{background-position:0% 0}}" +
  "@media (prefers-reduced-motion: reduce){[data-slot=text-shimmer]{animation:none!important;background-position:50% 0!important}}"

/**
 * The gradient is sized from the band so the band starts fully left of the
 * text and ends fully right of it: the loop resets while nothing bright is on
 * screen. Positions are in % of the gradient, which is `size` × the text width.
 */
function bandGeometry(spread: number) {
  const half = Math.max(0.04, spread / 60) // half-width as a fraction of the text width
  const size = 2 + 2 * half + 0.1
  const edge = (half / size) * 100
  const core = edge * 0.35
  return { size: size * 100, edge, core }
}

function TextShimmer({
  as = "span",
  duration = 2.2,
  spread = 14,
  className,
  style,
  ...props
}: TextShimmerProps) {
  const Comp = as as React.ElementType
  const { size, edge, core } = bandGeometry(spread)
  const at = (offset: number) => `${(50 + offset).toFixed(2)}%`
  return (
    <>
      <style href="qy-text-shimmer" precedence="default">
        {SHIMMER_CSS}
      </style>
      <Comp
        data-slot="text-shimmer"
        className={cn(
          "inline-block bg-clip-text bg-no-repeat text-transparent [-webkit-background-clip:text]",
          "[--shimmer-base:color-mix(in_oklch,var(--muted-foreground)_78%,transparent)] [--shimmer-highlight:var(--foreground)]",
          className
        )}
        style={
          {
            backgroundImage: `linear-gradient(100deg, var(--shimmer-base) ${at(-edge)}, var(--shimmer-highlight) ${at(-core)}, var(--shimmer-highlight) ${at(core)}, var(--shimmer-base) ${at(edge)})`,
            backgroundSize: `${size.toFixed(1)}% 100%`,
            animationName: "qy-text-shimmer",
            animationDuration: `${duration}s`,
            animationTimingFunction: "cubic-bezier(0.4,0.1,0.6,0.9)",
            animationIterationCount: "infinite",
            ...style,
          } as React.CSSProperties
        }
        {...props}
      />
    </>
  )
}

export { TextShimmer, type TextShimmerProps }
