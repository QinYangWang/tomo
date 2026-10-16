# Components and composition

## Composing

- Import from the installed files (`@/components/ui/<name>` or wherever `components.json` points).
- Library files own their look. In screens, a component's `className` is for layout only: margins,
  `w-full`, flex/grid placement, position. Card parts take spacing, titles take typography, buttons take
  margins and `w-full`.
- If a style is missing, use a `variant` or `size`, or style a plain wrapper `<div>`. Add a variant to the
  component only when the design needs a new treatment, in its own change.
- Writing a component: named parts with `data-slot`, variants with `cva`, `className` forwarded through
  `cn`, tokens only, radii from `--radius`, `frame-*` on its own root when children use `rounded-inner`.

## Surfaces

- Cards: `rounded-xl bg-card shadow-raised`. Two-layer cards (`<Card variant="inset">` + `<CardPanel>`: a
  tinted `p-1` frame around a raised panel) only for presented content such as demos, media, code and
  featured plans; dashboards keep the plain card. Never stack two-layer cards.
- Popups (menu, context menu, select, combobox): `rounded-2xl p-1 bg-popover shadow-surface`, rows
  `min-h-6.5 px-2 rounded-lg` (inner), separators `mx-2 my-1`. Popovers stay opaque.
- Dialogs, drawers and sheets: `rounded-3xl shadow-xl`, a plain dim backdrop (no blur), `overscroll-contain`
  on anything that scrolls. Keep a dialog mounted and drive it with `open`, so it can animate out.
- Code: static code is `CodeBlock` / `CodeGroup` with markup highlighted at build time. The streaming code
  block is only for code an agent writes or opens live.

## Menus and lists

- A label sits inside its group: `<MenuGroup><MenuLabel>…</MenuLabel>…</MenuGroup>`. The same for
  `SelectLabel` and `ComboboxLabel`. Outside a group the primitive label throws.
- File trees: folders show only the expand chevron, files show their file-type icon in the same column, so
  names at one level align. Indent per level stays narrow (a code-editor sidebar, not a document outline).
- Breadcrumbs end in plain text, no frame on the current page.
- Truncated tab or row labels show the full text in a tooltip.

## People and things

- People and workspaces are avatars (`Avatar`, image or initials, or `GeneratedAvatar` in the one
  illustrated style), round for people, `shape="rounded"` for workspaces and teams. Never a generic icon
  in an avatar slot.
- Other products' logos come from `BrandIcon` (see `icons.md`).

## Not in the library

Removed on purpose and not to be added back: novelty buttons (magnetic, metallic), decorative range
sliders, 3D carousels and tilt cards, glitch or spotlight 404 pages, prediction-market and trading
widgets, the dock, returns calendar, bracket and wheel visualisations, voice orb, thinking shimmer and
the other effect-only pieces. Prefer a plain component plus a token over a showcase effect.
