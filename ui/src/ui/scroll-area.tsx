"use client"

import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"

import { cn } from "@/lib/utils"

type ScrollAreaOrientation = "vertical" | "horizontal" | "both"

/** Extra room (px) between a scrollbar and one side of the frame, added to `scrollbarInset`. */
type ScrollAreaScrollbarMargin = {
  top?: number
  bottom?: number
  start?: number
  end?: number
}

/* Track thickness. Where both bars show, each stops 8px (track + 2px gap) short of the other. */
const TRACK = 6

type ScrollAreaViewportProps = Omit<React.ComponentProps<"div">, "ref" | "className" | "children"> & {
  [key: `data-${string}`]: string | boolean | undefined
}

type ScrollAreaProps = Omit<React.ComponentProps<"div">, "dir"> & {
  /** Classes for the element that scrolls. Put `max-h-*` here for an auto-height area. */
  viewportClassName?: string
  /** Ref to the element that scrolls, for scroll listeners, virtualizers and `scrollTo`. */
  viewportRef?: React.Ref<HTMLDivElement>
  /** Props for the element that scrolls (role, aria, tabIndex, onScroll, style). */
  viewportProps?: ScrollAreaViewportProps
  /** Which scrollbars to show. The other axis is clipped. */
  orientation?: ScrollAreaOrientation
  /** Gap (px) between each scrollbar and the frame edges. */
  scrollbarInset?: number
  /** Extra room on one side, such as a sticky header's height on `top`. */
  scrollbarMargin?: ScrollAreaScrollbarMargin
  /** Fade content out at an edge while there is more to scroll there. */
  fade?: boolean
}

const FADE = "24px"

/*
 * Distance from a frame end at which a track can start so its rounded cap
 * clears a corner of radius `r` by 1px. Small radii need no more than `inset`.
 */
function cornerClearance(r: number, inset: number) {
  const cap = TRACK / 2
  const across = r - inset - cap
  if (r <= 0 || across <= 0) return inset
  const room = r - cap - 1
  const along = Math.sqrt(Math.max(0, room * room - across * across))
  // Whole px: the primitive sizes the thumb from the track's rounded offsetHeight.
  return Math.max(inset, Math.ceil(r - cap - along))
}

/**
 * Publishes per-end track insets that follow the frame's own corner radii, and
 * the radii themselves (`--scroll-area-radius-top` / `-bottom`) for overlays.
 */
function useCornerInsets(ref: React.RefObject<HTMLDivElement | null>, inset: number, deps: unknown[]) {
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const cs = getComputedStyle(el)
      const cap = Math.min(el.offsetWidth, el.offsetHeight) / 2
      const end = cs.direction === "rtl" ? "Left" : "Right"
      const start = cs.direction === "rtl" ? "Right" : "Left"
      const radius = (corner: string) => Math.min(parseFloat(cs.getPropertyValue(`border-${corner}-radius`)) || 0, cap)
      const set = (name: string, r: number) => el.style.setProperty(name, `${cornerClearance(r, inset)}px`)
      set("--scroll-area-end-top", radius(`top-${end.toLowerCase()}`))
      set("--scroll-area-end-bottom", radius(`bottom-${end.toLowerCase()}`))
      set("--scroll-area-end-start", radius(`bottom-${start.toLowerCase()}`))
      set("--scroll-area-end-end", radius(`bottom-${end.toLowerCase()}`))
      // The frame's own radii, for overlays inside it that follow its edge.
      el.style.setProperty("--scroll-area-radius-top", `${Math.max(radius("top-left"), radius("top-right"))}px`)
      el.style.setProperty("--scroll-area-radius-bottom", `${Math.max(radius("bottom-left"), radius("bottom-right"))}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, inset, ...deps])
}

function fadeMask(orientation: ScrollAreaOrientation): React.CSSProperties | undefined {
  const y = `linear-gradient(to bottom, transparent, #000 min(${FADE}, var(--scroll-area-overflow-y-start, 0px)), #000 calc(100% - min(${FADE}, var(--scroll-area-overflow-y-end, 0px))), transparent)`
  const x = `linear-gradient(to right, transparent, #000 min(${FADE}, var(--scroll-area-overflow-x-start, 0px)), #000 calc(100% - min(${FADE}, var(--scroll-area-overflow-x-end, 0px))), transparent)`
  const image = orientation === "vertical" ? y : orientation === "horizontal" ? x : `${y}, ${x}`
  return {
    maskImage: image,
    WebkitMaskImage: image,
    ...(orientation === "both" ? { maskComposite: "intersect", WebkitMaskComposite: "source-in" } : null),
  }
}

/**
 * Scroll container with thin overlay scrollbars. Each track sits inside the
 * frame, `scrollbarInset` from every edge (a little more at a corner whose
 * radius would otherwise clip the thumb's cap), and its thumb maps the whole
 * scroll range.
 */
function ScrollArea({
  className,
  viewportClassName,
  viewportRef,
  viewportProps,
  orientation = "vertical",
  scrollbarInset = 4,
  scrollbarMargin,
  fade = false,
  style,
  children,
  ref,
  ...props
}: ScrollAreaProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const setRootRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )
  useCornerInsets(rootRef, scrollbarInset, [className])
  const vars = {
    "--scroll-area-inset": `${scrollbarInset}px`,
    "--scroll-area-margin-top": `${scrollbarMargin?.top ?? 0}px`,
    "--scroll-area-margin-bottom": `${scrollbarMargin?.bottom ?? 0}px`,
    "--scroll-area-margin-start": `${scrollbarMargin?.start ?? 0}px`,
    "--scroll-area-margin-end": `${scrollbarMargin?.end ?? 0}px`,
  } as React.CSSProperties
  const { style: viewportStyle, ...restViewportProps } = viewportProps ?? {}

  return (
    <ScrollAreaPrimitive.Root
      ref={setRootRef}
      data-slot="scroll-area"
      data-orientation={orientation}
      className={cn(
        "relative min-h-0 overflow-hidden",
        // Where both bars show, each stops short of the other.
        orientation === "both" &&
          "data-has-overflow-x:[--scroll-area-corner-y:8px] data-has-overflow-y:[--scroll-area-corner-x:8px]",
        className
      )}
      style={{ ...vars, ...style }}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
          viewportClassName
        )}
        style={{
          ...(orientation === "vertical" ? { overflowX: "hidden" } : orientation === "horizontal" ? { overflowY: "hidden" } : null),
          ...(fade ? fadeMask(orientation) : null),
          ...viewportStyle,
        }}
        {...restViewportProps}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {orientation !== "horizontal" ? <ScrollBar orientation="vertical" /> : null}
      {orientation !== "vertical" ? <ScrollBar orientation="horizontal" /> : null}
    </ScrollAreaPrimitive.Root>
  )
}

/**
 * One overlay scrollbar. `ScrollArea` renders its own; use this directly only
 * inside a `ScrollArea` composed from the primitive parts.
 */
function ScrollBar({
  className,
  orientation = "vertical",
  style,
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  const vertical = orientation === "vertical"
  const inset = "var(--scroll-area-inset, 4px)"
  // Inline so it replaces the primitive's edge-to-edge placement.
  const place: React.CSSProperties = vertical
    ? {
        top: `calc(var(--scroll-area-end-top, ${inset}) + var(--scroll-area-margin-top, 0px))`,
        bottom: `calc(var(--scroll-area-end-bottom, ${inset}) + var(--scroll-area-margin-bottom, 0px) + var(--scroll-area-corner-y, 0px))`,
        insetInlineEnd: `calc(${inset} + var(--scroll-area-margin-end, 0px))`,
        width: TRACK,
      }
    : {
        insetInlineStart: `calc(var(--scroll-area-end-start, ${inset}) + var(--scroll-area-margin-start, 0px))`,
        insetInlineEnd: `calc(var(--scroll-area-end-end, ${inset}) + var(--scroll-area-margin-end, 0px) + var(--scroll-area-corner-x, 0px))`,
        bottom: `calc(${inset} + var(--scroll-area-margin-bottom, 0px))`,
        height: TRACK,
      }

  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "z-30 flex touch-none rounded-full opacity-0 transition-opacity delay-300 duration-300 select-none",
        "data-hovering:opacity-100 data-hovering:delay-0 data-hovering:duration-150 data-scrolling:opacity-100 data-scrolling:delay-0 data-scrolling:duration-0",
        // Wider hit area than the 6px track.
        "after:absolute after:-inset-1",
        vertical ? "flex-col" : "flex-row",
        typeof className === "string" ? className : undefined
      )}
      style={{ ...place, ...(typeof style === "object" ? style : null) }}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className={cn(
          "relative z-10 shrink-0 rounded-full bg-(--scrollbar) transition-colors duration-150 hover:bg-(--scrollbar-hover) active:bg-(--scrollbar-hover)",
          vertical ? "w-full" : "h-full"
        )}
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export {
  ScrollArea,
  ScrollBar,
  type ScrollAreaProps,
  type ScrollAreaViewportProps,
  type ScrollAreaOrientation,
  type ScrollAreaScrollbarMargin,
}
