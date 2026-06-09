# WO2 — Frontend: backtest run history UI

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Frontend** `C:\Users\guilherme\q\q_frontend` — React 19 / TypeScript / Vite, uses
  `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Types: `pnpm typecheck` · Lint: `pnpm lint`
- **Backend** `C:\Users\guilherme\q\q_backend` — provides the API (already running for
  this work; endpoints below are implemented in WO1).

The app is a Tauri desktop frontend with workspaces (launcher, market-data, backtests,
optimize, system), TanStack Query for server state, Zustand for client state, and **MSW**
mocks as the default dev mode. Match the existing carbon/brass dark theme — re-skin any
new UI to neighboring components, never ship stock shadcn styling.

This work order is **frontend only.** It depends on WO1's two endpoints.

---

## Endpoint contract (from WO1)

`GET /api/v1/backtests?limit=&offset=&symbol=`

```json
{
  "items": [
    {
      "run_id": "3f9a1c8e7b...",
      "symbol": "WIN$",
      "strategy": "MACrossover",
      "timeframe": "M5",
      "status": "completed",
      "created_at": "2026-06-09T12:00:00Z",
      "summary": { "...": "metrics dict, or null if failed" }
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

`GET /api/v1/backtests/{run_id}`

```json
{
  "run_id": "3f9a1c8e7b...",
  "symbol": "WIN$",
  "strategy": "MACrossover",
  "timeframe": "M5",
  "status": "completed",
  "config": { "...": "full backtest request" },
  "result_summary": { "...": "metrics dict, or null" },
  "error_message": null,
  "started_at": "...",
  "finished_at": "...",
  "created_at": "..."
}
```

> **IMPORTANT:** the detail endpoint does NOT return `trades`/`bars`/`indicators` — those
> are not persisted server-side. History detail can show **metrics + config only**. To see
> the full chart again, the user re-runs the backtest from the rehydrated config.

If WO1's final response shapes differ from the above, use WO1's actual shapes and note the
difference.

---

## Tasks

### 1. Query hooks

In `src/api/queries/backtests.ts` add `useBacktestHistory()` (list) and
`useBacktestRun(id)` (detail). Follow the existing TanStack Query patterns in
`src/api/queries/optimize.ts` (a `queryKeys` factory, typed responses). After a
`useRunBacktest` mutation succeeds, `invalidateQueries` on the history key so the list
updates live.

### 2. Types

Add types to `src/types/backtesting.ts` matching the contract above
(`BacktestRunSummary`, `BacktestRunDetail`, paginated wrapper).

### 3. History panel

Add a **"History"** tab/panel to `src/workspaces/backtests/BacktestsWorkspace.tsx` plus a
new component under `src/components/backtests/`. It lists past runs (symbol, strategy,
status, a few summary metrics, relative time). Clicking a run rehydrates the config into
the backtest form and shows its stored metrics.

> Reuse the existing rehydration mechanism — commit `ece56d8` already hydrates the backtest
> form from a staged optimization trial config. Follow that approach; do not invent a new
> state-passing mechanism. Because charts aren't persisted, the rehydrated view shows
> stored metrics and offers a clear "Re-run" affordance to regenerate the full chart.

### 4. MSW

Add handlers in `src/mocks/handlers.ts` and seed fixtures in `src/mocks/data.ts` for both
endpoints, so the History UI works fully offline (MSW is the default dev mode).

### 5. Test

A Vitest test for the new hooks against MSW (list returns items; detail returns a run).

---

## Definition of done

- `pnpm typecheck` **and** `pnpm test:run` **and** `pnpm lint` all pass. Do not report
  completion until all three are green.

## Out of scope

- Any backend change.
- Optimization history (that is WO4).
- Changing the existing backtest run/results flow — History is purely additive.
- Trying to render trade/candle charts from the history detail endpoint (it has no such data).
