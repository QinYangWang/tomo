# Motion, accessibility and themes

## Motion

- Springs are bounce-free and close to critically damped: `{ type: "spring", stiffness: 380–520,
  damping: 26–42, mass: 0.5–0.7 }` (420/38/0.6 for settles, 500/30 for snappy toggles). Icon cross-fades:
  `{ type: "spring", duration: 0.3, bounce: 0 }`.
- CSS: `duration-150` for press, hover and other high-frequency changes, `duration-200` for state changes,
  `duration-300` for reveals and panels; easing `cubic-bezier(0.22,1,0.36,1)` (`EASE = [0.22, 1, 0.36, 1]`).
  The overshoot curve `cubic-bezier(0.34,1.56,0.64,1)` only for playful pops.
- Transition named properties (`transition-colors`, `transition-[box-shadow,background-color,color]`,
  `transition-transform`), never `transition-all`. `will-change` only for a stutter you saw, naming the
  property.
- Staggered entrances 100ms apart (opacity + 4px blur + 12px rise, 300ms ease-out); exits shorter (150ms).
  `initial={false}` on `AnimatePresence` state swaps. Popups enter from `scale-98` plus opacity.
- **No press scale on standard controls** (buttons, triggers, toggles, nav rows, checkboxes, radios):
  they answer with a fill change. A press scale (to `0.96` over 150ms) stays only where the motion is the
  component's point, and a disabled control never scales.
- Collapsing content keeps its size while it closes, so text doesn't reflow mid-animation.

## Reduced motion

Every movement, scale or blur is gated (`useReducedMotion()`, `motion-safe:`, `motion-reduce:`). Under
reduce, cross-fade opacity instead of cutting the change. Loops (spinners, marquees, shimmers) slow down or
stop.

## Focus and keyboard

- `focus-visible:ring-2 focus-visible:ring-ring/50` on every interactive element; `outline-none` only
  together with that ring. Inside scroll frames use `focus-visible:ring-inset`.
- Every control has an accessible name (visible label, `aria-label` on icon-only buttons, a `label` on
  sliders). Menus, selects, tabs and trees keep their primitive's keyboard model.
- Hotkeys show their shortcut in a `Kbd`; one listener per shortcut, not one per instance.

## Light and dark

Every change must look right with and without `.dark` on `<html>`. Use tokens, not `dark:` overrides with
palette colours. Check both themes, an accent preset and the smallest and largest radius before you
finish.
