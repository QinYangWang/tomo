# Foundations

Every value lives in the theme stylesheet (`app/globals.css` in a project that installed `@qinyang/theme`).
Use the tokens below; add a new one only in its own reviewed change, with a light and a `.dark` value and
an `@theme inline` mapping.

## Colour roles

Values are steps of 12-step colour scales, written as hex with a display-p3 copy under
`@supports (color: color(display-p3 1 1 1))`. Alpha steps stay alpha, so text, fills and borders read on
any surface.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#fff` | `oklch(15% 0 0)` | page |
| `card` | `#fff` | `#111` | cards, tables, code, raised controls |
| `popover` | `#fff` | `#222` | menus, popovers, dialogs |
| `shell` | `#f6f6f6` | `#000` | app chrome behind an inset panel |
| `surface-sunken` / `surface-standout` | black a1 / gray 12 | black a6 / `#222` | wells, inverted callouts |
| `foreground` | gray a12 | gray a12 | text |
| `muted-foreground` | gray a11 | gray a11 | secondary text, nav icons |
| `fg-tertiary` / `fg-disabled` | gray a9 / a8 | same steps | meta, disabled text |
| `secondary`, `muted` | gray a3 | gray a3 | **translucent** default and hover fills |
| `accent` | gray a4 | gray a4 | **translucent** stronger hover / selected fill |
| `border` / `border-subtle` / `border-strong`, `input` | gray a3 / a2 / a6 | same steps | hairlines, field edges |
| `destructive` / `success` / `warning` | tomato 9 / green 9 / orange 9 | same | status solids; each has `-hover` (10), `-foreground`, `-subtle` (a3), `-border` (a6) |
| `code` | gray 2 | gray 2 | code block background |
| `chart-1` … `chart-8` | see `charts.md` | | data series |

- Washes: `bg-success-subtle inset-ring inset-ring-success-border` (badges, chips, alerts). Opacity
  modifiers (`ring-primary/20`) are fine for one-offs.
- `secondary`, `muted` and `accent` are fills, not surfaces. Anything opaque uses `bg-card`, `bg-popover` or
  `bg-background`.
- No gradient sheens, inset highlights, text shadows or glows.

## Accent

Eight roles carry the accent: `primary` (solid, step 9), `primary-hover` (10), `primary-active` (11),
`primary-foreground`, `primary-subtle` (a3), `primary-subtle-hover` (a4), `primary-border` (a6) and `ring`
(a8 light, a9 dark, used at `/50`). The default is blue `#0090ff`.

Presets (neutral, green, orange, rose, violet) are `html[data-accent="…"]` blocks that swap the eight on
the same steps of their own scale; neutral is the inverted black/white solid. Each ships as a
`theme-<name>` registry item. Filled controls hover to `bg-primary-hover`; text on any solid is its
`*-foreground`. Charts never follow the accent.

## Elevation

| Level | Tailwind | Named tokens | Use |
| --- | --- | --- | --- |
| border | `shadow-xs` | `shadow-chip`, `shadow-pressed` | keys, small chips |
| default | `shadow-sm` | `shadow-raised` → `hover:shadow-raised-hover` | resting controls, cards, tables, code |
| lg | `shadow-md`, `shadow-lg` | `shadow-surface` | popovers, menus, floating panels |
| xl | `shadow-xl` | | dialogs, alert dialogs, drawers, sheets, command palette |
| inset | | `shadow-well` | fields and tracks |
| primary | | `shadow-primary` | filled primary |

Each level includes its hairline (a 0.5–1px ring), so don't add a CSS border to a shadowed surface. Dark
elevation is an inset white hairline plus deeper drops. Hover on rows, menu items, ghost and outline
buttons and nav is a fill (`bg-secondary`), not a ring. App chrome: `bg-shell` with the `shell-inset`
utility (0.5px hairline, `rounded-shell`, 3px gap).

## Radius

`--radius` is 0.5rem. Tokens are multiples of it, clamped at `--radius-max` (1rem):

| Token | × | Default | Use |
| --- | --- | --- | --- |
| `rounded-xs` (`2xs`) | 0.25 | 2px | carets, tiny marks |
| `rounded-sm` | 0.5 | 4px | xs buttons, checkboxes |
| `rounded-md` | 0.75 | 6px | tab indicators in a `p-0.5` list |
| `rounded-lg` | 1 | 8px | buttons, inputs, triggers, tab lists, menu and select rows |
| `rounded-xl` | 1.25 | 10px | cards, tables, code blocks |
| `rounded-2xl` | 1.5 | 12px | menus and popups (`p-1`, rows 12 − 4 = 8px), two-layer inset cards |
| `rounded-3xl` | 2 | 16px | containers holding controls 8px in (prompt bars, composers, rails), dialogs |
| `rounded-shell` | 1.5 | 12px | the rail's inset panel |
| `rounded-4xl`, `rounded-5xl` | | 16px | old names at the cap; don't use |

Presets: none 0, sm 0.375rem, default 0.5rem, lg 0.625rem, xl 0.875rem; a custom value goes up to 1rem.
`html[data-radius="…"]` or an inline `--radius` on `<html>` switches them.

### Concentric nesting

Declare the container with `frame-*` and the child follows it:

```tsx
<div className="frame-2xl frame-p-1 bg-popover shadow-surface">   {/* 12px, 4px in */}
  <div className="rounded-inner px-2 hover:bg-secondary">…</div>  {/* 12 − 4 = 8px */}
</div>
```

| Utility | On | Does |
| --- | --- | --- |
| `frame-{sm…3xl,shell}` | container | its radius; publishes radius − inset to descendants |
| `frame-p-{n}` | container | padding on all sides and the inset used in the maths |
| `frame-inset-{n}` | container | only the inset (gap from a wrapper, asymmetric padding) |
| `frame-border` | container | counts a 1px border into the inset |
| `rounded-inner`, `rounded-{t,b,s,e}-inner` | child | frame radius − inset (min 2px); `rounded-lg` outside any frame |
| `frame-inner` | padded child | takes the inner radius and publishes its own (level 2). Never with `rounded-inner` on the same element |
| `rounded-inner-{token}` | child | concentric in a frame, `{token}` outside one |
| `rounded-inner-or-{token}` | child | inner radius when usable, else `{token}` capped at `rounded-sm` |

When it applies: insets of 8px or less are always concentric. If radius − inset would be under 4px the
container is too loose: the child keeps its own token (or tighten the padding). For 9–15px insets,
surfaces (rows, panels, wells, media) stay concentric; self-contained controls keep their token. A child
is never rounder than its container. Two levels are supported; a third computes its value.

## Type

Inter Variable (`ss03`) → Noto Sans SC → system for UI; JetBrains Mono → system mono for code, keys and
terminals; Newsreader → Noto Serif SC only in the reading preset. Letter spacing normal. Self-hosted
through the `fonts` item; the theme falls back to system fonts without it.

| Size | px | Use |
| --- | --- | --- |
| `text-ui-2xs` | 10 | tiny meta |
| `text-ui-xs` | 11 | meta, shortcuts, counts |
| `text-ui-sm` | 12 | captions, badges, small controls, tooltips |
| `text-ui` | 13 | default UI: buttons, inputs, menus, nav, body inside components |
| `text-ui-lg` | 14 | lg controls, card titles |

Tailwind's `text-sm`–`text-2xl` are for reading copy and page or section headings; `text-3xl`+ only for
heroes. Weights: 400, 450 (`font-semimedium`), 500, 600, 700. Titles semibold (`tracking-tight` only from
`text-xl`), labels and buttons medium, secondary text `text-muted-foreground`. `text-balance` on headings,
`text-pretty` on paragraphs, `tabular-nums` on numbers that change or align. Inline code in prose sits a
little smaller than the text around it (`0.85em`–`0.9em`).
