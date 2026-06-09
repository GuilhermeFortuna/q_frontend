# WO4 — Frontend: optimization study history UI

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Frontend** `C:\Users\guilherme\q\q_frontend` — React 19 / TypeScript / Vite, uses
  `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Types: `pnpm typecheck` · Lint: `pnpm lint`

The app is a Tauri desktop frontend with workspaces (launcher, market-data, backtests,
optimize, system), TanStack Query for server state, Zustand for client state, and **MSW**
mocks as the default dev mode. Match the existing carbon/brass dark theme — re-skin any new
UI to neighboring components, never ship stock shadcn styling.

This work order is **frontend only.** It depends on **WO3** (optimization persistence) and
mirrors the pattern already established by **WO2** (backtest history) — read WO2 and the
backtest history components first and follow the same structure.

---

## Endpoint contract (from WO3)

`GET /api/v1/optimizations?limit=&offset=`

```json
{
  "items": [
    {
      "study_id": "3f9a...",
      "name": "WIN$ MA sweep",
      "status": "done",
      "best_value": 1.83,
      "n_trials": 100,
      "completed_trials": 100,
      "created_at": "2026-06-09T12:00:00Z"
    }
  ],
  "total": 7,
  "limit": 50,
  "offset": 0
}
```

Detail/results reuse the **existing** endpoints, which WO3 makes restart-safe:
`GET /api/v1/optimize/{study_id}` (status) and `GET /api/v1/optimize/{study_id}/results`.

If WO3's final shapes differ, use WO3's actual shapes and note the difference.

---

## Tasks

### 1. Query hook

In `src/api/queries/optimize.ts` add `useOptimizationHistory()` (list). Reuse the existing
`optimizeKeys` factory and the existing `useOptimizationResults` / `useOptimizationStatus`
hooks for detail — do not duplicate them. After a `useStartOptimization` mutation succeeds,
invalidate the history key so the list updates live.

### 2. Types

Add the list item + paginated wrapper types to `src/types/optimization.ts`.

### 3. History panel

Add a **"History"** tab/panel to `src/workspaces/optimize/OptimizeWorkspace.tsx` plus a new
component under `src/components/optimize/`. It lists past studies (name, status, best value,
trial count, relative time). Clicking a study loads its results via the existing
results hook and renders them in the existing results panel/tabs (Pareto, trials table,
best params) — those components already exist; reuse them, don't rebuild.

> Mirror WO2's backtest History panel for layout and interaction consistency. Reuse the
> existing trial-staging flow (commit `ece56d8`) where a selected trial config can be sent
> to the backtest form.

### 4. MSW

Add a handler in `src/mocks/handlers.ts` and seed fixtures in `src/mocks/data.ts` for
`GET /api/v1/optimizations`, consistent with the existing optimize mocks so the History UI
works offline.

### 5. Test

A Vitest test for the new history hook against MSW.

---

## Definition of done

- `pnpm typecheck` **and** `pnpm test:run` **and** `pnpm lint` all pass. Do not report
  completion until all three are green.

## Out of scope

- Any backend change.
- Rebuilding the results/Pareto/trials components — reuse the existing ones.
- Changing the live optimization run/polling flow — History is purely additive.
