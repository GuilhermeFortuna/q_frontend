# WO6 — Frontend: data-driven strategy selector + dynamic param forms

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Frontend** `C:\Users\guilherme\q\q_frontend` — React 19 / TypeScript / Vite, uses `pnpm`.
  NEVER use npm.
  - Tests: `pnpm test:run` · Types: `pnpm typecheck` · Lint: `pnpm lint`

The app is a Tauri desktop frontend with workspaces (launcher, market-data, backtests, optimize,
system), TanStack Query for server state, Zustand for client state, and **MSW** mocks as the
default dev mode. Match the existing carbon/brass dark theme — re-skin any new UI to neighboring
components, never ship stock shadcn styling.

This work order is **frontend only.** It depends on **WO5**, which adds the strategy registry and
the `GET /api/v1/strategies` schema endpoint.

---

## The problem

The backtest and optimize forms are hardcoded to the single MA-crossover strategy:

- `src/components/backtests/BacktestConfigForm.tsx` — the strategy `<select>` has one option
  (`MACrossover`), and the param block (short/long period, MA types, threshold) is hand-written.
  The staged-config hydration (the `pendingBacktestConfig` effect) also reads MA param keys by name.
- `src/components/optimize/OptimizeStrategySection.tsx` — read this; it hardcodes the same MA
  params for the optimization search space. Apply the same data-driven treatment here.

WO5 now serves every strategy and its parameter schema, so these forms should be generated from
the schema instead of hardcoded.

---

## Endpoint contract (from WO5)

`GET /api/v1/strategies`

```json
{
  "strategies": [
    {
      "name": "MACrossover",
      "label": "MA Crossover",
      "description": "Short/long moving-average crossover.",
      "params": [
        {
          "name": "short_period",
          "label": "Short Period",
          "type": "int",
          "default": 50,
          "min": 2,
          "max": 400,
          "step": 1
        },
        {
          "name": "short_ma_type",
          "label": "Short MA Type",
          "type": "categorical",
          "default": "sma",
          "choices": ["sma", "ema", "wma", "smma", "hma"]
        },
        {
          "name": "threshold",
          "label": "Threshold",
          "type": "float",
          "default": 0.0,
          "min": 0.0,
          "max": 100.0,
          "step": 0.01
        }
      ]
    }
  ]
}
```

Param `type` is one of `int` | `float` | `categorical`. Use WO5's ACTUAL emitted schema (paste it
in before building); if it differs from this sketch, follow the real one and note the difference.

---

## Tasks

### 1. Query hook + types

Add `useStrategies()` in `src/api/queries/` (new `strategies.ts` or alongside backtests) and a
`StrategyInfo` / `StrategyParamSpec` type. `staleTime: Infinity` is fine — the schema is static
per server.

### 2. Dynamic param renderer

Build a small component that, given a `StrategyParamSpec[]` and a values object, renders the right
control per `type` (`int`/`float` → number input with min/max/step; `categorical` → `<select>`
of `choices`) and reports changes. Reuse the existing `inputClass`/`fieldErrorClass` styling from
`InstrumentConfigFields`. This replaces the hardcoded MA block in `BacktestConfigForm`.

### 3. Wire the backtest form

- Populate the strategy `<select>` from `useStrategies()`.
- When the selected strategy changes, initialize its params to the schema defaults.
- Submit `strategy` + the dynamic `strategy_params` object.
- **Generalize the hydration effect**: when `pendingBacktestConfig` is applied, copy the entire
  `strategy_params` object generically instead of reading hardcoded MA keys, so staged configs
  for ANY strategy rehydrate correctly. (The History "Re-run" and the optimizer "Load into
  Backtest" flows both rely on this — don't break them.)

### 4. Wire the optimize form

Apply the same schema-driven approach in `OptimizeStrategySection.tsx`: choose a strategy, then
generate the search-space rows from its params (the param `min`/`max`/`step` make sensible
default search bounds; `categorical` params become categorical search options). Keep the existing
optimize run/results flow unchanged.

### 5. MSW + fixtures

Add an `*/api/v1/strategies` handler in `src/mocks/handlers.ts` and a fixture in
`src/mocks/data.ts` containing all WO5 strategies, so both forms work offline.

### 6. Tests

- A test that the dynamic renderer produces the right control per param type.
- A test that selecting a strategy populates defaults and submits the correct `strategy_params`.
- Keep/extend the existing `BacktestConfigFormHydration` test so staged-config rehydration still
  passes with the generalized logic.

---

## Definition of done

- `pnpm typecheck` **and** `pnpm test:run` **and** `pnpm lint` all pass. Do not report completion
  until all three are green.

## Out of scope

- **Do NOT build new chart layers or indicator rendering.** The backend auto-emits each strategy's
  indicators in the existing backtest `indicators` payload, and `OscillatorPane` / the indicator
  layers already render them generically. New strategies' charts work with zero changes here.
- Any backend change.
- Changing the existing backtest/optimize run or results flows — this is form generation only.
