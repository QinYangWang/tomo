# Layout and density

## Density

| Thing | Size |
| --- | --- |
| Button | `h-8` default, `sm` `h-7`, `xs`/`icon-xs` `h-6`, `lg` `h-9`; `icon` 32, `icon-sm` 28 |
| Input, select and combobox trigger | `h-8` (`sm` `h-7`), `px-2.5` |
| Menu, select and combobox row | `min-h-6.5` (26px), `px-2`, popup `p-1` |
| Tooltip | `px-2 py-1 text-ui-sm` |
| Sidebar row | `h-8` (sub rows `h-7`), `text-ui`, muted icons, hover `bg-secondary`, active `bg-foreground/6` |
| Checkbox, radio | 16px; switch 32×20 |
| Disabled | `opacity-64` |

Use the component's `size` prop, not heights on the instance.

## Spacing

4px grid. Icon + label `gap-1.5`–`gap-2`; control groups `gap-2`–`gap-3`; card padding `p-4`–`p-6`;
stacked sections `gap-6`–`gap-10`. Related text sits closer together than the content it belongs to
(title and description `gap-1`, sections `gap-6`). Space goes on the parent (`gap`) or as margin on the
child, never as padding added to a component. Vertical padding around text is a little smaller than
horizontal (line height adds the rest).

## Shells

- Apps: a `bg-shell` window with the content in a `shell-inset` panel (hairline, `rounded-shell`, 3px
  gap). Internal dividers are `border-border`.
- Sidebar and header align: the collapse button, back/forward and the right sidebar's buttons sit on one
  row height; the sidebar's text column starts at the header brand's left edge.
- Navigation text starts on one left edge: section labels (`text-ui` semibold), group labels
  (`text-ui-sm` medium muted, `mt-2` above) and rows all put text on the same line, no indent and no guide
  line; chevrons on the right. Active row = fill plus an optional 2px bar in the gutter.
- Documentation chrome is one white surface split by hairlines (sticky `h-12` header with `border-b`,
  text-only sidebar rows, an "On this page" rail from `xl`), not an app shell.

## Scrolling

Scrollable panels use `ScrollArea` so the bar stays inside the frame and spans the scroll range; sticky
headers inside them separate with `border-b`, not a shadow. Collapsing content keeps its size while it
animates closed.

## Responsive

Check every screen at 390, 768 and 1024px wide and in right-to-left. Toolbars collapse labels to icons
(with tooltips) before they wrap; tables scroll horizontally inside their frame.
