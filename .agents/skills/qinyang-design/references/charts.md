# Charts

## Palette

`chart-1` … `chart-8` are fixed hues from the same scales as the theme: blue, orange, violet, green, pink,
amber, cyan, gray. Step 9 everywhere, except light orange (10) and amber (11) so every series is at least
3:1 on white; display-p3 copies included.

- Series take them in order (`var(--chart-N)`, `fill-chart-N`, `bg-chart-N`); `chartColor(i)` cycles all
  eight before blending.
- The order keeps neighbours far apart in both modes, and the first pair (blue, orange) survives
  red-green colour blindness. Green and pink are never neighbours.
- Charts never use `primary` and never follow the accent preset: a neutral or green accent would collide
  with the gray or green series.
- Status colours (`success`, `warning`, `destructive`) only where the colour means a status (up/down,
  errors).

## Swatches and labels

- Legend and tooltip swatches are round dots (`ChartSwatch`), so they read the same at every radius. A
  heat-map's "Less … More" key keeps the cell shape because it is a key to the cells.
- Labels on a filled shape pick their colour from the fill's luminance (`onFill`), never fixed white.
- Numbers in axes, tooltips and legends are `tabular-nums`. Donut and gauge labels stay inside the ring.
- Grid lines are `border-subtle`; axes `muted-foreground` at `text-ui-xs`.
