import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * A third-party logo from the brand icon package, drawn on the same grid and sizes as the
 * icon set. Import each icon on its own so the bundle only carries the logos you use:
 *
 *   import { siGithub } from "simple-icons"
 *   <BrandIcon icon={siGithub} />
 *   <BrandIcon icon={siGithub} color="brand" title="GitHub" />
 *
 * Any `{ title, path, hex }` with a 24×24 path works, so in-house marks for brands the
 * package leaves out fit the same API.
 */

type BrandIconData = {
  /** Brand name; the accessible name when `title` is not given. */
  title: string
  /** SVG path data on a 24×24 grid. */
  path: string
  /** Brand colour, six hex digits without `#`. */
  hex?: string
}

type BrandIconProps = Omit<React.ComponentProps<"svg">, "children" | "color"> & {
  icon: BrandIconData
  /** Pixel size, like the icon set. Buttons and menus size their icons themselves. */
  size?: number
  /** `current` (default) follows the text colour; `brand` paints the brand's own colour. */
  color?: "current" | "brand"
  /**
   * Accessible name. Leave it out when a visible label sits next to the logo (the logo is
   * then hidden from assistive tech); pass it for a logo that stands alone.
   */
  title?: string
  /** Shrinks the mark to the icon set's optical size (default). Turn off for edge-to-edge logos. */
  inset?: boolean
}

/** WCAG relative luminance of a six-digit hex colour. */
function luminance(hex: string) {
  const n = parseInt(hex, 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/**
 * Brand colours that disappear on one of the themes: near-black marks switch to the
 * foreground in dark mode, near-white marks switch to it in light mode.
 */
function brandTone(hex: string | undefined) {
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return "text-current"
  const l = luminance(hex)
  if (l < 0.02) return "text-(--brand) dark:text-foreground"
  if (l > 0.85) return "text-foreground dark:text-(--brand)"
  return "text-(--brand)"
}

function BrandIcon({ icon, size = 18, color = "current", title, inset = true, className, style, ...props }: BrandIconProps) {
  const id = React.useId()
  const brand = color === "brand"
  return (
    <svg
      data-slot="brand-icon"
      data-brand={icon.title}
      width={size}
      height={size}
      // 24px marks fill their box edge to edge; the icon set keeps a 2px margin on the same grid
      viewBox={inset ? "-2 -2 28 28" : "0 0 24 24"}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? id : undefined}
      className={cn("shrink-0", brand && brandTone(icon.hex), className)}
      style={brand && icon.hex ? ({ "--brand": `#${icon.hex}`, ...style } as React.CSSProperties) : style}
      {...props}
    >
      {title && <title id={id}>{title}</title>}
      <path d={icon.path} />
    </svg>
  )
}

export { BrandIcon }
export type { BrandIconData, BrandIconProps }
