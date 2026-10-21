# Q-122 implementation plan: Market chart crosshair and drawing tools

> **For implementation agents:** Read the linked specification and repository instructions. Launch only through `./work start Q-122 --agent <agent> --worktree` after written-plan approval and after `feat/chart-ruler` is in `development`. Implement natively; delegation requires separate authorization.

**Goal:** The Market chart crosshair reads the exact price at the pointer in the instrument's precision, and drawings are symbol-scoped objects that can be selected, dragged, styled, undone and deleted, with a broader tool set.
**Architecture:** A React-free drawing module (time-to-x geometry, a tool registry with render, hit test and handles per tool, versioned storage with migration) drives a `DrawingLayer` and an interaction state machine in `CandlestickChart`; a price-format value derived from instrument info flows to every price label.
**Tech stack:** React 19, TypeScript, visx/d3 scales, Zustand, TanStack Query, MSW, Vitest and Testing Library.
**Spec:** [Specification](../specs/Q-122-market-chart-crosshair-and-drawing-tools-spec.md)
**Status:** written plan awaiting human review.

## Global constraints

- Start from `development` including the Chart Ruler; reuse its `pointToXY` home in `useChartScales.ts` and replace it with the shared time-to-x mapping rather than keeping two.
- Geometry, hit testing, migration and undo are pure functions with unit tests; components stay thin.
- Pointer handling stays on the existing `chart-interaction` rect; hover work stays inside the existing `requestAnimationFrame` throttle.
- Reuse the shared `confirm-dialog`, `Popover` and `Menu` primitives; no new dependency.
- Tests run as `TZ=America/Sao_Paulo pnpm test:run` against MSW. No backend or Tauri run.
- Commit focused units on the task branch; no push, merge or protected-branch checkout.

## Review focus

- The crosshair label comes from the pointer, not the bar, and every price label shares one formatter.
- Time-to-x mapping is consistent across timeframes and at both edges of the loaded history, and the ruler uses it too.
- Migration is idempotent, never loses a legacy drawing that parses, and never throws on bad storage.
- Pressing on a drawing never pans; Ctrl chords never toggle the ruler; Escape always leaves a consistent state.
- Undo history is per symbol and is not written to storage.
- Hover hit testing over many drawings does not drop frames (measure with 200 drawings).

## Ordered implementation

### 1. Price precision and crosshair

**Files:** new `src/lib/market/priceFormat.ts` and test; modify `CrosshairLayer.tsx`, `ChartAxes.tsx`, `CandlestickChart.tsx`, `RulerLayer.tsx`, `ChartPanel.tsx`, `MarketDataWorkspace.tsx`; extend chart tests.

- [ ] Add failing tests for spec acceptance items 1 and 2.
- [ ] Derive `priceFormat` from instrument info, snapshot or bars; pass it down; label the pointer price; span the vertical line over all panes; keep the crosshair with tools armed; add the last-price line and label; commit.

### 2. Drawing model, geometry and storage

**Files:** new `src/components/charts/drawings/{types,geometry,storage}.ts` with tests; modify `types/chart.ts`, `hooks/useDrawings.ts`, `hooks/useChartScales.ts`, `ruler.ts`.

- [ ] Add failing tests for spec acceptance items 4 and 5 (cross-timeframe placement, edge extrapolation, migration, malformed entries, failing writes).
- [ ] Implement epoch-time anchors, the bar-position time-to-x mapping and its inverse, magnet and tick snapping, and v2 per-symbol storage with migration; move the ruler onto the shared mapping; commit.

### 3. Tool registry and rendering of existing tools

**Files:** new `src/components/charts/drawings/tools/` (one module per tool) and `registry.ts` with tests; rewrite `layers/DrawingLayer.tsx`.

- [ ] Add failing tests for render output, clipping, hidden drawings and Hide all (item 10) for trend line, horizontal line, Fibonacci retracement and text.
- [ ] Implement the registry contract (anchors, render, hit test, handles, defaults, options) and port the four existing tools; clip to the price pane; commit.

### 4. Selection, dragging, keyboard and undo

**Files:** new `src/components/charts/drawings/{hitTest,interaction,history}.ts` with tests; modify `CandlestickChart.tsx`, `useDrawings.ts`; add `CandlestickChart.drawings.test.tsx`.

- [ ] Add failing tests for spec acceptance items 3, 6, 7 and 8, including Ctrl+Z with the ruler.
- [ ] Implement hover, select, move, reshape, Shift constraint, lock, Escape restore, Delete, per-symbol undo/redo and the Ctrl-tap ruler toggle; commit.

### 5. Rail, toolbar and text editing

**Files:** `src/components/market/DrawingRail.tsx` and test; new `DrawingToolbar.tsx` and `TextNoteEditor.tsx` under `src/components/charts/` with tests.

- [ ] Add failing tests for flyouts with last-used tool, Magnet, Keep drawing, Hide all, Clear all confirmation, the toolbar actions and inline text editing.
- [ ] Implement them; remove `window.prompt` from the drawing path; commit.

### 6. New tools

**Files:** tool modules under `src/components/charts/drawings/tools/` with tests.

- [ ] Add failing tests for spec acceptance item 9 per tool.
- [ ] Implement horizontal ray, vertical line, trend-line extend options and labels, parallel channel, rectangle, Fibonacci level toggles and extend, trend-based extension, and long and short positions; commit.

## Verification

- `pnpm lint`, `pnpm typecheck`, `TZ=America/Sao_Paulo pnpm test:run` and `pnpm build`.
- Browser check of the MSW web preview: crosshair against the axis at several zoom and stretch levels, each tool placed, dragged, styled, undone and deleted, persistence across symbol, timeframe and reload, and hover smoothness with 200 drawings. Keep screenshots and temporary scripts outside the repository.
- Review the whole change, then `./work board set Q-122 in-review` with results and remaining limitations.
