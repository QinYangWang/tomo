# Registry, CLI and upgrades

## Installing

Add the namespace to `components.json`, then install the theme and any item:

```json
{ "registries": { "@qinyang": "https://qinyangwang.github.io/ui/r/{name}.json" } }
```

```bash
npx shadcn@latest add @qinyang/theme
npx shadcn@latest add @qinyang/button @qinyang/menu
npx shadcn@latest view @qinyang/card        # inspect before installing
```

Templates install whole screens (`@qinyang/saas`, `@qinyang/agent-workspace`, `@qinyang/docs`,
`@qinyang/blog`, `@qinyang/vscode`). Components list the icon set as a dependency: when the CLI asks to
overwrite `components/icons.tsx`, answer no to keep your icon style.

## This skill

```bash
npx skills add QinYangWang/ui --skill qinyang-design   # agent skill (rules, references, checks)
npx shadcn@latest add @qinyang/design-skill            # same files through the shadcn CLI
```

The registry copy lands in `.agents/skills/qinyang-design/`. Run the check from the project root:
`node .agents/skills/qinyang-design/scripts/check.mjs`.

## Upgrading

The CLI merges a newer theme into your stylesheet: it adds and updates variables but never deletes one.
After a theme update:

```bash
npx shadcn@latest add @qinyang/theme --overwrite
npx shadcn@latest add @qinyang/upgrade-check
node scripts/qinyang-upgrade-check.mjs          # report; exit 1 when something needs fixing
node scripts/qinyang-upgrade-check.mjs --fix    # also cleans the stylesheet
```

It finds the removed accent ramp, broken wide-gamut overrides, repeated `@property` rules, themes without
the 16px cap or with `--radius` above 1rem, and source that still uses removed classes. The design check
runs it when it is installed.

## Adding an item (library maintainers)

1. Component in `registry/<style>/ui/<name>.tsx` (or `blocks/<name>/`), named parts with `data-slot`,
   variants with `cva`, `className` through `cn`.
2. One demo per item, written as a consumer (tokens only, layout classes on components).
3. The `registry.json` entry: `name`, `type`, `title`, a one-sentence `description` (12 words or fewer),
   `dependencies`, `registryDependencies` (`@qinyang/theme`, `@qinyang/icons`, `@qinyang/icon-chip` …),
   `files`, `meta.category`.
4. Template parts are named for their job and never share a name with a registry item.
5. Run the linter, the type check, this skill's check, and rebuild the registry. After changing radii or
   padding on nested surfaces, run the runtime radius audit (or `scripts/radius-probe.js` on the page).

## The checks

| Check | Catches | Run |
| --- | --- | --- |
| `scripts/check.mjs` | Static rules (see `--list`) | `node <skill>/scripts/check.mjs [paths]` |
| `scripts/radius-probe.js` | Nested radii as rendered, including open menus and hovered rows | paste in the console on the page |
| Upgrade check | Stale theme leftovers | `node scripts/qinyang-upgrade-check.mjs` |
| Linter (`@shadcn/lint` + the concentric rule) | Restyles, raw colours, arbitrary values | `eslint .` |

Allow-list an intentional finding in `qinyang-design.config.json` with a reason:

```json
{ "allow": [{ "rule": "type-scale", "file": "components/card-art.tsx", "reason": "card artwork" }] }
```

or on one line with a comment `design-check-ignore <rule> -- <reason>` above it.
