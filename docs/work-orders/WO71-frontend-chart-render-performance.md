# WO71 — Frontend: Chart render performance (memoize indicators, isolate hover)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test` ; typecheck/build: `pnpm exec tsc -p tsconfig.app.json --noEmit` / `pnpm build`

**Context for this work:** the candlestick/strategy chart is expensive on every render and re-renders
on every mouse move. Each render recomputes all enabled indicators (`sma/ema/bollinger/…`) across the
**entire** dataset and rebuilds every SVG path; each `mousemove` calls `setState`, re-rendering all
layers. This is the chart-internal half of the backtest lag. **WO70** stops the chart from
re-rendering on unrelated config keystrokes; **WO71 (this)** makes each chart render cheap and makes
hovering not re-run indicator math. Do this **after WO70** (WO70 is the bigger structural win); the
two are complementary and touch different code.

---

## How the pieces work today (read these files)

- `src/components/charts/layers/IndicatorLayer.tsx`
  - Plain (non-memoized) component. On **every render** it `new Set(visibleBars…)` (~107) and, inside
    `indicators.map`, calls `sma(allBars, …)`, `ema(allBars, …)`, `bollingerBands(allBars, …)`,
    `wma/hma/smma/donchian(allBars, …)` (~114–277) over the **full dataset**, then rebuilds path
    strings via `linePath`/`bandsAreaPath`. Nothing is memoized.
- `src/components/charts/layers/VolumeLayer.tsx` and `src/components/charts/layers/OscillatorPane.tsx`
  - Both also receive `allBars` and recompute on each render (verify and apply the same treatment).
- `src/components/charts/CandlestickChart.tsx`
  - `ChartInner` holds hover state: `setHoveredBar` / `setMouseY` fire on **every** `mousemove`
    (~185–223, set at ~211–212), re-rendering the whole component and **all** child layers
    (Candlestick/Volume/Indicator/Oscillator/Grid/Axes/Drawing/Crosshair, ~472–560).
  - `macdValues`/`macdScale` are already `useMemo`'d (~146–163) — follow that pattern for the rest.
  - Top-level `<CandlestickChart>` wraps `ChartInner` in `<ParentSize debounceTime={50}>` (~628–649).
- `src/lib/indicators/*` — pure functions (`sma`, `ema`, `bollinger`, `macd`, `rsi`, `wma`, `hma`,
  `smma`, `donchian`); cheap to memoize on `(data, params)`.

---

## Goal

Indicator math runs only when its inputs change, and moving the cursor moves only the crosshair —
not the data layers. A chart render with stable data and no hover change should do near-zero work.

```tsx
const smaValues = useMemo(() => sma(allBars, period), [allBars, period]) // not every render
const IndicatorLayer = memo(IndicatorLayerImpl) // bail out when props equal
// crosshair reads pointer position without re-rendering Candlestick/Indicator/Volume layers
```

## Tasks

### 1. Memoize indicator computation

- In `IndicatorLayer` (and `VolumeLayer`/`OscillatorPane` as applicable), compute each indicator's
  values via `useMemo` keyed on `(allBars, …params)` instead of inline in `map`. Build the
  `visibleSet` with `useMemo` keyed on `visibleBars`. Path strings: memoize on
  `(values, visibleSet, xScale, yScale)`.
- Prefer hoisting computation to a small hook (e.g. `useIndicatorValues(allBars, indicators)`) so the
  values survive re-renders that only change scales/hover.

### 2. Wrap static layers in `React.memo`

- Wrap `IndicatorLayer`, `VolumeLayer`, `OscillatorPane`, `GridLayer`, `CandlestickLayer` in
  `React.memo`. Ensure their props are referentially stable across a hover-only render (scales,
  bars, indicator config). Where `CandlestickChart` creates inline objects/arrays passed to layers,
  hoist them to `useMemo`.

### 3. Isolate hover/crosshair from the data layers

- Stop re-rendering all layers on `mousemove`. Options (pick the cleanest for this codebase):
  - Move `hoveredBar`/`mouseY` into a dedicated `CrosshairLayer` that tracks pointer position via a
    ref + local state, so only the crosshair (and HUD) updates on move; or
  - Keep hover state in `ChartInner` but ensure all data layers are `memo`'d on inputs that don't
    include hover, so they bail out while only `CrosshairLayer`/HUD re-render.
- The HUD info panel (~366–399) may update on hover — that's fine; it's cheap. The point is that
  `IndicatorLayer`/`VolumeLayer`/`CandlestickLayer` must **not** recompute or re-render on hover.
- Throttle pointer handling to one update per animation frame if it isn't already (the handler runs
  raw on every `mousemove`).

### 4. Verify the panning path stays correct

- Panning also uses `handleMouseMove` (drag branch, ~192–208). Ensure the memoization keys include
  the viewport/scales so pan still redraws bars correctly — memoize on data, not on a frozen snapshot.

## Guardrails

> **Pixel-identical output.** Lines, candles, bands, oscillators, crosshair, and HUD must render
> exactly as before. This is a performance refactor; no visual change.

> **Correctness over caching.** Memo keys must include everything the computation reads (`allBars`,
> every indicator param, the relevant scale). A stale cache that drops a band update is a bug, not a
> win. Verify with the existing chart test.

> **No new charting deps.** Reuse `@/lib/indicators` and the existing visx/scale setup. Do not pull in
> a canvas renderer or new chart library here.

> **Don't break drawings/zoom/pan.** Drawing tools, wheel-zoom, double-click fit, axis drag handles
> must keep working.

## Tests — `tests/unit/components/CandlestickChart.test.tsx` (extend)

- With indicators enabled, simulate `mousemove` over the chart and assert indicator layers do **not**
  recompute/re-render (instrument an indicator fn spy or layer render counter); only the crosshair/HUD
  updates.
- Indicator values update correctly when `data` or an indicator param changes (cache invalidation
  works).
- Snapshot/path assertion: rendered indicator paths are identical before/after the refactor for a
  fixed dataset.

## Docs

`q_frontend/README.md` (charts/perf note): document that indicator values are memoized on
`(data, params)`, layers are `React.memo`, and hover updates only the crosshair/HUD.

---

## Definition of done

- `pnpm test` passes; `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` clean.
  **Do not report completion until all pass.**
- Manually (`./dev.sh`, Backtests page with a strategy chart + indicators): hovering across the chart
  is smooth; React DevTools Profiler shows only crosshair/HUD committing on move, and indicator
  functions are not re-invoked on hover.
- Paste in the final message: which layers were memoized, how hover was isolated, and the
  before/after Profiler observation (commit count on a hover move).

## Out of scope

- Stopping the chart from re-rendering on **config keystrokes** (the memo boundary around the results
  pane) — **WO70**.
- Page-switch (view transitions) and app-wide panel paint cost — **WO72**.
- Switching the chart to a canvas/WebGL renderer — future WO if SVG limits remain after this.
