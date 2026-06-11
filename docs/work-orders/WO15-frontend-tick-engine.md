# WO15 — Frontend: tick-engine toggle, tick params, TICK runs in history & chart

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck: `pnpm typecheck` · Lint: `pnpm lint`
  - Unit tests use Vitest + Testing Library + **MSW** (`src/mocks/handlers.ts`,
    `src/mocks/data.ts`). Any endpoint shape you consume MUST have a matching MSW handler.

**Context for this work:** the platform now has a second backtest engine — a **tick-data
engine** that simulates intrabar fills at MT5 tick resolution (real bid/ask, stop-loss /
take-profit). The backend work (WO12–WO14) is done. This work order lets users **choose the
tick engine in the backtest form**, run it, and see the results in the existing chart and
history. The candle path must keep working exactly as it does today.

**WO14 (prerequisite) shipped — build against its completion-message JSON:**

- `POST /api/v1/backtest/run` accepts an additive `engine: "candle" | "tick"` (default
  `"candle"`), plus tick-only `display_timeframe` (bar size for the chart, e.g. `"M1"`) and
  `tick_flags` (`"all" | "trade"`).
- Tick strategy params (including SL/TP) come through `strategy_params` — the **same
  schema-rendered mechanism** candle strategies already use. No bespoke SL/TP UI.
- `BacktestResponse` is **unchanged**: `{metrics, trades, bars, indicators, run_id}`. Tick
  runs return resampled `bars` + bar-aligned `indicators`, and `trades` carry exact tick
  entry/exit prices. **So the chart and results tabs work as-is.**
- Persisted tick runs use `timeframe: "TICK"` in history list/detail.
- `GET /api/v1/strategies` tags each strategy with `engine: "candle" | "tick"`.

This work order is **frontend only.**

---

## How the backtest form & results work today (read these files)

- `src/types/backtesting.ts` — `BacktestRequest` (~line 17), `BacktestResponse` (~line 72),
  `BacktestRunSummary`/`BacktestRunDetail` (`timeframe: string`). **You extend `BacktestRequest`
  here** (additive).
- `src/types/strategies.ts` — `StrategyInfo` (~line 14). **Add `engine` here.**
- `src/components/backtests/BacktestConfigForm.tsx` — the whole config form (~307 lines).
  - Local state for symbol/timeframe/dates/capital/sizing/strategy/params; strategy list from
    `useStrategies()`; params auto-render via `StrategyParamFields` (~line 280). The strategy
    `<select>` (~line 265) lists every strategy. `handleSubmit` (~line 134) builds the
    `BacktestRequest`. **This is the main file you change.**
  - `InstrumentConfigFields` (imported ~line 10) renders symbol + `timeframe` + dates +
    capital. The `timeframe` here is the candle timeframe.
- `src/components/shared/StrategyParamFields.tsx` — renders `StrategyParamSpec[]` into inputs.
  Tick strategy params (periods, SL, TP) render through this with **no change** — that's the
  design. Confirm it handles the tick strategy's param types.
- `src/api/queries/strategies.ts` — `useStrategies()` hook.
- `src/api/queries/backtests.ts` — the run-backtest mutation + history queries.
- `src/components/backtests/BacktestStrategyChart.tsx`, `TradeMarkersLayer.tsx`,
  `StrategyIndicatorLayer.tsx`, `BacktestResultsTabs.tsx` — consume `bars`/`indicators`/`trades`.
  These should need **no logic change** (same contract); verify they render a tick response.
- `src/components/backtests/BacktestHistoryPanel.tsx`, `BacktestHistoryFilters.tsx` — list +
  filters showing `timeframe`. Make sure `"TICK"` renders cleanly (and is a selectable filter
  value if timeframe is a filter).
- `src/mocks/handlers.ts` + `src/mocks/data.ts` + `src/mocks/backtest.ts` — MSW handlers/mocks
  for `/api/v1/backtest/run`, `/api/v1/strategies`, `/api/v1/backtests`. **You add tick
  variants here.**
- Styling: Tailwind v4 project palette (`carbon-*`, `silver-*`, `brass-*`). Match the form's
  existing class usage (see the `inputClass` / Risk Model section).

---

## Goal

A user can flip the backtest form to the **Tick** engine, pick a tick strategy, set its
params (SL/TP auto-rendered) and a chart display timeframe, run it, and see results + history
exactly like a candle run — with the run labeled `TICK`. Candle remains the default and is
untouched.

## Tasks

### 1. Types

- `src/types/backtesting.ts` — extend `BacktestRequest` (additive, all optional so existing
  callers compile):
  ```ts
  engine?: 'candle' | 'tick'
  display_timeframe?: string   // tick-only: chart bar size, e.g. 'M1'
  tick_flags?: 'all' | 'trade' // tick-only
  ```
- `src/types/strategies.ts` — add `engine?: 'candle' | 'tick'` to `StrategyInfo` (optional for
  back-compat; treat missing as `'candle'`).

### 2. Engine toggle in `BacktestConfigForm`

- Add `engine` state (default `'candle'`). Render a clear two-option toggle near the top of
  the form (segmented control or a `<select>` matching the Risk Model select style) labeled
  **Engine: Candle / Tick**.
- **Filter the strategy `<select>`** to strategies whose `engine` matches the selected engine
  (treat missing `engine` as `'candle'`). When the engine changes and the current strategy
  isn't valid for it, select the first matching strategy and reset its params via
  `defaultParamsFromSpecs` (reuse the existing `handleStrategyChange` logic).
- When `engine === 'tick'`:
  - Show a **Display Timeframe** select (`display_timeframe`, values like
    `M1/M5/M15/H1`, default `M1`) — this controls only chart resampling, label it as such.
  - Show a **Tick Source** select (`tick_flags`: `All ticks` → `'all'`, `Trades only` →
    `'trade'`, default `'all'`).
  - The candle `timeframe` field is not used for fetching ticks. Either hide it for tick mode
    or relabel — keep the change minimal; do not break `InstrumentConfigFields` for candle.
- `handleSubmit`: include `engine`, and when tick, `display_timeframe` + `tick_flags`. SL/TP
  and other tick params flow through `strategy_params` automatically (no special handling).

> **GUARDRAIL — candle is the default and unchanged.** With `engine` left at `'candle'`, the
> submitted `BacktestRequest` must be identical to today (no `display_timeframe`/`tick_flags`
> keys, same strategy list behavior). The existing form tests must stay green.

### 3. History & chart render TICK runs

- `BacktestHistoryPanel` / `BacktestHistoryFilters`: confirm a run with `timeframe: "TICK"`
  renders its label cleanly in the list and detail. If timeframe is a filter dropdown, add
  `"TICK"` as an option (or ensure free values pass through).
- `BacktestStrategyChart` + `TradeMarkersLayer` + `BacktestResultsTabs`: verify a tick
  `BacktestResponse` renders (same `bars`/`indicators`/`trades` contract). Trade markers sit
  at the exact tick prices the backend returns — no client math needed. Fix only if something
  actually breaks on a `"TICK"` label or the resampled bars; otherwise leave untouched.

### 4. Optimizer form (light touch — keep consistent or defer)

The optimizer config (`src/components/optimize/OptimizeConfigForm.tsx`) also picks a strategy.
WO16 handles the **backend** tick optimizer. For this WO, **do not** add tick optimization UI
unless trivial — if you filter strategies anywhere by engine, make sure the optimizer form is
not accidentally broken. Note any follow-up for the optimizer UI in your final message.

### 5. MSW mocks + tests

- `src/mocks/data.ts` / `handlers.ts` / `backtest.ts`:
  - `/api/v1/strategies` mock: include at least one strategy tagged `engine: "tick"` (with a
    couple of params incl. an SL and TP) alongside the existing candle ones.
  - `/api/v1/backtest/run`: when the request body has `engine: "tick"`, return a tick-shaped
    `BacktestResponse` (resampled bars, bar-aligned indicators, trades with exact prices).
  - `/api/v1/backtests`: include a run with `timeframe: "TICK"` in the history mock.
- Unit tests (follow `tests/unit/components/*.test.tsx`):
  - Engine toggle switches the strategy list: candle strategies shown for Candle, tick
    strategies for Tick; switching engines resets the selected strategy + params.
  - Selecting Tick reveals Display Timeframe + Tick Source; submitting builds a request with
    `engine:"tick"`, `display_timeframe`, `tick_flags`, and SL/TP inside `strategy_params`.
  - Selecting Candle (default) builds a request with **no** tick-only keys (back-compat).
  - History row with `timeframe:"TICK"` renders the TICK label.

### 6. Docs

If the repo has a frontend feature doc / changelog convention, note the tick engine option.
Otherwise skip — no invented docs.

---

## Definition of done

- `pnpm test:run`, `pnpm typecheck`, and `pnpm lint` all pass. **Do not report completion
  until they do.**
- Candle backtests are provably unchanged (existing form/chart/history tests green).
- In your final message, summarize the new `BacktestRequest` fields, the `StrategyInfo.engine`
  addition, and any optimizer-UI follow-up you deferred to a later work order.

## Out of scope

- Any backend change (WO12–WO14 own it; WO16 owns tick optimization).
- Tick optimization UI (depends on WO16; note it as follow-up).
- A new charting approach / rendering raw ticks — the backend resamples to bars; the existing
  chart consumes them.
- New dependencies.
