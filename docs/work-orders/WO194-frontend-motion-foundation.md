# WO194 — Frontend: motion foundation (tokens + press/hover/focus choreography)

## Shared context (read first)

Second of the **WO193–WO199 premium-polish batch**. Execution sequence: `193 → 194 → 195 →
🔍 A → { 196 ∥ 197 ∥ 198 } → 🔍 B → 199` — this WO runs **serially after WO193** (both edit
`globals.css` and `button.tsx`; do not run them in parallel). This WO
gives the app one coherent motion language: a small token system for durations/easings, and a
disciplined press/hover/focus choreography applied to the existing `ui/` primitives. Premium
motion is **fast, physical, and restrained** — nothing floats, nothing bounces, nothing takes
longer than it has to. Later WOs (WO195 suede sheen, WO197 overlay enter/exit, WO198 chart
tooltips) consume these tokens; do not let them each invent timings.

The `motion` package (Framer's successor) is already a dependency and already used in
`OptimizationWorkbench`, `AppDock`, `LauncherDashboard` — no new runtime deps.

Frontend repo: `q_frontend` — React/TS/Vite/Tailwind, `pnpm` (never npm), vitest. Paths
relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `src/components/ui/button.tsx` — note the **existing bug**: the string
  `'cubic-bezier(0.16,1,0.3,1)'` sits directly in the `cn(...)` class list, where it is a
  meaningless class name (a no-op) — the intended easing never applies. Also `duration-350`,
  `hover:scale-[1.01]`, `active:scale-[0.97]` are ad-hoc values to be replaced by tokens.
- `src/components/layout/MotionToggle.tsx` — the app has a user-facing motion toggle; find
  how it gates animation (class on root? context?) and respect the same mechanism.
- `src/styles/globals.css` — where the motion tokens will live; existing animation utilities
  (`quant-panel--active-run`, `live-status-dot`) referenced by the accent ladder.
- `src/styles/materials.css` — hover transitions on surfaces (read-only here; WO195 retunes
  surface hovers using these tokens).
- `src/components/ui/` — `SegmentedToggle`, `FilterPills`, `RangeChips`, `EntityCard`,
  `number-input.tsx` (stepper buttons) — every interactive primitive gets the choreography.
- `docs/design/visual-design-system.md` — extend with the motion section.

## Goal

```css
/* globals.css @theme */
--motion-fast: 120ms; /* press feedback, exits, hover-out */
--motion-base: 180ms; /* hover-in, focus, small reveals */
--motion-slow: 280ms; /* overlays entering, panel-level reveals */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1); /* default: decisive arrival */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1); /* moves/reflows */
--ease-exit: cubic-bezier(0.4, 0, 1, 1); /* leaving elements accelerate away */
```

One motion vocabulary, defined once, consumed by every primitive — and a press/hover/focus
feel that makes controls read as machined hardware rather than web buttons.

## Tasks

1. **Tokens.** Add the Goal tokens to `globals.css` `@theme`. Add matching Tailwind-usable
   utilities if the theme doesn't expose them automatically (e.g. `duration-[var(--motion-fast)]`
   works out of the box; prefer that form).
2. **Fix `button.tsx`.** Remove the no-op `cubic-bezier(...)` class; apply the easing properly
   (`ease-[var(--ease-out)]`) with `duration-[var(--motion-base)]` for hover-in and
   `duration-[var(--motion-fast)]` for active/press. Replace `hover:scale-[1.01]` /
   `active:scale-[0.97]` with the standardized press choreography below.
3. **Press choreography (the standard, applied to Button, SegmentedToggle options,
   FilterPills, RangeChips, NumberInput steppers, EntityCard, dock items):**
   - **Hover-in:** `--motion-base`/`--ease-out` — surface lifts per its material (WO195 will
     retune what "lift" looks like; this WO wires the timing), no scale on hover (scale-on-
     hover reads as consumer web, not instrument).
   - **Press:** `--motion-fast` — `scale(0.985)` + translateY(0.5px) ("the button goes _in_"),
     released with `--ease-out`. Transform-only (no layout properties) for 60 fps.
   - **Hover-out / release:** `--motion-fast`/`--ease-exit`.
4. **Focus.** Keep the existing `:focus-visible` brass outline, but make its appearance
   instant (0ms — focus must never lag keyboard navigation) while the _ring glow_ (if the
   material adds one) fades in at `--motion-base`.
5. **Reveal choreography helpers.** Export from a new `src/lib/motion/presets.ts`: `motion`
   variants used app-wide — `fadeRise` (opacity 0→1 + translateY 4px→0, `--motion-base`),
   `overlayEnter`/`overlayExit` (scale 0.98→1 + fade, `--motion-slow` in / `--motion-fast`
   out; WO197 consumes), `staggerChildren(0.02)` for list mounts. Refactor the existing
   `motion` usages in `AppDock` / `LauncherDashboard` / `OptimizationWorkbench` onto the
   presets **only where the values match what they already do** — do not change their
   choreography beyond timing-token alignment.
6. **Reduced motion.** Single source of truth: a `useReducedMotion()` helper in
   `src/lib/motion/` that combines `prefers-reduced-motion` **and** the app's `MotionToggle`
   state; presets return instant variants when true. CSS side: all token-driven transitions
   respect the same gate the way `MotionToggle` already gates existing animations (reuse its
   mechanism, don't invent a second one).
7. **Kill stray timings.** `grep -rn "duration-\[?[0-9]" src/components/ui/` and
   `grep -rn "transition.*[0-9]\{2,\}ms" src/styles/` — migrate every interactive-control
   timing onto the tokens. Page-level/one-off animations outside `ui/` are left for WO199.

## Guardrails

> **Transform/opacity only** for all interaction motion — never animate layout properties
> (width/height/top/left) on hover/press; the WO70–72 perf lessons apply.
> **No new dependencies** — `motion` is already present.
> **Nothing slower than `--motion-slow`**, and no idle/looping animation added anywhere (the
> accent ladder already banned ambient shimmer on dense grids).
> **Behavior-preserving:** no component API changes; visual timing only. Existing testids
> untouched.
> **Reduced-motion parity:** every animated state must have a non-animated final state that
> is visually identical once settled.

## Tests

- `src/lib/motion/__tests__/presets.test.ts` (new): presets expose the token durations;
  `useReducedMotion` returns true under a mocked `prefers-reduced-motion` and under the
  MotionToggle-off state, and presets collapse to instant variants.
- `src/components/ui/__tests__/button.test.tsx`: the rendered class list contains **no**
  literal `cubic-bezier` no-op string; press state applies the standardized transform.
- Existing suites green.

## Docs

Extend `docs/design/visual-design-system.md` with a **Motion** section: the three durations,
three easings, the press choreography spec, the "no scale on hover / no idle loops / nothing
past 280ms" rules, and the reduced-motion contract.

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until both do. Final message
must include: the token block as shipped, the list of primitives given the press
choreography, the list of stray timings migrated, and confirmation the `button.tsx`
`cubic-bezier` no-op is gone. Production trigger: none — tokens apply globally via
`globals.css`.

## Out of scope

Surface/material visuals (WO195 — this WO wires _when_, WO195 designs _what_); overlay
enter/exit application (WO197 consumes `overlayEnter`/`overlayExit`); chart animation
(WO198); page-level one-off animations outside `ui/` (WO199); changing `MotionToggle` UX.
