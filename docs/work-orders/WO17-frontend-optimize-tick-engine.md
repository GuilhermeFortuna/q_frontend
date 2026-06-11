# WO17 — Frontend: tick engine in the Optimizer form

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck: `pnpm typecheck` · Lint: `pnpm lint`
  - Unit tests use Vitest + Testing Library + **MSW** (`src/mocks/handlers.ts`,
    `src/mocks/data.ts`). Any endpoint shape you consume MUST have a matching MSW handler.

**Context for this work:** the platform has a tick-data backtest engine. **WO15** already added
an engine toggle to the _single-run backtest_ form. The **backend optimizer now also accepts
tick configs** — WO16 shipped `TickBacktestRunner`, and `POST /api/v1/optimize` reads
`engine`, `display_timeframe`, and `tick_flags` from the optimization config's `backtest`
block (`engine` defaults to `"candle"`). But the **Optimizer form doesn't expose any of it
yet** and doesn't filter strategies by engine. This work order closes that gap so users can
run tick-engine _optimization studies_ from the UI. It is the deferred follow-up WO15 called
out. This work order is **frontend only.**

**What the backend already accepts (build against this):** the optimization `backtest`
sub-config carries (additively, defaults shown):

```
engine: "candle" | "tick"   = "candle"
display_timeframe: string    = "M1"   # tick-only: chart/display bar size
tick_flags: "all" | "trade" | null    # tick-only: tick source
```

Tick strategies are tagged `engine: "tick"` in `GET /api/v1/strategies` (WO13/WO14). Tick
strategy params (periods, SL, TP) come through the same `StrategyParamSpec` schema candle
strategies use — so the **search-space UI renders them with no change**.

---

## How the Optimizer form works today (read these files)

- `src/components/optimize/OptimizeConfigForm.tsx` — the form container (~305 lines). Holds all
  state (symbol/timeframe/dates/capital/dayTrade/strategy/searchSpace/risk/study). `useStrategies()`
  (~line 72) lists strategies; `handleStrategyChange` (~line 124) resets the search space from
  the new strategy's params; `handleSubmit` (~line 146) assembles the `OptimizationConfig`
  (note the `backtest: {...}` block ~line 174 — **you add tick fields here**). Mirror exactly
  how WO15 changed `BacktestConfigForm.tsx`.
- `src/components/optimize/OptimizeStrategySection.tsx` — owns the `InstrumentConfigFields`
  (symbol/timeframe/dates/capital, ~line 73), the strategy `<select>` (~line 100, maps
  `strategies`), and the search-space fields (`StrategySearchSpaceFields`). \*\*The engine toggle
  - tick-only selects go here\*\* (next to the strategy select). It already receives day-trade
    props from the container — add engine/tick props the same way.
- `src/components/shared/InstrumentConfigFields.tsx` — shared symbol/timeframe/date inputs (WO15
  touched this for the backtest form; reuse whatever tick affordance it already grew rather than
  duplicating).
- `src/lib/optimize/hydrateConfigForm.ts` — `hydrateOptimizeFormFromConfig(config, strategies)`
  returns an `OptimizeFormHydration` object the form spreads into state (used by
  "continue study" / "load into optimizer"). **Add the tick fields to both the return type and
  the mapping** so a persisted tick study rehydrates correctly.
- `src/types/optimization.ts` — `OptimizationBacktestConfig` (~line 37; already has
  `day_trade*`). **Extend it here.**
- `src/api/queries/optimize.ts` — `useStartOptimization()` POSTs the `OptimizationConfig` as-is
  (~line 29). No change needed; it forwards whatever the form builds.
- `src/components/backtests/BacktestConfigForm.tsx` + its test — **the reference implementation.**
  WO15 did this exact change for the single-run form. Match its toggle UI, strategy-filtering
  logic, and test style.
- Styling: Tailwind v4 palette (`carbon-*`, `silver-*`, `brass-*`); match the existing form
  sections' classes.

---

## Goal

A user can switch the Optimizer to the **Tick** engine, pick a tick strategy (the strategy list
filters to the selected engine), set its search space (SL/TP auto-rendered) plus a display
timeframe and tick source, and launch a tick-engine study — with candle remaining the default
and unchanged.

## Tasks

### 1. Types

`src/types/optimization.ts` — extend `OptimizationBacktestConfig` (additive, optional):

```ts
engine?: 'candle' | 'tick'
display_timeframe?: string   // tick-only
tick_flags?: 'all' | 'trade' // tick-only
```

### 2. Engine toggle + strategy filtering in the form

In `OptimizeConfigForm.tsx` (mirror WO15's `BacktestConfigForm` changes):

- Add `engine` state (default `'candle'`), and `displayTimeframe` (`'M1'`) + `tickFlags`
  (`'all'`) state for tick mode.
- **Filter the strategy list by engine** (treat a strategy with no `engine` as `'candle'`).
  Pass the filtered list to `OptimizeStrategySection`. When the engine changes and the current
  strategy isn't valid for it, switch to the first matching strategy and reset its search space
  via `defaultSearchSpaceFromSpecs` (reuse `handleStrategyChange`).
- `handleSubmit`: add `engine` to the `backtest` block, and when tick, `display_timeframe` +
  `tick_flags`. Search-space `strategy_params` already flow through unchanged (SL/TP included).

### 3. Engine toggle + tick selects in `OptimizeStrategySection`

- Render the **Engine: Candle / Tick** toggle near the strategy select (match WO15's control).
- When `engine === 'tick'`: render a **Display Timeframe** select (`M1/M5/M15/H1`, default
  `M1`) and a **Tick Source** select (`All ticks` → `'all'`, `Trades only` → `'trade'`). Label
  the display timeframe as chart-only. The candle `timeframe` field is unused for tick fetching
  — hide or relabel it in tick mode (keep candle behavior intact).
- Thread the new props from the container like the existing `dayTrade*` props.

> **GUARDRAIL — candle is the default and unchanged.** With `engine` at `'candle'`, the
> submitted `OptimizationConfig.backtest` must be identical to today (no
> `display_timeframe`/`tick_flags` keys, same strategy list). Existing optimizer tests stay
> green.

### 4. Hydration

`src/lib/optimize/hydrateConfigForm.ts` — add `engine`, `displayTimeframe`, `tickFlags` to the
`OptimizeFormHydration` type and map them from `config.backtest` (defaulting `engine` to
`'candle'`, `displayTimeframe` to `'M1'`, `tickFlags` to `'all'`). Spread them into form state
in the container's hydration `useEffect` (alongside the `dayTrade*` setters). This makes
"continue" / "load into optimizer" round-trip tick studies.

### 5. MSW mocks + tests

- Reuse the WO15 strategy mock that already tags a strategy `engine: "tick"` (in
  `src/mocks/data.ts`); ensure `GET /api/v1/strategies` returns at least one tick strategy with
  an SL and TP param.
- The `POST /api/v1/optimize` mock should accept a body whose `backtest.engine === "tick"`
  (it already returns a start response; just confirm it doesn't choke on the new fields).
- Unit tests (follow `tests/unit/components/BacktestConfigForm.test.tsx`):
  - Engine toggle filters the strategy list (candle vs tick); switching engines resets the
    selected strategy + search space.
  - Selecting Tick reveals Display Timeframe + Tick Source; submitting builds an
    `OptimizationConfig` with `backtest.engine:"tick"`, `display_timeframe`, `tick_flags`, and
    SL/TP inside `search_space.strategy_params`.
  - Default (Candle) submit has **no** tick-only keys (back-compat).
  - Hydration: a tick `OptimizationConfig` rehydrates the engine toggle + tick selects.

---

## Definition of done

- `pnpm test:run`, `pnpm typecheck`, and `pnpm lint` all pass. **Do not report completion
  until they do.**
- Candle optimization is provably unchanged (existing optimizer form/hydration tests green).
- In your final message, note the new `OptimizationBacktestConfig` fields and the
  `OptimizeFormHydration` additions.

## Out of scope

- Any backend change (WO16 already accepts tick optimization configs).
- Results/scatter/terrain views — they're metric-driven and engine-agnostic; no change.
- New dependencies.
