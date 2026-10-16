# Copy

The preview explains the component. Text only covers what the preview can't show. (The same rules ship
alone as the `copy-density` skill.)

## Rules

1. **Overview cards: name and preview only.** No description on gallery or overview cards. Never write the
   colon-list pattern ("X: a, b, c and d") anywhere.
2. **The preview is the explanation.** Where a live preview is shown, text never describes what it
   already shows (layout, look, motion, states).
3. **Implementation details stay on the detail page.** Install paths, pixel values, variant lists and file
   locations never appear in cards, nav, search or ledes; they go in the page body (an example, a note,
   the API table).
4. **Example blocks are title, preview and code.** At most one lead-in sentence, and it says *when to use*
   it, never *what it is*. When the title says it, drop the sentence.
5. **No stacked adjectives.** Drop complete, comprehensive, powerful, seamless, robust, beautiful, modern,
   flexible, fully-featured, blazing.
6. **Self-check.** Any card or lede over two lines gets cut to one. Delete any sentence the preview, the
   title or the API table already says.

## Where text goes

| Surface | Allowed |
| --- | --- |
| Gallery and overview card | Name only |
| Registry `description` (CLI, nav search, page lede, `<meta>`) | One plain sentence, 12 words or fewer, what it is for; no values, lists or paths |
| Detail page example | Title, plus an optional "when to use" sentence |
| Notes, API table | What the preview can't show (keyboard, accessibility, reduced motion, edge cases) and exact values |
| Guides and changelog | Short paragraphs on what changed or what to do; no marketing |

## Rewrites

- ❌ "Buttons in six variants: default, secondary, outline, ghost, destructive and link."
  ✅ "Triggers an action or submits a form."
- ❌ "A powerful, fully accessible date picker with seamless keyboard support."
  ✅ "Picks a single date or a range."
- ❌ Example "Disabled": "A disabled button that can't be clicked." ✅ *(no sentence)*

## Wording

- Sentence case for headings, labels and buttons; product names keep their own case.
- Name the job, not the origin: "block editor", "desktop density", "the dialog primitive", "the syntax
  highlighter". Never name the projects or products behind a piece in comments, copy, demo data or
  docs, and never write `after X`, `X-style`, `X-like`, `port of`, `inspired by` or `based on`. Licence attribution lives only in the project's notices file. Package names stay where they
  are needed: imports, dependency lists, install commands, public API names.
- Labels say what happens ("Delete project", not "OK"); errors say what to do next; empty states say what
  the space is for and the one action that fills it.

## Long-form prose

Guides, changelogs, notes and blog or docs pages render inside a `typeset typeset-docs` container. Don't
hand-style headings, paragraphs and lists inside it; put `not-typeset` on components dropped into prose.
