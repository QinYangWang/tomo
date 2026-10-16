/**
 * Nested-radius probe for any page: paste into the browser console (or run with
 * Playwright's page.evaluate) after opening the screen you want to check, with
 * menus open or rows hovered if those are what you are checking.
 *
 * For every rounded element it compares the corner radius with the concentric
 * value its nearest rounded ancestor implies (outer radius minus the inset) and
 * prints the ones more than 2px off. "must" = inset of 8px or less, fix it with
 * frame-* on the container and rounded-inner on the child.
 *
 * The measuring function is the same one the library's own audit runs.
 */
(() => {
  function measure({ tol, maxInset, phase }) {
    const px = (v, w) => {
      const first = String(v).trim().split(/\s+/)[0]
      if (first.endsWith("%")) return (parseFloat(first) / 100) * w
      return parseFloat(first) || 0
    }
    const alpha = (c) => {
      if (!c || c === "transparent") return 0
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (m) {
        const parts = m[1].split(/[ ,/]+/).filter(Boolean)
        return parts.length > 3 ? parseFloat(parts[3]) : 1
      }
      const a = c.match(/\/\s*([\d.]+%?)\s*\)/)
      if (a) return a[1].endsWith("%") ? parseFloat(a[1]) / 100 : parseFloat(a[1])
      return 1
    }
    // Does the box paint anything at this corner (or anywhere, when corner is omitted)?
    const SIDES = { tl: ["Top", "Left"], tr: ["Top", "Right"], br: ["Bottom", "Right"], bl: ["Bottom", "Left"] }
    const painted = (el, cs, corner) => {
      if (/^(IMG|VIDEO|CANVAS|IFRAME|PICTURE)$/.test(el.tagName)) return true
      const textClip = /text/.test(cs.backgroundClip || cs.webkitBackgroundClip || "")
      if (!textClip && (alpha(cs.backgroundColor) > 0.01 || cs.backgroundImage !== "none")) return true
      if (cs.boxShadow && cs.boxShadow !== "none") return true
      for (const s of corner ? SIDES[corner] : ["Top", "Right", "Bottom", "Left"]) {
        if (parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== "none" && alpha(cs[`border${s}Color`]) > 0.01) return true
      }
      if (cs.backdropFilter && cs.backdropFilter !== "none") return true
      return false
    }
    // A scroll container between the element and its ancestor (or the ancestor itself) moves
    // the element, so its offsets depend on the scroll position.
    const scrolls = (n) => {
      const c = getComputedStyle(n)
      return /(auto|scroll)/.test(c.overflowY + c.overflowX) && (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1)
    }
    const radii = (el, cs, r) => {
      const w = r.width, h = r.height, cap = Math.min(w, h) / 2
      const c = (v) => Math.min(px(v, w), cap)
      return {
        tl: c(cs.borderTopLeftRadius),
        tr: c(cs.borderTopRightRadius),
        br: c(cs.borderBottomRightRadius),
        bl: c(cs.borderBottomLeftRadius),
        cap,
      }
    }
    const isRound = (rr) => rr.cap > 0 && Math.max(rr.tl, rr.tr, rr.br, rr.bl) >= rr.cap - 1 && Math.min(rr.tl, rr.tr, rr.br, rr.bl) >= rr.cap - 1
    const RADIUS_CLASS = /^(?:[a-z0-9-]+:)*(rounded|frame|p|px|py|pt|pb|pl|pr|ps|pe|border|inset|gap|m|mx|my|shell-inset)(-|$)/
    const radiusClasses = (el) =>
      String(el.getAttribute("class") || "")
        .split(/\s+/)
        .filter((c) => RADIUS_CLASS.test(c))
        .join(" ")
    const short = (el) => {
      let s = el.tagName.toLowerCase()
      const slot = el.getAttribute("data-slot")
      if (slot) return `${s}[data-slot="${slot}"]`
      if (el.id) return `${s}#${el.id}`
      const role = el.getAttribute("role")
      if (role) s += `[role="${role}"]`
      const cls = String(el.getAttribute("class") || "").split(/\s+/).filter((c) => c && !c.includes(":") && !c.includes("[") && !c.includes("/"))
      if (cls.length) s += "." + cls.slice(0, 2).join(".")
      const parent = el.parentElement
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === el.tagName)
        if (same.length > 1) s += `:nth-of-type(${same.indexOf(el) + 1})`
      }
      return s
    }
    const selector = (el, stop) => {
      const parts = []
      for (let n = el; n && n !== stop && n !== document.body && parts.length < 5; n = n.parentElement) {
        parts.unshift(short(n))
        if (n.getAttribute("data-slot") && parts.length >= 2) break
      }
      return parts.join(" > ")
    }
    const slotOf = (el) => {
      for (let n = el; n; n = n.parentElement) if (n.getAttribute && n.getAttribute("data-slot")) return n.getAttribute("data-slot")
      return null
    }
    // Scope: which example preview (or the site shell / a portal) the element lives in.
    const main = document.querySelector("main")
    const shellRoot = main ? main.closest("body > *") : null
    const scopeOf = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const p = n.parentElement
        if (p && p.getAttribute("role") === "tabpanel" && /min-h-(56|80)/.test(n.className || "")) {
          const block = p.closest("[data-slot='tabs']")?.parentElement
          const h3 = block?.querySelector(":scope > h3[id^='example-']")
          return { kind: "demo", id: h3 ? h3.id.replace(/^example-/, "") : "main-demo" }
        }
        if (n.getAttribute && n.getAttribute("data-slot") === "gallery-preview") {
          const card = n.parentElement
          const a = card?.querySelector("a[href*='/docs/']")
          return { kind: "demo", id: a ? a.getAttribute("href").replace(/.*\/docs\/|\/$/g, "") : "gallery" }
        }
      }
      if (shellRoot && !shellRoot.contains(el)) return { kind: "portal", id: "portal" }
      return { kind: "site", id: "site" }
    }

    const out = []
    const all = document.body.querySelectorAll("*")
    for (const el of all) {
      if (el.closest("svg")) continue
      const cs = getComputedStyle(el)
      if (cs.display === "none" || cs.display === "contents") continue
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) continue
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
      const rr = radii(el, cs, r)
      // Find the nearest rounded ancestor with a box.
      let anc = null, acs = null, ar = null, arr = null
      for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
        const ncs = getComputedStyle(n)
        if (ncs.display === "contents") continue
        const nr = n.getBoundingClientRect()
        if (nr.width < 4 || nr.height < 4) continue
        const nrr = radii(n, ncs, nr)
        if (nrr.tl + nrr.tr + nrr.br + nrr.bl > 0) {
          anc = n; acs = ncs; ar = nr; arr = nrr
          break
        }
      }
      if (!anc) continue
      if (isRound(rr)) continue // pills, avatars, dots: intentional
      const elRounded = rr.tl + rr.tr + rr.br + rr.bl > 0
      const corners = [
        ["tl", r.left - ar.left, r.top - ar.top],
        ["tr", ar.right - r.right, r.top - ar.top],
        ["br", ar.right - r.right, ar.bottom - r.bottom],
        ["bl", r.left - ar.left, ar.bottom - r.bottom],
      ]
      const clips = acs.overflow !== "visible" || acs.overflowX !== "visible" || acs.overflowY !== "visible"
      const bad = []
      const elPaints = painted(el, cs)
      for (const [k, dx, dy] of corners) {
        if (dx < -0.5 || dy < -0.5) continue
        if (Math.max(dx, dy) >= maxInset) continue
        const d = Math.max(0, Math.min(dx, dy))
        const R = arr[k], rv = rr[k]
        if (d < 1 && clips) continue // flush inside a clipping parent: the parent's curve wins
        if (rv < 0.5 && !painted(el, cs, k)) continue // square corner that paints nothing
        const expected = Math.max(R - d, 0)
        // Concentric below 4px means the inset is too large for the container's radius: the child
        // keeps its own token (AGENTS.md), unless it is rounder than the container itself.
        if (expected < 4 && rv <= R + tol) continue
        if (Math.abs(rv - expected) > tol && (rv > 0 || expected > 4)) {
          // must: a tight inset where concentric gives a usable radius; should: the rest.
          const level = d <= 8 && expected >= 4 && !isRound(arr) ? "must" : "should"
          bad.push({ corner: k, r: +rv.toFixed(1), R: +R.toFixed(1), dx: +dx.toFixed(1), dy: +dy.toFixed(1), expected: +expected.toFixed(1), uneven: Math.abs(dx - dy) > 2, level })
        }
      }
      if (!bad.length) continue
      if (!elRounded && !elPaints) continue // square and invisible: nothing to see
      let scrolling = false, cut = false
      for (let n = el.parentElement; n && n !== anc.parentElement; n = n.parentElement) {
        if (!scrolls(n)) continue
        scrolling = true
        const sr = n.getBoundingClientRect()
        if (r.top < sr.top - 0.5 || r.bottom > sr.bottom + 0.5 || r.left < sr.left - 0.5 || r.right > sr.right + 0.5) cut = true
      }
      if (cut) continue // a row passing under a scroll edge: transient, not a nesting decision
      if (scrolling && clips && Math.min(...bad.map((b) => Math.min(b.dx, b.dy))) < 6) continue // scroll content touching a clipped edge
      const scope = scopeOf(el)
      out.push({
        phase,
        scope,
        slot: slotOf(el),
        ancestorSlot: slotOf(anc),
        selector: selector(el, null),
        ancestor: selector(anc, null),
        classes: radiusClasses(el),
        ancestorClasses: radiusClasses(anc),
        visible: elPaints && painted(anc, acs),
        level: bad.some((b) => b.level === "must") ? "must" : "should",
        control:
          /^(BUTTON|INPUT|SELECT|TEXTAREA|KBD)$/.test(el.tagName) ||
          /^(button|checkbox|switch|radio|tab)$/.test(el.getAttribute("role") || "") ||
          /^(icon-chip|alert-icon|badge|kbd)$/.test(el.getAttribute("data-slot") || ""),
        minInset: Math.min(...bad.map((b) => Math.max(0, Math.min(b.dx, b.dy)))),
        scrolling,
        roundAncestor: isRound(arr),
        corners: bad,
      })
    }
    return out
  }

  const found = measure({ tol: 2, maxInset: 16, phase: "rest" })
  console.table(found.map((f) => ({ level: f.level, element: f.selector, ancestor: f.ancestor, corners: JSON.stringify(f.corners) })))
  return found
})()
