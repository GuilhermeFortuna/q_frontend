# WO28 — Frontend: strategy library setup canvas (replaces the backtest config sidebar)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck/lint: `pnpm lint` (check `package.json` for exact names)

**Context for this work:** this batch ("Backtest Workbench") redesigns the Backtests page.
Today a fixed ~320px sidebar (`BacktestConfigForm`) holds _everything_ — engine, symbol,
dates, capital, sizing, costs, and a bare `<select>` of strategies — while the rest of the
screen shows "No Results Yet" until a run completes. This work order inverts that: **when
there is no run, the canvas itself is the setup experience** — a strategy library of cards,
a detail panel that argues for the selected strategy, and a compact horizontal band for
market/sizing config. WO27 extended `GET /api/v1/strategies` with `category`, `thesis`,
`strong_in`, `weak_in`, and per-param `hint` (the exact JSON is pasted in WO27's completion
message — build against that, with graceful fallbacks for a pre-WO27 backend). The
follow-up WO29 adds the focus-swap behavior between setup and results; **this WO keeps the
existing "results replace the canvas after a run" behavior** but must leave the layout in a
state WO29 can animate (setup and results as sibling panes of the workspace, not
interleaved).

---

## How the frontend works today (read these files)

- `src/workspaces/backtests/BacktestsWorkspace.tsx` — the host: sidebar + right panel
  with Results/History tabs. You are restructuring this layout.
- `src/components/backtests/BacktestConfigForm.tsx` — the sidebar being replaced. Read it
  **completely**: it owns ~17 pieces of state, the engine→strategy filtering, the
  `pendingBacktestConfig` hydration from the Optimizer ("Load into Backtest"), validation,
  and the exact `BacktestRequest` payload assembly. None of that behavior may regress.
- `src/components/shared/InstrumentConfigFields.tsx`, `StrategyParamFields.tsx`,
  `PositionSizingModeFields.tsx`, `TransactionCostFields.tsx` — shared field blocks **also
  used by the Optimize workspace**. You may extend them (e.g. a layout/density prop) but
  must not change their default rendering — the Optimize form stays pixel-identical.
- `src/lib/backtesting/positionSizing.ts`, `transactionCosts.ts`, `dateRange.ts`,
  `src/lib/strategies/strategyParams.ts` — pure helpers; reuse, don't fork.
- `src/api/queries/strategies.ts`, `src/types/strategies.ts` — extend `StrategyInfo` with
  WO27's optional fields. `src/mocks/` — MSW handlers to update.
- `src/styles/globals.css` — design tokens (`quant-panel`, brass/carbon/silver palette).
  The library must look native to this aesthetic: brass accents, carbon surfaces.

---

## Goal

With no run on screen, the Backtests canvas shows: a **horizontal config band** (engine,
symbol, timeframe, date range + presets, capital, point value, day-trade toggle, sizing,
costs — grouped, not one endless row), a **strategy library** (cards grouped/filterable by
category, one card per strategy with label, category badge, one-line description, param
count), and a **detail panel** for the selected strategy (the thesis, `strong_in` /
`weak_in` regime notes, and the param inputs each with its `hint` beside it). Run button
prominent. Submitting produces a `BacktestRequest` **byte-identical** to what the old
sidebar produced for the same inputs.

## Tasks

### 1. Extract config state from the form — `src/lib/backtesting/useBacktestConfig.ts`

Pull all state, the `pendingBacktestConfig` hydration effect, engine/strategy switch
handlers, validation, and the payload builder out of `BacktestConfigForm` into one hook
(`useBacktestConfig`) that returns `{ fields, setters, selectedStrategy, validation,
buildRequest }`. The new layout components are presentational consumers of this hook.
Add a test that snapshots `buildRequest()` output for a fully-populated config (candle
and tick variants) — this is the byte-compatibility guarantee.

### 2. Strategy types + fallbacks

Extend `StrategyInfo` in `src/types/strategies.ts` with optional `category`, `thesis`,
`strong_in`, `weak_in`, and `hint` on `StrategyParamSpec`, per WO27's pasted contract.
Central fallback helper (e.g. `src/lib/strategies/strategyPresentation.ts`): missing
`category` → `"other"`, missing `thesis` → fall back to `description`, missing hints →
render nothing. The page must work against a pre-WO27 backend with no crashes and no
empty-looking UI (the card one-liner is `description`, which always exists).

### 3. New components — `src/components/backtests/setup/`

- **`StrategyLibrary.tsx`** — responsive card grid. Filter chips by category (All /
  Trend / Mean reversion / Breakout / Momentum / Other — hide empty categories) **on top
  of** the existing engine filter (tick engine selected → only tick strategies, exactly as
  the old `<select>` filtered). Card: label, category badge, one-line description, param
  count, engine badge when `tick`. Selected card gets the brass-accent treatment. Cards
  are buttons (keyboard navigable, `aria-pressed`).
- **`StrategyDetailPanel.tsx`** — for the selected strategy: thesis paragraph,
  `strong_in` / `weak_in` as two short labeled lines, then the param inputs. Params reuse
  the input styling of `StrategyParamFields` but render each `hint` as muted text beside/
  below its field — extend `StrategyParamFields` with an optional hints-aware layout
  rather than duplicating the input logic.
- **`MarketConfigBand.tsx`** — the horizontal band. Group related fields (instrument /
  range / capital / sizing / costs); day-trade times and tick-engine fields appear
  conditionally as today. It will be denser than the old vertical stack — use grouped
  fieldsets with small labels, not 12 naked inputs in a row. Validation messages surface
  inline exactly as today (date order, sizing, costs).
- **`BacktestSetupPanel.tsx`** — composes band + library + detail + Run button + the
  error display (the rose-colored box from the old form). This is the single component
  `BacktestsWorkspace` mounts for setup.

### 4. Workspace restructure — `BacktestsWorkspace.tsx`

- No run + not loading → `BacktestSetupPanel` fills the canvas. The Results/History tabs
  remain reachable (History must not require having run something first — keep the tab
  strip, or an equivalent affordance, visible in the setup state).
- Run pending → existing spinner state. Run completed → existing `BacktestResultsTabs`
  fills the canvas, **plus a slim summary strip** of the submitted config (strategy +
  params digest · symbol · timeframe · range · capital) with an "Edit setup" button that
  returns to the setup canvas _without_ clearing the last results (state, not refetch).
  Keep this strip dumb and minimal — WO29 replaces it with the interactive focus-swap
  teaser; structure the workspace so setup and results are **sibling panes** WO29 can
  animate between.
- Delete `BacktestConfigForm.tsx` once nothing imports it. The Optimize workspace and its
  form are untouched.

### 5. Tests

- `buildRequest()` snapshot parity (task 1) — candle + tick, sizing modes, costs.
- Hydration: a staged `pendingBacktestConfig` (Optimizer → "Load into Backtest") lands in
  the new UI — strategy selected in the library, params merged, band fields populated.
- Engine switch: selecting tick engine filters the library and swaps to a valid strategy.
- Category filter chips show only non-empty categories; fallback path (strategies without
  WO27 fields) renders cards from `description` alone.
- Edit-setup round trip: run → results → "Edit setup" → setup shows previous values →
  results still available without refetch.

---

## Definition of done

- `pnpm test:run` and the lint/typecheck scripts pass. **Do not report completion until
  they do.**
- The Optimize workspace renders pixel-identical (shared components unchanged by default).
- A real backtest run from the new UI returns the same results as before for the same
  inputs (verify against the dev backend, not just mocks).
- In your final message: list which shared components gained layout props, and confirm
  setup/results are sibling panes ready for WO29's animation.

## Out of scope

- The reversible focus-swap interaction and animated pane transitions (WO29).
- Backend changes (WO27 is the contract; gaps go back as follow-ups).
- Touching the Optimize workspace beyond keeping shared components compatible.
- Strategy comparison, favorites, or search within the library (later, if the library
  grows past ~15 strategies).
