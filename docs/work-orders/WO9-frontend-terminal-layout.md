# WO9 — Frontend: decompose Market workspace + resizable terminal layout

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck: `pnpm typecheck` · Lint: `pnpm lint`

**Context for this work:** the Market page is being upgraded into a Bloomberg-style
terminal. WO8 (already specified) wires live polled quotes into the page. This work order
is a **structural refactor**: split the ~820-line `MarketDataWorkspace.tsx` monolith into
focused components and introduce a resizable multi-panel layout with a reserved zone for
upcoming panels (time & sales, quote panel, instrument info — built in WO10).

This is a refactor-first task: **behavior must not change** except where the layout tasks
below say so. This work order is **frontend only.**

---

## How the Market page works today (read these files)

- `src/workspaces/market-data/MarketDataWorkspace.tsx` — everything in one component:
  1. Header ribbon — symbol title, exchange badge, OHLCV readout of hovered/latest bar,
     last price + change (and, post-WO8, an MT5 status pill).
  2. Market Watch sidebar — filter input, watchlist rows, MetaTrader search results.
  3. Chart toolbar — timeframe buttons, chart-type select, `IndicatorsPopover`, grid toggle.
  4. Chart body — `CandlestickChart` + loading/error states + progressive-loading badge.
  5. Drawing rail — vertical icon strip setting `activeDrawingTool`.
  6. Symbol search overlay — type-anywhere command palette (global keydown listener,
     timeframe commands via `parseTimeframeInput`, MT5 symbol search).
- State that ties them together: `selectedSymbol` (zustand `useAppStore`),
  `selectedTimeframe`, `chartType`, `indicators`, `showGrid`, `activeDrawingTool`,
  `hoveredBar`, watchlist (localStorage), and the `useDrawings` hook.
- Comparable precedent for component layout in this repo: `src/components/backtests/` and
  `src/components/optimize/` (one folder per workspace area, focused components, named
  exports).
- Tests live in `tests/unit/components/*.test.tsx` (Testing Library + MSW).

---

## Goal

`MarketDataWorkspace.tsx` becomes a thin composition root (~150 lines: state + layout),
each region is its own tested component, and the page gains drag-resizable panels with a
tabbed right-side zone ready to receive WO10's panels.

## Tasks

### 1. Extract components

Create `src/components/market/` and move each region into a focused component with a
props-only interface (state stays in the workspace; components are presentational unless
noted):

- `QuoteRibbon.tsx` — header ribbon. Props: symbol, instrument, activeBar, snapshot,
  connection status, sidebar-toggle callback.
- `MarketWatchPanel.tsx` — sidebar incl. filter input and MT5 search results. Props:
  watchlist, snapshots record, selectedSymbol, callbacks (select/add/remove). The
  `localStorage` watchlist logic moves into a new hook
  `src/hooks/useWatchlist.ts` (state + add/remove/persist + seed-from-instruments).
- `ChartToolbar.tsx` — timeframes, chart type, indicators popover, grid toggle.
- `DrawingRail.tsx` — the tool strip. Replace the five copy-pasted button blocks with a
  mapped array of `{tool, icon, title}`.
- `ChartPanel.tsx` — chart body incl. loading/error/backfill states, wrapping
  `CandlestickChart`.
- `SymbolCommandPalette.tsx` — the search overlay **including** the global keydown
  listener, `parseTimeframeInput`, and dropdown logic. `parseTimeframeInput` moves to
  `src/lib/market/timeframeCommands.ts` and gets exported (it gains unit tests).

> **GUARDRAIL — pure refactor.** No visual or behavioral change in this task: same
> classNames, same keyboard behavior, same loading states. If you find a bug, note it in
> your final message instead of fixing it silently.

### 2. Resizable panel layout

Add the **approved new dependency** `react-resizable-panels` (this is the one allowed
dependency for this work order; install with `pnpm add react-resizable-panels`).

- Horizontal `PanelGroup`: Market Watch (left, default ~280px equivalent, collapsible) ·
  chart (center, takes remaining space) · **detail zone** (right, default ~300px
  equivalent, collapsible). The drawing rail stays a fixed-width strip attached to the
  chart panel (not resizable).
- Persist layout via the library's `autoSaveId` (e.g. `quant-market-layout`).
- The existing sidebar-toggle button now collapses/expands the left panel (use the
  imperative panel API rather than conditional unmount, so widths persist).
- Resize handles styled to the project palette: 1px `carbon-700` line that brightens to
  `brass-500/60` on hover/drag.

### 3. Right detail zone — tabbed shell

Create `src/components/market/DetailZone.tsx`: a tab strip (`QUOTE` · `TAPE` · `INFO`)
styled like the existing uppercase micro-labels, with a content area. For this work order
each tab renders a centered placeholder (`Coming soon` in `text-silver-500` mono text) —
WO10 fills them. Active tab persisted in component state (zustand not needed). Right
panel starts **collapsed by default** so the page looks unchanged until WO10 lands.

### 4. Tests

- `tests/unit/lib/timeframeCommands.test.ts` — table-driven tests for
  `parseTimeframeInput` (`"60m"` → 1H, `"daily"` → 1D, `"7m"` → null, etc.).
- `tests/unit/hooks/useWatchlist.test.ts` — seed-from-instruments, add, remove,
  localStorage persistence (Vitest with mocked localStorage).
- Component smoke tests for `QuoteRibbon`, `MarketWatchPanel`, `ChartToolbar`,
  `DrawingRail` (render with representative props, assert key elements and that callbacks
  fire on click). Follow `tests/unit/components/BacktestHistoryPanel.test.tsx` for setup
  style.
- The workspace itself: one integration-style test that it renders watchlist + toolbar +
  chart region together under MSW.

---

## Definition of done

- `pnpm test:run`, `pnpm typecheck`, and `pnpm lint` all pass. **Do not report completion
  until they do.**
- `MarketDataWorkspace.tsx` is under ~200 lines and contains no JSX for ribbon/sidebar/
  toolbar/rail/palette internals — only composition + state wiring.
- The page is visually identical to before (right zone collapsed), except for resize
  handles.
- In your final message, list every new file and each component's props signature —
  WO10/WO11 build on these.

## Out of scope

- New data/panels (time & sales, quote panel, instrument info — WO10).
- Watchlist sorting/sparklines/keyboard nav, command-palette new commands (WO11).
- Any backend change. Any dependency other than `react-resizable-panels`.
- Touching `CandlestickChart` or anything under `src/components/charts/`.
