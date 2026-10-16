#!/usr/bin/env node
/**
 * Finds what an earlier install of the qinyang/ui theme and components left behind after the
 * theme moved on, and says how to fix each finding.
 *
 *   node scripts/qinyang-upgrade-check.mjs          report only (exit code 1 when something needs fixing)
 *   node scripts/qinyang-upgrade-check.mjs --fix    also clean the stylesheet (stale tokens, broken and duplicate rules),
 *                                                   then scan again and report only what is left (exit code 1 if errors remain)
 *
 * The CLI merges the theme into your stylesheet: it adds and updates variables but never
 * deletes one, so tokens a release removed stay behind. Source findings are never edited.
 */
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const fix = process.argv.includes("--fix")
const findings = []
const note = (level, where, message, hint) => findings.push({ level, where, message, hint })

/* ───────────── stylesheet ───────────── */

function cssPath() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, "components.json"), "utf8"))
    if (cfg?.tailwind?.css && fs.existsSync(path.join(root, cfg.tailwind.css))) return cfg.tailwind.css
  } catch {}
  return ["app/globals.css", "src/app/globals.css", "styles/globals.css", "src/styles/globals.css"].find((p) => fs.existsSync(path.join(root, p)))
}

const RAMP = /^[ \t]*--(?:color-)?accent-(?:50|[1-9]00|950):[^;]*;[ \t]*\n/gm
// Theme installs before version 2.1 wrote the wide-gamut and color-mix overrides without the leading "--".
const UNDASHED =
  /^[ \t]*(?:primary|primary-[a-z-]+|ring|destructive(?:-[a-z]+)?|success(?:-[a-z]+)?|warning(?:-[a-z]+)?|chart-[1-8]|shadow-lg):[^;]*;[ \t]*\n/gm

const fixedFiles = []

function checkCss(file, fix) {
  const abs = path.join(root, file)
  let css = fs.readFileSync(abs, "utf8")
  const before = css

  const ramp = css.match(RAMP) ?? []
  if (ramp.length)
    note("error", file, `${ramp.length} lines of the removed accent ramp (--accent-50 … --accent-950 and their --color-accent-* mappings)`,
      "The accent is now eight role tokens (--primary, --primary-hover, --primary-subtle, …). --fix deletes the old lines; move any bg-accent-500-style classes to the roles first.")
  if (fix) css = css.replace(RAMP, "")

  const undashed = css.match(UNDASHED) ?? []
  if (undashed.length)
    note("error", file, `${undashed.length} wide-gamut or shadow overrides without a leading "--" (browsers ignore them)`,
      "Reinstall the theme to get the working copies, then --fix deletes the broken lines.")
  if (fix) css = css.replace(UNDASHED, "")

  // Theme 2.3 resets the frame inputs on every element in the base layer instead of registering them
  // with @property (the CLI appended a fresh copy of each @property on every reinstall).
  const FRAME_PROP = /^[ \t]*@property --frame-[rpb] \{[^}]*\}[ \t]*\n?/gm
  const frameReset = /--frame-p:\s*0px/.test(css)
  const frameProps = css.match(FRAME_PROP) ?? []
  if (frameProps.length && frameReset)
    note("warn", file, `${frameProps.length} @property --frame-* rules left from theme 2.2 or earlier`,
      "The theme now resets these in @layer base, so the rules are unused. Harmless; --fix deletes them.")
  else if (frameProps.length > 3)
    note("warn", file, `${frameProps.length - 3} repeated @property --frame-* rules (each reinstall of theme 2.2 or earlier appended them)`,
      "Reinstall the theme (2.3 no longer uses @property), then --fix deletes the old rules.")
  if (fix && frameProps.length && frameReset) css = css.replace(FRAME_PROP, "")

  const props = [...css.matchAll(/^[ \t]*@property (--[\w-]+) \{[^}]*\}[ \t]*\n?/gm)]
  const seen = new Set()
  let dupes = 0
  for (const m of props) {
    if (m[1].startsWith("--frame-")) continue
    if (seen.has(m[1])) dupes++
    seen.add(m[1])
  }
  if (dupes)
    note("warn", file, `${dupes} repeated @property rules (each theme reinstall appends them again)`, "Harmless; --fix keeps the first of each.")
  if (fix && dupes) {
    const kept = new Set()
    css = css.replace(/^[ \t]*@property (--[\w-]+) \{[^}]*\}[ \t]*\n?/gm, (all, name) => (name.startsWith("--frame-") || !kept.has(name) ? (kept.add(name), all) : ""))
  }

  const radius = css.match(/:root\s*\{[^}]*?--radius:\s*([^;]+);/)
  if (radius && radius[1].trim() === "0.625rem")
    note("info", file, "--radius is 0.625rem, the default before 2026-10-16 (now 0.5rem)",
      "Keep it if you like the rounder corners (it is the lg preset), or reinstall the theme for 0.5rem.")

  if (/--primary-subtle\s*:/.test(css) && !/--radius-max\s*:/.test(css))
    note("info", file, "radius tokens without the 16px cap (--radius-max, theme 2.2): a --radius above 0.5rem grows cards and menus past 16px",
      "Reinstall the theme to clamp every radius token at --radius-max.")
  const base = radius ?? css.match(/--radius:\s*([\d.]+)rem/)
  if (base && Number.parseFloat(base[1]) > 1)
    note("warn", file, `--radius is ${base[1].trim()}, above the supported 1rem`, "Controls turn into pills and nested parts stop lining up; use 1rem or less.")

  if (!/--primary-subtle\s*:/.test(css) || !/--shadow-border\s*:/.test(css))
    note("error", file, "theme tokens from 2026-10-16 are missing (--primary-subtle, --shadow-border, …)", "Reinstall the theme: shadcn add <registry>/r/theme.json --overwrite")
  else if (!/@utility frame-\*/.test(css))
    note("error", file, "the frame-* and rounded-inner utilities are missing, so nested corners fall back to fixed radii", "Reinstall the theme.")
  if (!/--primary:\s*color\(display-p3/.test(css))
    note("info", file, "no wide-gamut values: colours render in sRGB on P3 screens", "Reinstall the theme to add them.")

  if (/"Inter Variable"/.test(css) && !sourceFiles.some((f) => /fonts\.css/.test(fs.readFileSync(f, "utf8"))) && !/fonts\.css/.test(css))
    note("info", file, "the font stack names Inter, JetBrains Mono and Newsreader but nothing imports fonts.css", "Install the fonts item to self-host them, or keep the system-font fallback.")

  if (fix && css !== before) {
    fs.writeFileSync(abs, css)
    fixedFiles.push(file)
  }
}

/* ───────────── source ───────────── */

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "out" || e.name === "dist") continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(tsx|ts|jsx|js|mdx)$/.test(e.name)) out.push(p)
  }
  return out
}
const sourceFiles = ["app", "components", "src", "lib", "hooks"].flatMap((d) => walk(path.join(root, d)))

const RULES = [
  {
    re: /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|divide|accent|caret)-accent-(?:50|[1-9]00|950)\b/g,
    level: "error",
    message: "accent ramp class (removed on 2026-10-16)",
    hint: "Use a role: bg-primary, bg-primary-subtle, text-primary, border-primary-border, ring-ring.",
  },
  {
    re: /<(?:Input|NativeSelect)\b[^>]*\bsize=\{\s*\d+\s*\}/g,
    level: "error",
    message: "numeric size on Input or NativeSelect (size is now the control size)",
    hint: 'Rename it to htmlSize; size takes "xs" | "sm" | "default" | "lg".',
  },
  {
    re: /className="[^"]*\bbg-primary\b[^"]*\btext-white\b[^"]*"|className="[^"]*\btext-white\b[^"]*\bbg-primary\b[^"]*"/g,
    level: "warn",
    // design-check-ignore on-solid-text -- this rule describes the pattern
    message: "text-white on bg-primary",
    hint: "Use text-primary-foreground: the neutral accent's solid is near-white in dark mode.",
  },
  {
    re: /\bhover:bg-primary\/90\b/g,
    level: "warn",
    message: "hover:bg-primary/90",
    hint: "Use hover:bg-primary-hover, the accent's own hover step.",
  },
]

/** One pass over the source and the stylesheet. With `apply`, the stylesheet fixes are written. */
function scan(apply) {
  findings.length = 0
  for (const file of sourceFiles) {
    const src = fs.readFileSync(file, "utf8")
    for (const rule of RULES) {
      for (const m of src.matchAll(rule.re)) {
        const line = src.slice(0, m.index).split("\n").length
        note(rule.level, `${path.relative(root, file)}:${line}`, rule.message, rule.hint)
      }
    }
  }
  const css = cssPath()
  if (css) checkCss(css, apply)
  else note("error", "components.json", "no global stylesheet found", "Run this from the project root.")
}

// --fix: fix, then scan the result again so the report lists only what is left.
if (fix) {
  scan(true)
  for (const file of fixedFiles) console.log(`fixed ${file}`)
}
scan(false)

/* ───────────── report ───────────── */

const order = { error: 0, warn: 1, info: 2 }
findings.sort((a, b) => order[a.level] - order[b.level])
for (const f of findings) console.log(`${f.level.padEnd(5)} ${f.where}  ${f.message}\n      ${f.hint}`)
const errors = findings.filter((f) => f.level === "error").length
const lead = fix ? "Left after --fix: " : ""
console.log(findings.length ? `\n${lead}${errors} to fix, ${findings.length - errors} to review.` : "Nothing left over from earlier versions.")
process.exit(errors ? 1 : 0)
