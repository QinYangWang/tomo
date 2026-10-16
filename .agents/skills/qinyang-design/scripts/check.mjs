#!/usr/bin/env node
/**
 * Static design checks for projects built on qinyang/ui.
 *
 *   node <skill>/scripts/check.mjs [paths…] [--strict] [--quiet] [--json] [--rules a,b] [--list]
 *
 *   paths      files or folders (default: app, src, components, registry, lib, content, skills
 *              and registry.json, whichever exist)
 *   --strict   exit 1 on warnings too (default: errors only)
 *   --quiet    print errors only
 *   --json     machine-readable output
 *   --rules    run only these rule ids
 *   --list     print the rules and exit
 *
 * No dependencies. TypeScript, when the project has it, gives exact JSX checks (nesting,
 * comments, text); without it the class checks fall back to quoted strings.
 *
 * Config (optional) in qinyang-design.config.json at the project root:
 *   {
 *     "theme": "app/globals.css",
 *     "ignore": ["**\/generated\/**"],
 *     "pressScale": ["expanding-arrow-button"],          // file names allowed a press scale
 *     "names": ["acme"],                                  // words that must not appear in prose
 *     "nameHashes": ["<sha256 prefix>"],                  // same, stored as hashes (see --hash)
 *     "allow": [{ "rule": "type-scale", "file": "blocks/card/**", "reason": "card art" }]
 *   }
 * One line: put `design-check-ignore <rule> -- <reason>` in a comment on the line above.
 */
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const cwd = process.cwd()
const argv = process.argv.slice(2)
const flag = (f) => argv.includes(f)
const opt = (f) => {
  const i = argv.indexOf(f)
  return i >= 0 ? argv[i + 1] : undefined
}
const optValues = new Set([opt("--rules"), opt("--hash")].filter(Boolean))
const inputs = argv.filter((a) => !a.startsWith("--") && !optValues.has(a))

/* ────────────────────────────── rules ────────────────────────────── */

const RULES = {
  "no-palette-colors": ["error", "Colours come from theme tokens, never the Tailwind palette."],
  "no-hex-colors": ["error", "No hex or rgb literals in classes or component CSS; add a token."],
  "on-solid-text": ["error", "Text on a solid uses its *-foreground token, never text-white."],
  "radius-cap": ["error", "Nothing is rounder than 16px: no rounded-4xl/5xl, no arbitrary radius above 1rem."],
  "radius-literal": ["warn", "Radii derive from --radius: use a token or calc(var(--radius)*k)."],
  "concentric-radius": ["warn", "A child inside a padded rounded container is concentric: inner = outer − padding."],
  "type-scale": ["error", "Font sizes come from the scale (text-ui-2xs…text-ui-lg, text-sm…); no text-[Npx]."],
  "tracking": ["warn", "Negative tracking only from text-xl up; wide tracking only on uppercase labels and shortcuts."],
  "no-press-scale": ["error", "Standard controls answer a press with a fill change, not a scale."],
  "no-transition-all": ["error", "Transition named properties, never all."],
  "icon-source": ["error", "Icons come from the house icon set; brand marks from per-logo imports."],
  "menu-label-group": ["error", "A menu, select or combobox label sits inside its group."],
  "copy-description": ["error", "A registry description is one plain sentence of 12 words or fewer."],
  "copy-colon-list": ["warn", "Never write the colon-list pattern (\"X: a, b, c and d\")."],
  "copy-adjectives": ["warn", "No stacked adjectives (complete, powerful, seamless…)."],
  "forbidden-names": ["error", "No third-party names or provenance in comments, copy or prose."],
  "registry-name-collision": ["warn", "A template part's file name must not equal a registry item name."],
  "upgrade": ["warn", "The installed theme is current (stale tokens, missing radius cap)."],
}

if (flag("--list")) {
  for (const [id, [level, text]] of Object.entries(RULES)) console.log(`${id.padEnd(26)} ${level.padEnd(6)} ${text}`)
  process.exit(0)
}
if (opt("--hash")) {
  console.log(hashTerm(opt("--hash")))
  process.exit(0)
}

const only = opt("--rules") ? new Set(opt("--rules").split(",")) : null
const on = (id) => !only || only.has(id)

/* ────────────────────────────── config ────────────────────────────── */

const config = readJson(path.join(cwd, "qinyang-design.config.json")) ?? {}
const PRESS_SCALE_OK = new Set([
  // Components whose motion is the point; everything else answers a press with a fill.
  "expanding-arrow-button", "expandable-control", "card-folder", "message-bubble",
  "hold-action-button", "slide-action-button",
  ...(config.pressScale ?? []),
])
const IGNORE_DIRS = new Set(["node_modules", ".next", "out", "dist", "build", "public", ".git", ".agents", ".claude", ".turbo", "coverage"])
const ignoreGlobs = (config.ignore ?? []).map(globToRegExp)
const allow = (config.allow ?? []).map((a) => ({ ...a, re: a.file ? globToRegExp(a.file) : null }))

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"))
  } catch {
    return null
  }
}

function globToRegExp(glob) {
  let re = ""
  let brace = 0
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === "{") {
      re += "(?:"
      brace++
    } else if (c === "}" && brace) {
      re += ")"
      brace--
    } else if (c === "," && brace) re += "|"
    else if (c === "*" && glob[i + 1] === "*") {
      re += ".*"
      i++
      if (glob[i + 1] === "/") i++
    } else if (c === "*") re += "[^/]*"
    else if (c === "?") re += "[^/]"
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&")
  }
  return new RegExp(`(^|/)${re}$`)
}

/* ────────────────────────────── findings ────────────────────────────── */

const findings = []
function report(rule, file, line, message) {
  if (!on(rule)) return
  const rel = path.relative(cwd, file) || file
  if (allow.some((a) => (a.rule === rule || a.rule === "*") && (!a.re || a.re.test(rel)) && (!a.match || message.includes(a.match)))) return
  const lines = fileLines.get(file)
  const above = lines?.[line - 2] ?? ""
  if (new RegExp(`design-check-ignore\\s+(${rule}|all)\\b`).test(above) || new RegExp(`design-check-ignore\\s+(${rule}|all)\\b`).test(lines?.[line - 1] ?? "")) return
  const key = `${rule}\u0000${rel}\u0000${line}\u0000${message}`
  if (seenFindings.has(key)) return
  seenFindings.add(key)
  findings.push({ rule, level: RULES[rule][0], file: rel, line, message })
}
const seenFindings = new Set()
const fileLines = new Map()

/* ────────────────────────────── files ────────────────────────────── */

const DEFAULT_ROOTS = ["app", "src", "components", "registry", "lib", "content", "skills", "registry.json"]
const roots = (inputs.length ? inputs : DEFAULT_ROOTS).map((p) => path.resolve(cwd, p)).filter((p) => fs.existsSync(p))
const EXTS = /\.(tsx|ts|jsx|js|mjs|cjs|css|md|mdx)$/
const files = []
function walk(p) {
  const st = fs.statSync(p)
  if (st.isDirectory()) {
    if (IGNORE_DIRS.has(path.basename(p))) return
    for (const f of fs.readdirSync(p)) walk(path.join(p, f))
    return
  }
  const rel = path.relative(cwd, p)
  if (ignoreGlobs.some((g) => g.test(rel))) return
  if (/\.generated\.|\.d\.ts$|\.min\./.test(p)) return
  if (p.endsWith("registry.json") || EXTS.test(p)) files.push(p)
}
roots.forEach(walk)

/* ────────────────────────────── TypeScript (optional) ────────────────────────────── */

function loadTs() {
  for (const from of [path.join(cwd, "package.json"), import.meta.url]) {
    try {
      return createRequire(from)("typescript")
    } catch {}
  }
  return null
}
const ts = loadTs()

/* ────────────────────────────── class checks ────────────────────────────── */

const PALETTE =
  /(?:^|[\s:])-?(?:bg|text|border(?:-[trblxyse])?|ring|ring-offset|inset-ring|fill|stroke|from|to|via|outline|shadow|divide|decoration|caret|accent|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/
const HEX_CLASS = /\[(?:[a-z-]+:)?(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/
const RADIUS_TOKEN = /(?:^|[\s:])rounded(?:-[trblse]{1,2})?-(4xl|5xl)\b/
const RADIUS_ARB = /(?:^|[\s:])rounded(?:-[trblse]{1,2})?-\[(\d*\.?\d+)(px|rem)\]/g
// em sizes stay relative to the surrounding text (inline code, superscripts), so they pass.
const TEXT_ARB = /(?:^|[\s:])text-\[(?:length:)?(\d*\.?\d+)(px|rem)\]/
const ICON_PKGS = /^(lucide-react|@heroicons\/react|react-icons|@tabler\/icons-react|@phosphor-icons\/react|@radix-ui\/react-icons|@remixicon\/react|react-feather)(\/|$)/
const CLASSY = /^[\w!:\-[\]/.()%#,&>*@=+'~|^$<]+$/

function looksLikeClasses(s) {
  const t = s.trim()
  if (!t || t.length > 2000) return false
  const tokens = t.split(/\s+/)
  return tokens.every((x) => CLASSY.test(x)) && tokens.some((x) => /-|^(flex|grid|hidden|block|uppercase|truncate)$/.test(x))
}

const SIZE_ORDER = { "ui-2xs": 0, "ui-xs": 1, "ui-sm": 2, ui: 3, "ui-lg": 4, xs: 1, sm: 3, base: 4, lg: 5, xl: 6, "2xl": 7, "3xl": 8, "4xl": 9, "5xl": 10, "6xl": 11, "7xl": 12, "8xl": 13, "9xl": 14 }

function checkClasses(s, file, line) {
  const base = path.basename(file).replace(/\.\w+$/, "")
  if (PALETTE.test(s)) report("no-palette-colors", file, line, `"${s.match(PALETTE)[0].trim()}" is a palette colour; use a token (foreground, muted-foreground, primary, success, chart-N…).`)
  if (HEX_CLASS.test(s)) report("no-hex-colors", file, line, "Arbitrary colour literal in a class; add a token to the theme instead.")
  const tokens = s.split(/\s+/)
  if (tokens.includes("bg-primary") && tokens.includes("text-white")) report("on-solid-text", file, line, "bg-primary with text-white: use text-primary-foreground.")
  const rt = s.match(RADIUS_TOKEN)
  if (rt) report("radius-cap", file, line, `rounded-${rt[1]} is only an alias at the 16px cap; use rounded-3xl (or rounded-full).`)
  for (const m of s.matchAll(RADIUS_ARB)) {
    const px = parseFloat(m[1]) * (m[2] === "rem" ? 16 : 1)
    if (px > 16) report("radius-cap", file, line, `rounded-[${m[1]}${m[2]}] is above the 16px cap.`)
    else if (px > 2) report("radius-literal", file, line, `rounded-[${m[1]}${m[2]}] ignores --radius; use a token or rounded-[calc(var(--radius)*k)].`)
  }
  const ta = s.match(TEXT_ARB)
  if (ta) report("type-scale", file, line, `text-[${ta[1]}${ta[2]}] is off the type scale; use text-ui-2xs…text-ui-lg (10–14px) or text-sm and up for reading copy.`)
  const size = tokens.map((t) => t.match(/^text-(ui(?:-(?:2xs|xs|sm|lg))?|xs|sm|base|lg|[2-9]?xl)$/)?.[1]).find(Boolean)
  const neg = tokens.find((t) => /^(-?tracking-(tight|tighter)|tracking-\[-)/.test(t))
  if (neg && size !== undefined && SIZE_ORDER[size] < SIZE_ORDER.xl) report("tracking", file, line, `${neg} on text-${size}: negative tracking only from text-xl up.`)
  const wide = tokens.find((t) => /^(tracking-(wide|wider|widest)|tracking-\[0?\.)/.test(t))
  if (wide && !tokens.includes("uppercase") && !/shortcut|kbd/.test(s)) report("tracking", file, line, `${wide} on mixed-case text; keep the font's tracking.`)
  if (/(?:^|\s)(?:[\w-]+:)*active:(?:-?scale|scale-)/.test(s) && !PRESS_SCALE_OK.has(base)) report("no-press-scale", file, line, "active:scale on a control; answer the press with a fill (bg-secondary / -hover / -active) instead.")
  if (/(?:^|\s)(?:[\w-]+:)*transition-all\b/.test(s)) report("no-transition-all", file, line, "transition-all: name the properties (transition-colors, transition-[box-shadow,background-color]).")
}

/* ────────────────────────────── prose checks ────────────────────────────── */

// "complete" only as filler before a noun ("a complete set"), not as a state ("once complete").
const ADJECTIVES = /(?<!\b(?:once|when|is|are|be|to|on|goes|marked|as)\s)\bcomplete(?=\s+[a-z]{3,})|\b(comprehensive|powerful|seamless(ly)?|robust|beautiful(ly)?|modern|flexible|fully[- ]featured|blazing(ly)?[- ]fast|blazing|stunning|cutting[- ]edge|best[- ]in[- ]class|world[- ]class)\b/i
const COLON_LIST = /:\s+[^.:;!?]+?,\s+[^.:;!?]+?(?:,\s+[^.:;!?]+?)*,?\s+(?:and|or)\s+[^.:;!?]+/
const PROVENANCE = /\b(inspired by|port of|modell?ed (?:on|after))\b/i

function hashTerm(t) {
  return createHash("sha256").update(t.toLowerCase().trim()).digest("hex").slice(0, 12)
}
const NAME_TERMS = new Set((config.names ?? []).map((n) => n.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()))
const NAME_HASHES = new Set(config.nameHashes ?? [])

function stripSpecifiers(text) {
  return text
    .replace(/`[^`]*`/g, " ") // inline code is an identifier
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/(["'`])[@\w.-]+\/[\w./@-]*\1/g, " ") // package specifiers and paths in quotes
    .replace(/(?:^|\s)@[\w-]+\/[\w./-]+/g, " ") // bare @scope/pkg
}

function checkNames(text, file, line) {
  if (!NAME_TERMS.size && !NAME_HASHES.size) {
    const p = text.match(PROVENANCE)
    if (p) report("forbidden-names", file, line, `"${p[0]}": describe what the thing does, not where it came from.`)
    return
  }
  const words = stripSpecifiers(text).toLowerCase().match(/[a-z0-9]+/g) ?? []
  const p = text.match(PROVENANCE)
  if (p) report("forbidden-names", file, line, `"${p[0]}": describe what the thing does, not where it came from.`)
  for (let i = 0; i < words.length; i++) {
    for (const term of [words[i], i + 1 < words.length ? `${words[i]} ${words[i + 1]}` : null]) {
      if (!term) continue
      if (NAME_TERMS.has(term) || NAME_HASHES.has(hashTerm(term))) {
        report("forbidden-names", file, line, `Third-party name "${term}" in prose; describe the thing instead (licence notices only in THIRD_PARTY_NOTICES.md).`)
        return
      }
    }
  }
}

function checkCopy(text, file, line, kind) {
  const a = text.match(ADJECTIVES)
  if (a) report("copy-adjectives", file, line, `"${a[0]}" in a ${kind}; say what it does.`)
  if (COLON_LIST.test(text)) report("copy-colon-list", file, line, `Colon list in a ${kind}; let the preview or the API table carry the list.`)
}

/* ────────────────────────────── source files ────────────────────────────── */

const RADIUS_PX = { none: 0, xs: 2, "2xs": 2, sm: 4, md: 6, lg: 8, xl: 10, "2xl": 12, "3xl": 16, "4xl": 16, "5xl": 16, shell: 12 }
const LABEL_GROUP = /^(Menu|ContextMenu|DropdownMenu|Menubar|Select|MorphSelect|Combobox)(Group)?Label$/

function boxOf(classes) {
  let radius = null, pad = null, inner = false
  for (const t of classes.split(/\s+/)) {
    if (t.includes(":")) continue
    let m
    if ((m = t.match(/^(?:rounded|frame)-(none|xs|2xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|shell)$/))) radius = RADIUS_PX[m[1]]
    else if (t === "rounded-inner" || t.startsWith("rounded-inner-") || t === "frame-inner" || t === "rounded-[inherit]") inner = true
    else if ((m = t.match(/^(?:p|frame-p)-([\d.]+)$/))) pad = parseFloat(m[1]) * 4
  }
  return { radius, pad, inner }
}

function checkSourceTs(file, text) {
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX : /\.jsx$/.test(file) ? ts.ScriptKind.JSX : /\.ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1

  // Comments, from the scanner so strings and regexes never read as comments.
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, kind === ts.ScriptKind.TSX || kind === ts.ScriptKind.JSX ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard, text)
  for (let tok = scanner.scan(); tok !== ts.SyntaxKind.EndOfFileToken; tok = scanner.scan()) {
    if (tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia) {
      const c = scanner.getTokenText()
      if (/design-check-ignore/.test(c)) continue
      const start = lineOf(scanner.getTokenPos())
      c.split("\n").forEach((l, i) => checkNames(l, file, start + i))
    }
  }

  const classAttr = (el) => {
    const attr = el.attributes?.properties?.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === "className")
    if (!attr?.initializer) return ""
    const parts = []
    const visit = (n) => {
      if (ts.isStringLiteralLike(n)) parts.push(n.text)
      else if (ts.isTemplateExpression(n)) {
        parts.push(n.head.text)
        n.templateSpans.forEach((s) => parts.push(s.literal.text))
      }
      ts.forEachChild(n, visit)
    }
    visit(attr.initializer)
    return parts.join(" ")
  }
  const tagName = (n) => (ts.isJsxElement(n) ? n.openingElement.tagName.getText(sf) : ts.isJsxSelfClosingElement(n) ? n.tagName.getText(sf) : null)
  const opening = (n) => (ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null)

  const visit = (node, ancestors) => {
    // Imports: icon packages.
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text
      if (ICON_PKGS.test(spec)) report("icon-source", file, lineOf(node.getStart(sf)), `"${spec}": use the house icon set (components/icons) for glyphs.`)
      if (spec === "simple-icons" && node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings))
        report("icon-source", file, lineOf(node.getStart(sf)), "import * from the brand icon package pulls in every logo; import each logo by name.")
      return
    }
    if (ts.isExportDeclaration(node) || ts.isExternalModuleReference?.(node)) return
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText?.(sf) === "require")) return

    // Strings: class lists and prose.
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const s = node.text
      const line = lineOf(node.getStart(sf))
      const parent = node.parent
      const key = (
        (parent && ts.isPropertyAssignment(parent) && parent.name.getText(sf)) ||
        (parent && ts.isJsxAttribute(parent) && parent.name.getText(sf)) ||
        (parent && ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent) && parent.parent.name.getText(sf)) ||
        ""
      ).replace(/["']/g, "")
      // Markup and CSS held in strings are code, not copy.
      const code = /<[a-z][\w-]*[\s>]|\{[^}]*?[\w-]+\s*:[^;{}]+;/.test(s)
      if (looksLikeClasses(s)) checkClasses(s, file, line)
      else if (!code && !/^(type|name|default|id|href|src|value|lang|language|className)$/.test(key) && /\s/.test(s) && /[a-z]{3}/i.test(s)) {
        checkNames(s, file, line)
        if (/^(description|lede|summary)$/.test(key)) checkCopy(s, file, line, key)
      }
    }
    if (ts.isJsxText(node)) {
      const s = node.getText(sf)
      if (s.trim()) s.split("\n").forEach((l, i) => l.trim() && checkNames(l, file, lineOf(node.getStart(sf)) + i))
    }

    // JSX: motion press scale, concentric radius, menu labels.
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === "whileTap" && /scale/.test(node.initializer?.getText(sf) ?? "")) {
      const base = path.basename(file).replace(/\.\w+$/, "")
      if (!PRESS_SCALE_OK.has(base)) report("no-press-scale", file, lineOf(node.getStart(sf)), "whileTap scale on a control; answer the press with a fill instead.")
    }
    const name = tagName(node)
    if (name) {
      if (LABEL_GROUP.test(name)) {
        const family = name.replace(/(Group)?Label$/, "")
        const inGroup = ancestors.some((a) => {
          const n = tagName(a)
          return n === `${family}Group` || n === `${family}RadioGroup` || n === `${family}CheckboxGroup` || n === "Group"
        })
        if (!inGroup) report("menu-label-group", file, lineOf(node.getStart(sf)), `<${name}> outside <${family}Group>: the primitive throws at runtime. Wrap the label and its items in a group.`)
      }
      if (ts.isJsxElement(node)) {
        const outer = boxOf(classAttr(node.openingElement))
        if (outer.radius != null && outer.pad) {
          const want = Math.max(outer.radius - outer.pad, 0)
          if (want >= 4)
            for (const child of node.children) {
              const o = opening(child)
              if (!o) continue
              const box = boxOf(classAttr(o))
              if (box.inner || box.radius == null || Math.abs(box.radius - want) <= 2) continue
              report("concentric-radius", file, lineOf(o.getStart(sf)),
                `${box.radius}px inside a ${outer.radius}px container with ${outer.pad}px padding: concentric is ${want}px. Put frame-* on the container and rounded-inner on the child.`)
            }
        }
      }
    }
    const next = name ? [...ancestors, node] : ancestors
    ts.forEachChild(node, (c) => visit(c, next))
  }
  visit(sf, [])
}

function checkSourcePlain(file, text) {
  text.split("\n").forEach((l, i) => {
    const line = i + 1
    const imp = l.match(/from\s+["']([^"']+)["']/)
    if (imp && ICON_PKGS.test(imp[1])) report("icon-source", file, line, `"${imp[1]}": use the house icon set (components/icons) for glyphs.`)
    if (/^\s*import\b/.test(l)) return
    for (const m of l.matchAll(/(["'`])((?:(?!\1).)*)\1/g)) if (looksLikeClasses(m[2])) checkClasses(m[2], file, line)
    const c = l.match(/\/\/(.*)$|\/\*(.*?)(\*\/|$)/)
    if (c) checkNames(c[1] ?? c[2] ?? "", file, line)
  })
}

/* ────────────────────────────── CSS, markdown, registry ────────────────────────────── */

function checkCss(file, text) {
  let inComment = false
  text.split("\n").forEach((l, i) => {
    const line = i + 1
    const comments = l.match(/\/\*.*?(\*\/|$)/g)
    if (comments || inComment) checkNames((comments ?? [l]).join(" "), file, line)
    if (l.includes("/*") && !l.includes("*/")) inComment = true
    if (l.includes("*/")) inComment = false
    const apply = l.match(/@apply\s+([^;]+);/)
    if (apply) checkClasses(apply[1], file, line)
    if (/\btransition(?:-property)?\s*:\s*all\b/.test(l)) report("no-transition-all", file, line, "transition: all; name the properties.")
  })
}

function checkMarkdown(file, text) {
  let fence = false
  text.split("\n").forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence
    if (fence) return
    checkNames(l.replace(/`[^`]*`/g, " "), file, i + 1)
  })
}

function checkRegistry(file, text) {
  const reg = readJson(file)
  if (!reg?.items) return
  const lines = text.split("\n")
  const lineOf = (needle) => Math.max(1, lines.findIndex((l) => l.includes(needle)) + 1)
  const names = new Set(reg.items.map((i) => i.name))
  for (const item of reg.items) {
    const at = lineOf(`"name": "${item.name}"`)
    const d = item.description ?? ""
    const words = d.trim().split(/\s+/).filter(Boolean).length
    if (!d) report("copy-description", file, at, `${item.name}: no description.`)
    else if (words > 12) report("copy-description", file, at, `${item.name}: description is ${words} words (max 12).`)
    else if ((d.match(/[.!?](\s|$)/g) ?? []).length > 1) report("copy-description", file, at, `${item.name}: description is more than one sentence.`)
    if (d) {
      checkCopy(d, file, at, "registry description")
      checkNames(`${item.title ?? ""} ${d}`, file, at)
      if (/\d+\s?(px|rem|ms)\b|\.(tsx?|css|json)\b|\//.test(d)) report("copy-description", file, at, `${item.name}: values and paths belong on the detail page, not in the description.`)
    }
    for (const f of item.files ?? []) {
      const base = path.basename(f.path).replace(/\.\w+$/, "")
      if (/\/parts\//.test(f.path) && base !== item.name && names.has(base))
        report("registry-name-collision", file, lineOf(f.path), `${item.name}: part "${path.basename(f.path)}" has the same name as the "${base}" item; rename it so imports and installs can't collide.`)
    }
  }
}

/* ────────────────────────────── theme upgrade ────────────────────────────── */

function themeFile() {
  if (config.theme) return path.join(cwd, config.theme)
  const cfg = readJson(path.join(cwd, "components.json"))
  const cand = [cfg?.tailwind?.css, "app/globals.css", "src/app/globals.css", "styles/globals.css", "src/styles/globals.css"].filter(Boolean)
  return cand.map((p) => path.join(cwd, p)).find((p) => fs.existsSync(p))
}

function checkUpgrade() {
  if (!on("upgrade")) return
  const script = ["scripts/qinyang-upgrade-check.mjs", "registry/base-nova/scripts/upgrade-check.mjs"].map((p) => path.join(cwd, p)).find((p) => fs.existsSync(p))
  if (script) {
    const r = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" })
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim()
    if (r.status !== 0) report("upgrade", script, 1, `the upgrade check found something to fix:\n${out.replace(/^/gm, "      ")}`)
    return
  }
  const css = themeFile()
  if (!css) return
  const text = fs.readFileSync(css, "utf8")
  if (!/--radius:/.test(text)) return // not a qinyang/ui theme
  if (/--(?:color-)?accent-(?:50|[1-9]00|950):/.test(text)) report("upgrade", css, 1, "The removed accent ramp (--accent-50…950) is still in the stylesheet; install the upgrade-check item and run it with --fix.")
  if (!/--radius-max:/.test(text)) report("upgrade", css, 1, "No --radius-max: the theme predates the 16px cap; reinstall the theme.")
  const r = text.match(/--radius:\s*([\d.]+)rem/)
  if (r && parseFloat(r[1]) > 1) report("upgrade", css, 1, `--radius ${r[1]}rem is above the supported 1rem.`)
}

/* ────────────────────────────── run ────────────────────────────── */

const SELF = path.resolve(new URL(import.meta.url).pathname)
const SKILL_DIR = path.dirname(path.dirname(SELF)) + path.sep
for (const file of files) {
  if (path.resolve(file) === SELF) continue
  // Installed copies of this skill are reference text, not project code.
  if (path.resolve(file).startsWith(SKILL_DIR) && !/\.md$/.test(file)) continue
  if (/[\\/]skills[\\/]qinyang-design[\\/]/.test(file) && !path.resolve(file).startsWith(SKILL_DIR)) continue
  const text = fs.readFileSync(file, "utf8")
  if (/^\s*(\/\/|\/\*|#)\s*GENERATED\b/.test(text.slice(0, 200))) continue
  fileLines.set(file, text.split("\n"))
  if (file.endsWith("registry.json")) checkRegistry(file, text)
  else if (/\.css$/.test(file)) checkCss(file, text)
  else if (/\.mdx?$/.test(file)) checkMarkdown(file, text)
  else if (ts) checkSourceTs(file, text)
  else checkSourcePlain(file, text)
}
checkUpgrade()

const shown = flag("--quiet") ? findings.filter((f) => f.level === "error") : findings
const errors = findings.filter((f) => f.level === "error").length
const warns = findings.length - errors

if (flag("--json")) console.log(JSON.stringify({ files: files.length, errors, warnings: warns, findings: shown }, null, 2))
else {
  let last = ""
  for (const f of shown.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
    if (f.file !== last) console.log(`\n${f.file}`)
    last = f.file
    console.log(`  ${String(f.line).padStart(4)}  ${f.level === "error" ? "error" : "warn "}  ${f.rule.padEnd(24)} ${f.message}`)
  }
  console.log(`\n${files.length} files, ${errors} errors, ${warns} warnings${ts ? "" : " (TypeScript not found: JSX nesting checks skipped)"}`)
}
process.exit(errors || (flag("--strict") && warns) ? 1 : 0)
