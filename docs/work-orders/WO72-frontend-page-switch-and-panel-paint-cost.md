# WO72 — Frontend: Page-switch & panel paint cost (view transitions + backdrop blur/spotlight)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test` ; typecheck/build: `pnpm exec tsc -p tsconfig.app.json --noEmit` / `pnpm build`

**Context for this work:** switching between pages feels heavy, and the whole UI carries a constant
paint cost. Two independent causes: (1) the router runs the **View Transitions API on every route
change**, which rasterizes full-page snapshots of the outgoing and incoming pages (full-screen SVG
charts, three.js canvases, ~20 `backdrop-blur` panels) and cross-fades them; (2) every `.quant-panel`
carries `backdrop-filter: blur(12px)` plus a pointer-spotlight that animates a radial gradient **and**
a box-shadow (through `color-mix`) on mouse move — and panels nest, so the blur is re-applied per
layer. This WO is **paint/compositor cost only** — it is independent of the backtest re-render work in
WO70/WO71 and can ship in any order relative to them.

---

## How the pieces work today (read these files)

- `src/app/router.tsx`
  - `createRouter({ routeTree, defaultViewTransition: true })` (bottom of file) — view transitions on
    **every** navigation.
- `src/styles/globals.css`
  - `.vt-header` / `.vt-content` / `.vt-dock` set `view-transition-name` (~453–460) and there are
    `::view-transition-old/new(main-content)` rules (~464+). `vt-*` classes are applied in
    `AppShell.tsx` (~47, ~75), `AppDock.tsx` (~55), `ReaderWindowShell.tsx` (~35, ~58).
  - `.quant-panel` (~201–250): base layer is `radial-gradient(... var(--spot-o) ...)` over a
    `linear-gradient(..., rgba(26,16,8,0.88), rgba(17,19,21,0.92))` (**88–92% opaque**), plus
    `box-shadow: … color-mix(... var(--spot-o) ...)` and **`backdrop-filter: blur(12px)`** (~220), and
    a `transition` that animates `--spot-o` over 350ms (~221–225).
  - `@property --spot-o` is registered animatable (~109–115).
- `src/components/effects/PointerSpotlight.tsx`
  - rAF-throttled `pointermove` listener that finds the `.quant-panel` under the cursor, toggles
    `.is-lit`, and writes `--spot-x`/`--spot-y` every frame (drives the radial gradient + shadow). It
    already respects `prefers-reduced-motion`.
- ~20 Tailwind `backdrop-blur*` usages across toolbars/bands/overlays/3D HUDs (`grep -rn "backdrop-blur" src`).

---

## Goal

Page switches are instant (or animate only cheap chrome, not full-page snapshots), and panels stop
paying for an expensive, nearly-invisible blur + per-frame gradient/shadow repaint — while keeping the
brass-glass look essentially unchanged (the base fill is already ~90% opaque, so the blur barely shows).

## Tasks

### 1. Limit view transitions to lightweight chrome only

Decision (locked): keep a **chrome-only fade** — animate the header/dock, never the heavy page body.

- The heavy `main-content` must **not** be snapshotted. Remove its `view-transition-name`: drop the
  `.vt-content` rule (`view-transition-name: main-content`, globals.css ~456–457) and the
  `::view-transition-old/new(main-content)` rules (~464+), and remove the `vt-content` class from
  `AppShell.tsx` (~75) and `ReaderWindowShell.tsx` (~58). This is what eliminates the chart/3D-canvas
  rasterization on every nav.
- Keep a lightweight transition on **header and dock only**: retain `view-transition-name: app-header`
  / `app-dock` (`.vt-header`, `.vt-dock`, globals.css ~453–460) and the `vt-header`/`vt-dock` classes
  in `AppShell.tsx` (~47), `AppDock.tsx` (~55), `ReaderWindowShell.tsx` (~35). Keep these regions
  cheap to snapshot — if either still carries `backdrop-blur` that makes its snapshot expensive,
  prefer a plain opacity cross-fade for it.
- Leave `defaultViewTransition: true` in `createRouter` (`app/router.tsx`) **on** — with only
  header/dock named, the body change is an instant swap while the chrome cross-fades. Verify
  navigation no longer rasterizes the chart/3D-canvas regions (only the chrome animates).

### 2. Cut the `.quant-panel` backdrop-filter cost

- The blur sits behind an ~90%-opaque fill and nests across panel layers. Remove `backdrop-filter`
  from `.quant-panel`, **or** restrict it to top-level panels only (never nested). Verify the look is
  effectively unchanged against the opaque base; if a hint of depth is wanted, prefer a static
  semi-transparent fill over a live blur.
- Audit the ~20 Tailwind `backdrop-blur*` sites; drop or downgrade those layered on top of already-
  opaque panels (keep blur only where it sits over genuinely transparent content, e.g. a modal
  overlay). Don't blanket-remove — judge per site.

### 3. Make the pointer spotlight cheap (keep the effect)

- Stop animating `box-shadow` with the cursor: remove `--spot-o` from the `box-shadow` (keep a static
  ambient shadow). Drive only the radial-gradient highlight from the pointer.
- Move the pointer highlight to a dedicated, compositor-promoted layer (a `::before`/overlay element,
  `pointer-events:none`, `will-change: opacity`) so animating it does not repaint panel **content** or
  re-trigger any remaining backdrop-filter on the content box.
- Keep `PointerSpotlight.tsx`'s rAF throttling and `prefers-reduced-motion` guard.

### 4. Sanity-check other always-on effects

- Confirm `QuantBackground` and any always-running canvas/effect aren't compounding the cost on every
  page. If one is cheaply gateable (e.g. pause when a heavy workspace is active), note it; do not
  redesign visuals here.

## Guardrails

> **Look stays brass-glass.** This is a paint refactor. The panel fill, borders, and the pointer
> highlight remain; only the _cost_ drops. If removing blur is visibly different on any surface, prefer
> the top-level-only or static-fill fallback there.

> **Respect reduced motion.** Keep the existing `prefers-reduced-motion` handling for the spotlight and
> any transitions.

> **No new dependencies / no design-token churn.** Reuse existing brass/carbon variables. Don't add an
> animation library for this.

> **Accessibility unaffected.** Focus order, contrast, and keyboard nav must be unchanged by removing
> blur/transitions.

## Tests

- Assert `main-content` is no longer a view-transition target: grep/unit-check that no rendered
  element carries the `vt-content` class and that `globals.css` has no `view-transition-name:
main-content` / `::view-transition-*(main-content)` rules. Header/dock (`vt-header`/`vt-dock`)
  remain.
- Mostly manual/visual (paint cost isn't unit-testable). Capture before/after in the DoD.

## Docs

`q_frontend/README.md`: note that navigation no longer uses full-page view transitions, and that panel
glass is a static fill (blur removed/limited) with a compositor-isolated pointer highlight — with the
performance rationale.

---

## Definition of done

- `pnpm test` passes; `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` clean.
  **Do not report completion until all pass.**
- Manually (`./dev.sh`): switching between Backtests / Discover / Market-data / Optimize is snappy with
  no full-page cross-fade stutter; moving the mouse across dense panels no longer janks. Confirm via a
  DevTools Performance recording that navigation no longer shows large snapshot/composite spikes and
  that mouse-move over panels isn't triggering full-panel repaints.
- Paste in the final message: confirmation that view transitions are now chrome-only (header/dock
  animate, `main-content` no longer snapshotted), what happened to the `.quant-panel` blur and the ~20
  Tailwind blur sites, and the before/after Performance observation.

## Out of scope

- Backtest config typing lag (results-pane memo boundary) — **WO70**.
- Chart indicator memoization / hover isolation — **WO71**.
- Replacing the 3D visualizers or the charting renderer — future WO.
