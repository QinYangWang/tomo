import * as React from "react"
import { useDirection } from "@base-ui/react/direction-provider"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { ArrowUpRightIcon, BookmarkIcon, ChevronDownIcon, FileIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { useLocale } from "@/ui/locale-provider"

const EASE = [0.22, 1, 0.36, 1] as const

type CitationSource = {
  id: string
  title: React.ReactNode
  url?: string
  /** Display domain; derived from `url` when omitted. */
  domain?: string
  /** Short excerpt shown in the hover preview. */
  snippet?: React.ReactNode
  /** Extra line in the preview, e.g. a publish date. */
  meta?: React.ReactNode
  /** Replaces the favicon, e.g. a file icon for a non-web source. */
  icon?: React.ReactNode
  /** Explicit favicon image URL (e.g. self-hosted); used instead of the `favicon` lookup. */
  faviconSrc?: string
}

/**
 * Where favicons come from: `true` (default) uses Google's favicon service,
 * `false` makes no remote request and shows the domain monogram, and a function
 * maps a domain to your own image URL (return `undefined` for the monogram).
 */
type CitationFaviconOption = boolean | ((domain: string) => string | undefined)

function googleFavicon(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
}

function domainOf(source: Pick<CitationSource, "url" | "domain">) {
  if (source.domain) return source.domain
  if (!source.url) return undefined
  try {
    return new URL(source.url).hostname.replace(/^www\./, "")
  } catch {
    return undefined
  }
}

function safeId(prefix: string, id: string) {
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

/* -------------------------------------------------------------------------- */
/* Group context: links inline markers to the reference list                  */
/* -------------------------------------------------------------------------- */

type CitationGroupContextValue = {
  sources: CitationSource[]
  idPrefix: string
  open: boolean
  setOpen: (open: boolean) => void
  highlighted: string | null
  focusSource: (id: string) => void
  favicon?: CitationFaviconOption
}

const CitationGroupContext = React.createContext<CitationGroupContextValue | null>(null)

/**
 * Optional provider around a response: inline `<Citation sourceId>` markers
 * resolve their number from `sources`, and clicking one opens the reference
 * list and briefly highlights the matching row.
 */
function CitationGroup({
  sources,
  idPrefix,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  favicon,
  children,
}: {
  sources: CitationSource[]
  /** Favicon source for every marker, row and stack inside the group. */
  favicon?: CitationFaviconOption
  idPrefix?: string
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "")
  const prefix = idPrefix ?? `cite-${uid}`
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const open = openProp ?? internalOpen
  const [highlighted, setHighlighted] = React.useState<string | null>(null)
  const timer = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange]
  )

  const focusSource = React.useCallback(
    (id: string) => {
      setOpen(true)
      setHighlighted(id)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setHighlighted(null), 1800)
      // Wait for the panel to mount before scrolling to the row.
      window.setTimeout(() => {
        document
          .getElementById(safeId(prefix, id))
          ?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
      }, 60)
    },
    [prefix, setOpen]
  )

  const value = React.useMemo(
    () => ({ sources, idPrefix: prefix, open, setOpen, highlighted, focusSource, favicon }),
    [sources, prefix, open, setOpen, highlighted, focusSource, favicon]
  )
  return <CitationGroupContext.Provider value={value}>{children}</CitationGroupContext.Provider>
}

/* -------------------------------------------------------------------------- */
/* Favicon + stack                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Site favicon in a small raised chip; falls back to a monogram, or `icon`.
 * `favicon` (or the surrounding group's) decides whether a remote image loads.
 */
function CitationFavicon({
  source,
  favicon: faviconProp,
  className,
}: {
  source: Pick<CitationSource, "url" | "domain" | "icon" | "faviconSrc">
  favicon?: CitationFaviconOption
  className?: string
}) {
  const group = React.useContext(CitationGroupContext)
  const favicon = faviconProp ?? group?.favicon ?? true
  const domain = domainOf(source)
  const src =
    source.faviconSrc ??
    (domain && source.url && favicon !== false ? (favicon === true ? googleFavicon(domain) : favicon(domain)) : undefined)
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const showImg = !source.icon && src && failedSrc !== src

  return (
    <span
      aria-hidden
      data-slot="citation-favicon"
      className={cn(
        "relative grid size-5 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-ui-2xs font-semibold text-muted-foreground uppercase shadow-chip [&>svg]:size-3",
        className
      )}
    >
      {source.icon ? (
        source.icon
      ) : showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={14}
          height={14}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
          className="size-3.5 rounded-2xs object-contain"
        />
      ) : domain ? (
        domain.charAt(0)
      ) : (
        <FileIcon />
      )}
    </span>
  )
}

/** Overlapping favicons, e.g. in a collapsed "Sources" summary. */
function CitationStack({
  sources,
  limit = 3,
  favicon,
  className,
}: {
  sources: CitationSource[]
  limit?: number
  favicon?: CitationFaviconOption
  className?: string
}) {
  return (
    <span data-slot="citation-stack" aria-hidden className={cn("flex items-center -space-x-1.5", className)}>
      {sources.slice(0, limit).map((s) => (
        <CitationFavicon key={s.id} source={s} favicon={favicon} className="size-5 rounded-full ring-2 ring-card" />
      ))}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Inline marker with hover preview                                            */
/* -------------------------------------------------------------------------- */

type CitationProps = Omit<React.ComponentProps<"a">, "children"> & {
  /** Source id to resolve from the surrounding CitationGroup. */
  sourceId?: string
  /** Explicit source (when not inside a CitationGroup). */
  source?: CitationSource
  /** Explicit number; derived from the group order when omitted. */
  index?: number
  /** Hover delay in ms before the preview opens. */
  delay?: number
  /** Favicon source for the preview; defaults to the group's. */
  favicon?: CitationFaviconOption
}

/**
 * Inline numbered citation marker. Hover or focus shows a preview card with the
 * source title, domain and excerpt; click jumps to the reference list.
 */
function Citation({
  sourceId,
  source: sourceProp,
  index: indexProp,
  delay = 250,
  favicon,
  className,
  onClick,
  ...props
}: CitationProps) {
  const group = React.useContext(CitationGroupContext)
  // Portaled popups leave the DOM subtree that sets `dir`; carry the provider direction over.
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  const found = sourceId && group ? group.sources.findIndex((s) => s.id === sourceId) : -1
  const source = sourceProp ?? (found >= 0 ? group!.sources[found] : undefined)
  const index = indexProp ?? (found >= 0 ? found + 1 : undefined)
  if (!source) return null

  const domain = domainOf(source)
  const href = group ? `#${safeId(group.idPrefix, source.id)}` : source.url

  return (
    <PreviewCardPrimitive.Root>
      <PreviewCardPrimitive.Trigger
        data-slot="citation"
        delay={delay}
        closeDelay={120}
        href={href}
        target={group ? undefined : "_blank"}
        rel={group ? undefined : "noreferrer noopener"}
        aria-label={`Source ${index ?? ""}: ${typeof source.title === "string" ? source.title : (domain ?? "")}`.trim()}
        onClick={(event) => {
          onClick?.(event)
          if (group && !event.defaultPrevented) {
            event.preventDefault()
            group.focusSource(source.id)
          }
        }}
        className={cn(
          "relative -top-[0.15em] mx-0.5 inline-flex h-[1.35em] min-w-[1.35em] cursor-pointer items-center justify-center rounded-full bg-muted px-1 align-baseline font-sans text-[0.68em] leading-none font-semibold text-muted-foreground tabular-nums no-underline shadow-chip transition-[color,background-color,box-shadow] duration-150 outline-none hover:bg-primary/14 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-primary/14 data-popup-open:text-primary",
          className
        )}
        {...props}
      >
        {index ?? "•"}
      </PreviewCardPrimitive.Trigger>
      <PreviewCardPrimitive.Portal dir={dir}>
        <PreviewCardPrimitive.Positioner side="top" sideOffset={8} collisionPadding={8} className="z-50 outline-none">
          <PreviewCardPrimitive.Popup
            data-slot="citation-preview"
            className={cn(
              "flex w-72 max-w-[calc(100vw-1rem)] origin-(--transform-origin) flex-col gap-2 rounded-2xl bg-popover p-3.5 text-ui text-popover-foreground shadow-surface outline-none",
              "transition-[opacity,scale,translate] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:duration-120",
              "data-starting-style:translate-y-1 data-starting-style:scale-98 data-starting-style:opacity-0 data-ending-style:scale-97 data-ending-style:opacity-0",
              "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100"
            )}
          >
            <div className="flex items-center gap-2 text-ui-sm text-muted-foreground">
              <CitationFavicon source={source} favicon={favicon} />
              <span className="min-w-0 flex-1 truncate">{domain ?? "Source"}</span>
              {index != null ? <span className="font-mono tabular-nums">[{index}]</span> : null}
            </div>
            <div className="leading-snug font-semibold">{source.title}</div>
            {source.snippet ? (
              <p className="line-clamp-3 text-ui-sm leading-relaxed text-muted-foreground">{source.snippet}</p>
            ) : null}
            {source.meta || source.url ? (
              <div className="flex items-center justify-between gap-2 pt-0.5 text-ui-sm text-muted-foreground">
                <span className="truncate">{source.meta}</span>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    Open
                    <ArrowUpRightIcon className="size-3" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </PreviewCardPrimitive.Popup>
        </PreviewCardPrimitive.Positioner>
      </PreviewCardPrimitive.Portal>
    </PreviewCardPrimitive.Root>
  )
}

/* -------------------------------------------------------------------------- */
/* Reference list                                                              */
/* -------------------------------------------------------------------------- */

/** Numbered reference rows; new sources slide in as they stream. */
function CitationList({
  sources: sourcesProp,
  favicon,
  className,
}: {
  sources?: CitationSource[]
  favicon?: CitationFaviconOption
  className?: string
}) {
  const group = React.useContext(CitationGroupContext)
  const reduce = useReducedMotion()
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "")
  const sources = sourcesProp ?? group?.sources ?? []
  const prefix = group?.idPrefix ?? `cite-${uid}`

  return (
    <ol data-slot="citation-list" className={cn("flex flex-col gap-0.5", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        {sources.map((source, i) => {
          const domain = domainOf(source)
          const active = group?.highlighted === source.id
          const Row = source.url ? "a" : "div"
          return (
            <motion.li
              key={source.id}
              layout={reduce ? false : "position"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.3, ease: EASE }}
            >
              <Row
                id={safeId(prefix, source.id)}
                data-highlighted={active || undefined}
                {...(source.url ? { href: source.url, target: "_blank", rel: "noreferrer noopener" } : {})}
                className="group/citation-row flex scroll-m-4 items-center gap-2.5 rounded-xl px-2 py-1.5 transition-[background-color,box-shadow] duration-300 outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50 data-highlighted:bg-primary/10 data-highlighted:shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_30%,transparent)]"
              >
                <span className="w-4 shrink-0 text-right font-mono text-ui-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <CitationFavicon source={source} favicon={favicon} />
                <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
                  <span className="truncate text-ui font-medium text-foreground/90 group-hover/citation-row:text-foreground">
                    {source.title}
                  </span>
                  {domain ? <span className="truncate text-ui-sm text-muted-foreground">{domain}</span> : null}
                </span>
                {source.url ? (
                  <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/citation-row:opacity-100 group-focus-visible/citation-row:opacity-100" />
                ) : null}
              </Row>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ol>
  )
}

/**
 * Collapsible "Sources" summary with favicon stack and count, opening onto the
 * numbered reference list. Inside a CitationGroup it shares the group's open
 * state so inline markers can open it.
 */
function Citations({
  sources: sourcesProp,
  title: titleProp,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  favicon,
  className,
}: {
  sources?: CitationSource[]
  favicon?: CitationFaviconOption
  title?: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}) {
  const { labels } = useLocale()
  const title = titleProp ?? labels.sources
  const group = React.useContext(CitationGroupContext)
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const sources = sourcesProp ?? group?.sources ?? []
  const open = openProp ?? group?.open ?? internalOpen
  const setOpen = (next: boolean) => {
    if (group && openProp === undefined) group.setOpen(next)
    else if (openProp === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }
  if (!sources.length) return null

  return (
    <CollapsiblePrimitive.Root
      data-slot="citations"
      open={open}
      onOpenChange={(next) => setOpen(next)}
      className={cn("flex w-full flex-col text-ui", className)}
    >
      <CollapsiblePrimitive.Trigger className="group/citations -ml-1 inline-flex h-8 w-fit cursor-pointer items-center gap-2 rounded-lg pr-2.5 pl-1.5 text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out outline-none select-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-panel-open:text-foreground">
        <CitationStack sources={sources} favicon={favicon} />
        <span className="font-medium">{title}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-ui-2xs leading-none font-semibold tabular-nums shadow-chip">
          {sources.length}
        </span>
        <ChevronDownIcon className="size-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-panel-open/citations:rotate-180 motion-reduce:transition-none" />
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
        <CitationList sources={sources} favicon={favicon} className="pt-1.5" />
      </CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
  )
}

/** Small "N sources" chip, e.g. for a toolbar. */
function CitationCount({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-ui-sm text-muted-foreground", className)}>
      <BookmarkIcon className="size-3.5" />
      {count} {count === 1 ? "source" : "sources"}
    </span>
  )
}

export {
  Citation,
  CitationGroup,
  CitationList,
  Citations,
  CitationFavicon,
  CitationStack,
  CitationCount,
  type CitationSource,
  type CitationProps,
  type CitationFaviconOption,
}
