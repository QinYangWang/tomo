---
name: qinyang-design
description: Design rules, limits and checks for interfaces built with qinyang/ui (the @qinyang shadcn registry). Use when building, reviewing or restyling any screen, component, block or template on it, when writing UI copy or registry descriptions, when picking colours, radii, type, icons, charts or motion, and before committing UI changes (run the check script).
---

# qinyang/ui design

qinyang/ui is a desktop-density component library: a 13px type scale, translucent fills on opaque
surfaces, alpha hairlines, four elevation levels, corners that derive from one `--radius` and stop at
16px, one accent swapped through eight role tokens. These rules keep every screen and every coding
agent on that one style. Each rule is a short instruction, the reason, and what to write; the
references hold the exact values.

## Install

```bash
npx skills add QinYangWang/ui --skill qinyang-design
```

The library itself installs with the shadcn CLI (`npx shadcn@latest add @qinyang/theme`, then any
item). See `references/registry.md`.

## Check

```bash
node .agents/skills/qinyang-design/scripts/check.mjs            # wherever the skill was installed
node .agents/skills/qinyang-design/scripts/check.mjs app src    # only these paths
```

Static checks for most of the rules below (tokens, radius cap and concentric nesting, type scale,
tracking, press scale, transitions, icon imports, menu labels, copy density, provenance, registry
names, stale theme). No dependencies; with TypeScript in the project it reads JSX exactly (the native
TypeScript 7 compiler has no parser API, so there it falls back to line checks). Exit code 1
on errors (`--strict`: warnings too), `--json` for tools, `--list` for the rule ids. Configure it in
`qinyang-design.config.json` (allow-list a file with a reason, add names that must not appear in copy);
silence one line with a comment `design-check-ignore <rule> -- <reason>` above it.

Nested radii also need a runtime look: open the screen in a browser (menus open, a row hovered) and
paste `scripts/radius-probe.js` into the console. It lists every rounded element more than 2px off
concentric. Run the check before you commit and fix what it reports; a finding you keep gets an
allow-list entry with its reason.

## Rules

### 1. Colour with theme tokens

Tokens follow the theme, the accent preset and dark mode; palette classes and hex values don't.

Use `bg-card`, `text-muted-foreground`, `bg-success-subtle`, `inset-ring-success-border`, `var(--chart-3)`.
Never `bg-zinc-100`, `text-green-600`, `[#0090ff]` or a hex in a component. `white`/`black` only for scrims.

### 2. Put text on a solid in its foreground token

The neutral accent's solid is near-white in dark mode, so `text-white` disappears on it.

`bg-primary text-primary-foreground`, `bg-destructive text-destructive-foreground`. Hover a filled
control to `bg-primary-hover`, press to `bg-primary-active`, never `/90`.

### 3. Fill for state, surface for panels

`secondary`, `muted` and `accent` are translucent fills; anything that floats or holds content needs an opaque surface.

Hover, selected and track fills use `bg-secondary` / `bg-accent` / `bg-foreground/6`. Cards, popovers,
menus and dialogs use `bg-card`, `bg-popover` or `bg-background`.

### 4. Elevate with shadow tokens, not borders plus shadows

Each shadow level already carries its own hairline, so a CSS border on top doubles the edge.

`shadow-raised` for resting cards, tables, code and controls, `shadow-surface` for popovers and menus,
`shadow-xl` for dialogs, drawers and the command palette, `shadow-well` for fields and tracks, `shadow-chip`
for keys and small chips. Dividers inside a surface are `border-border` (an alpha hairline).

### 5. Keep series on the chart palette

Eight fixed hues read the same under every accent, in both modes, and keep neighbours apart.

Series are `var(--chart-1)` … `var(--chart-8)` in order; status colours only where the colour means a
status. Never `primary` in a chart. Legend and tooltip swatches are round dots.

### 6. Keep nested radii concentric

A child corner that doesn't follow its container's curve reads as a mistake at every radius preset.

Inner radius = outer radius − padding. Put `frame-{token} frame-p-{n}` on the container and
`rounded-inner` on the child; a padded child that holds more rows takes `frame-inner`, never
`frame-inner` and `rounded-inner` together. Insets of 8px or less are always concentric.

### 7. Stay at or under 16px

Past 16px containers turn into blobs and nested parts can't stay concentric.

Use `rounded-sm` … `rounded-3xl`; every token clamps at `--radius-max`. Never `rounded-4xl`/`5xl` in new
code or an arbitrary radius above 1rem. `rounded-full` only for round things: avatars, dots, switches,
slider thumbs, badges and tags, icon-only circular buttons, progress bars.

### 8. Derive every radius from the base radius

Presets and the radius slider rescale `--radius` and the tokens built on it, never literal pixel radii.

Use a token, or `rounded-[calc(var(--radius)*k)]` (clamped with `min(…, var(--radius-max))` above 2×).
Only 1–2px caret radii, `rounded-full` and `rounded-[inherit]` stay literal.

### 9. Use the UI type scale

One compact scale keeps dense screens even; arbitrary sizes drift.

Components use `text-ui-2xs` 10 · `text-ui-xs` 11 · `text-ui-sm` 12 · `text-ui` 13 · `text-ui-lg` 14.
Reading copy and page headings use `text-sm` and up; `text-3xl`+ only for heroes. Never `text-[11px]`.

### 10. Semibold titles, medium labels

Two weights carry the hierarchy; heavier text shouts in a dense layout.

Titles `font-semibold`, labels and buttons `font-medium`, body `font-normal`. `font-bold` only in
reading copy that needs it.

### 11. Keep the font's tracking

The type is spaced for its size; tightening small text makes it harder to read.

`tracking-tight` only from `text-xl` up. Wide tracking only on uppercase labels and shortcut glyphs.

### 12. Use tabular numbers for numbers that change or align

Proportional digits make columns and counters jump.

`tabular-nums` on prices, timers, tickers, table columns and counts. `text-balance` on headings,
`text-pretty` on paragraphs.

### 13. Size controls for desktop density

Desktop screens hold more per view; touch-sized controls waste it.

Buttons and inputs `h-8` (sm `h-7`, xs `h-6`, lg `h-9`), menu rows 26px, sidebar rows `h-8` (sub rows
`h-7`), checkbox 16px, switch 32×20, disabled `opacity-64`. Use component sizes, not heights.

### 14. Space related things closer

Spacing groups content before any border does.

4px grid. Icon + label `gap-1.5`–`gap-2`, control groups `gap-2`–`gap-3`, card padding `p-4`–`p-6`,
sections `gap-6`–`gap-10`. Put space with `gap` on the parent, never padding on a component.

### 15. Start navigation text on one left edge

Indents and guide lines widen the sidebar and break the column the eye follows.

Section labels, group labels and rows share one text edge; hierarchy comes from type and spacing.
The active row is a fill (`bg-secondary` or `bg-foreground/6`) with an optional 2px bar in the gutter.

### 16. Compose the library, don't restyle it

A component's variants and sizes are its design; overriding them per screen forks the style.

Pick a `variant`/`size`; `className` on a component is for layout (margins, `w-full`, grid placement).
If nothing fits, style a plain wrapper, or add a variant to the component in its own change.

### 17. Keep a menu label inside its group

The label names the group for assistive tech, and the primitive label throws outside one.

`<MenuGroup><MenuLabel>Agent</MenuLabel>…items…</MenuGroup>`; the same for select and combobox labels.

### 18. Chevrons for folders, file icons for files

A folder icon next to a chevron says the same thing twice and pushes names apart.

Folders show only the expand chevron; files show their file-type icon in the same column, so names
at one level line up.

### 19. Draw icons from one family per group

Two glyph families in one group look like two different products.

Navigation, rails, docks, tab bars and palettes use the solid family (`InboxIcon`, `CalendarDaysIcon`,
`TerminalSquareIcon`); line glyphs are for controls (chevrons, close, add, search). Icons come from
`@/components/icons` only, 16px and muted in navigation.

### 20. Frame title icons, keep nav icons bare

A frame marks an icon as the subject of a card; in a list it is clutter.

Card, alert and header icons sit in `<IconChip>` (one size per list, tone for status). Nav, toolbar
and inline icons are bare and take their size from the control.

### 21. Use real brand marks for other products

Redrawn or approximated logos look wrong to anyone who knows the brand.

`<BrandIcon icon={siGithub} />` with one named import per logo; `color="brand"` where the logo is the
content, the default `current` in toolbars and nav. Brands the set leaves out get a neutral icon.

### 22. Show people and workspaces as avatars

An avatar says "who"; a generic icon in that spot says nothing.

`<Avatar>` with an image, a generated face or initials, round for people, `shape="rounded"` for workspaces
and teams.

### 23. Answer a press with a fill

Native controls don't shrink when pressed; scaling every button makes the screen feel springy.

Buttons, triggers, toggles, nav rows, checkboxes and radios change fill on `:active`. Press scale only
where the motion is the component's point (hold or slide actions, expanding controls, card stacks).

### 24. Transition named properties, briefly

`transition-all` animates layout you didn't mean to, and slow hovers feel laggy.

`transition-colors` or `transition-[box-shadow,background-color]`; `duration-150` for hover and press,
`200` for state changes, `300` for reveals; ease `cubic-bezier(0.22,1,0.36,1)`. Springs stay bounce-free:
stiffness 380–520, damping 26–42, mass 0.5–0.7.

### 25. Gate movement on reduced motion

Movement, scale and blur can make some readers ill; an opacity fade carries the same change.

`useReducedMotion()`, `motion-safe:` / `motion-reduce:`; under reduce, cross-fade instead of cutting.
Popups enter from `scale-98` plus opacity; exits are shorter than entrances.

### 26. Show a ring on keyboard focus

Keyboard users need to see where they are; a hover style doesn't help them.

`focus-visible:ring-2 focus-visible:ring-ring/50` on everything interactive. `outline-none` only with
that ring. Check every change in light and dark.

### 27. Let the preview explain

A live preview already shows the look, layout and states; text that repeats it is noise.

Overview cards show the name and the preview only. Example blocks are title, preview and code, with at
most one lead-in sentence that says when to use it.

### 28. Keep descriptions to one plain sentence

A registry description is the page lede, the search text and the meta tag at once.

One sentence of 12 words or fewer, no values, lists or paths. Exact values go in the API table or a note.

### 29. Never write colon lists or stacked adjectives

"X: a, b, c and d" and "powerful, seamless" read as filler.

Say what the thing does. Drop complete, comprehensive, powerful, seamless, robust, modern, flexible.

### 30. Describe what it does, not where it came from

Copy names the job, not the projects behind it.

"Block editor", "the syntax highlighter", "desktop density". No `inspired by`, `port of` or `X-style` in
comments, copy or docs; licence notices live in one notices file. Package names stay where they are
needed: imports, dependencies, install commands.

### 31. Name template parts apart from registry items

A part file named like an item (`parts/avatar.tsx` next to the `avatar` item) collides on install and in imports.

Name parts for their job: `parts/author-avatar.tsx`, `parts/buffers.ts`.

### 32. Run the upgrade check after a theme update

The CLI adds and updates theme variables but never deletes one, so removed tokens linger.

`npx shadcn@latest add @qinyang/upgrade-check`, then `node scripts/qinyang-upgrade-check.mjs` (`--fix`
cleans the stylesheet). The design check runs it for you when it is installed.

## References

| File | Covers |
| --- | --- |
| `references/foundations.md` | Colour roles and values, accent presets, elevation, radius scale and cap, fonts and type |
| `references/components.md` | Composition, lint contracts, menus, cards, file trees, avatars, removed components |
| `references/layout.md` | Density, spacing, shells, sidebars, docs chrome |
| `references/copy.md` | Copy density, descriptions, long-form prose, naming |
| `references/icons.md` | Icon families, sizes, chips, brand marks, drawing new icons |
| `references/charts.md` | Chart palette, order, swatches, labels |
| `references/motion-a11y.md` | Springs, durations, press, reduced motion, focus, dark mode |
| `references/registry.md` | Installing, upgrading, adding items, the checks |
