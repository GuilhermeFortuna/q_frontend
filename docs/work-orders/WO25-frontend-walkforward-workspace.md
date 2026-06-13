# WO25 — Frontend: walk-forward (Validate) workspace

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck/lint: `pnpm lint` (check `package.json` for exact names)

**Context for this work:** this batch ("Research Validation") adds walk-forward analysis —
optimize on a rolling in-sample window, test the best parameters on the next out-of-sample
window, stitch the OOS segments into the one equity curve that deserves trust. The backend
shipped in WO23/WO24: `POST /api/v1/walkforward` takes `{"optimization":
<OptimizationConfig>, "walkforward": {train_days, test_days, mode: "rolling"|"anchored",
min_windows}}` and runs as a background job with the same status/results/cancel/history
lifecycle as optimization studies. **The exact JSON contracts (status payload, results
payload with per-window records, aggregate OOS metrics, efficiency ratio, equity artifact
endpoint) are pasted in WO24's completion message — build against that, not guesses.**
This work order is **frontend only.**

---

## How the frontend works today (read these files)

- `src/app/router.tsx` — TanStack Router route table; workspaces register here.
  `WorkspaceId` lives in `src/types/api.ts`; the dock/nav lives under
  `src/components/dock/` and `src/components/layout/AppShell.tsx` — find where existing
  workspaces (backtests, optimize) declare their nav entry and mirror it.
- `src/workspaces/optimize/OptimizeWorkspace.tsx` — the structural template: config form
  on one side, progress + results on the other, history panel.
- `src/components/optimize/` — `OptimizeConfigForm.tsx` and its sections
  (`OptimizeStrategySection`, `OptimizeRiskSection`, `OptimizeStudySection`,
  `StrategySearchSpaceFields`, `optimizeFormShared.tsx`). The walk-forward form is this
  form plus a window-config section — **reuse these components/sections; do not fork
  them.** If a section needs a prop to be embeddable, add it additively.
- `src/api/queries/optimize.ts` + `src/api/client.ts` — query/mutation patterns
  (TanStack Query), polling for job status. `src/types/optimization.ts` — config types.
- `src/components/backtests/EquityCurveChart.tsx`, `DrawdownChart.tsx`,
  `BacktestMetricsBar.tsx` — reuse for the OOS results display.
- `src/components/optimize/OptimizationHistoryPanel.tsx` — history-list pattern.
- `src/mocks/` — MSW handlers; tests run against mocked endpoints.

---

## Goal

A new **Validate** workspace at `/validate`: configure a walk-forward run (existing
optimizer form + train/test window fields), launch it, watch per-window progress, and read
the verdict — stitched OOS equity curve, per-window table, IS-vs-OOS comparison, and the
walk-forward efficiency ratio — plus a history panel of past runs.

## Tasks

### 1. Types + API layer

- `src/types/walkforward.ts`: `WalkForwardConfig`, request body, status payload,
  `WalkForwardWindowResult`, `WalkForwardResult` — field-for-field from WO24's pasted
  contracts.
- `src/api/queries/walkforward.ts`: start mutation, status query (poll while
  running, same interval/pattern as the optimize status query), results query, history
  list, delete, cancel. MSW handlers in `src/mocks/` for all of them.

### 2. Workspace + route

- `src/workspaces/walkforward/WalkForwardWorkspace.tsx`, route `/validate`, `WorkspaceId`
  union extended, dock/nav entry added (mirror how `/optimize` registers).
- Layout mirrors `OptimizeWorkspace`: form → progress → results, history panel.

### 3. Config form

- Reuse the optimize form sections for instrument/range/strategy/search-space/objective/
  trials. Add a **Walk-forward windows** section: `train_days`, `test_days`,
  `mode` (rolling/anchored toggle with one-line explanations), `min_windows`.
- Client-side sanity hint: show the implied window count for the chosen date range
  (`floor((range_days - train_days) / test_days)` in rolling mode) and warn under
  `min_windows` before the user ever hits the backend's 422.
- Tick engine is not supported (WO24 rejects it): if the selected strategy is tick-only,
  disable submission with an explanatory hint (see how the backtest form filters
  strategies by engine — `BacktestConfigForm.tsx`).

### 4. Progress

While running: "Window 3 / 8 — optimizing" with a per-window progress bar
(`windows_completed / total_windows`) and the phase label from the status payload.
Cancel button → cancel endpoint. Handle the backend-restart case (status served from DB,
no live progress) gracefully.

### 5. Results

The payoff screen — make the OOS verdict unmissable:

- **Stitched OOS equity curve** (reuse `EquityCurveChart`) with vertical window-boundary
  markers; aggregate OOS metrics in a `BacktestMetricsBar`-style strip; the **efficiency
  ratio** displayed prominently with a plain-language gloss (≥ ~0.5–0.6 "parameters
  generalize"; near 0 or negative "likely overfit" — exact copy your call, keep it honest).
- **Windows table**: one row per window — train/test ranges, best params (compact,
  expandable), key IS metrics vs OOS metrics side by side, OOS-worse-than-IS highlighted;
  `no_result` windows visibly marked.
- **IS vs OOS chart**: grouped bars per window for the study's objective metric — the
  single most persuasive overfitting visual.

### 6. History panel

List past walk-forward runs (status, symbol, strategy, window count, OOS net profit,
efficiency), open one to re-render results (results endpoint + lake-backed equity
artifact), delete with confirm. Mirror `OptimizationHistoryPanel`.

### 7. Tests

`pnpm test:run` additions (Vitest + MSW, follow existing test layout under `tests/`):

- Form: implied-window-count hint math; `min_windows` warning; request body assembled
  correctly (assert the mutation payload matches WO24's contract).
- Status polling renders window/phase progress; terminal states stop polling.
- Results: windows table renders IS/OOS pairs; `no_result` window styled; efficiency
  ratio formatting (including `null`).
- History: list renders; open → results query fired with run id.

---

## Definition of done

- `pnpm test:run` and the lint/typecheck scripts pass. **Do not report completion until
  they do.**
- No existing workspace/route behavior changes; optimize form sections reused, not forked.
- In your final message: note any prop you added to shared optimize sections, and confirm
  the manual smoke path (backend up → start a 2-window run → watch progress → results
  render) if you ran it.

## Out of scope

- Backend changes of any kind (contract gaps go back as WO24 follow-ups — note them).
- Parameter-stability heatmaps / Monte Carlo visuals (later WOs in this phase).
- Run comparison across backtests (WO26).
- Launching a standard backtest from a window's params (nice follow-up; note it, skip it).
