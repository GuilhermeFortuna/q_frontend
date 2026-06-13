# WO33 — Frontend: Discovery workspace (automatic strategy search leaderboard)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck/lint: `pnpm lint` (check `package.json` for exact names)

**Context for this work:** this batch ("Discovery") adds **automatic strategy search**: the
backend (WO30–WO32) sweeps every registered strategy, optimizes each, walk-forward-validates
each, and returns a **leaderboard ranked on out-of-sample performance**. `POST
/api/v1/strategy-search` takes a `StrategySearchConfig` and runs as a background job with the
same status/results/cancel/history lifecycle as walk-forward. **The exact JSON contracts
(request body, status payload with candidate/window progress, results payload with the ranked
`CandidateResult` leaderboard + summary + best, history item, per-candidate equity artifact)
are pasted in WO32's completion message — build against that, not guesses.** This work order
is **frontend only.**

**Prerequisite shipped:** WO32 (API + contracts).

---

## How the frontend works today (read these files — the walk-forward workspace is your twin)

The Discovery workspace is structurally a sibling of the Validate (walk-forward) workspace.
Read it first and mirror it; reuse its components, do not fork them.

- `src/workspaces/walkforward/WalkForwardWorkspace.tsx` — the structural template: config
  form → progress → results, plus a history panel.
- `src/components/walkforward/` — `WalkForwardConfigForm.tsx`, `WalkForwardProgress.tsx`,
  `WalkForwardResultsView.tsx`, `WalkForwardResultsPanel.tsx`, `IsOosComparisonChart.tsx`,
  `WalkForwardWindowsTable.tsx`, `WalkForwardHistoryPanel.tsx`. Each candidate's expanded
  detail is a walk-forward result — **reuse `WalkForwardResultsView` / `IsOosComparisonChart`
  for the per-candidate drill-down.** If a component needs a prop to be embeddable, add it
  additively.
- `src/api/queries/walkforward.ts` — the query/mutation + polling pattern to clone: start
  mutation, status query that polls while running and stops on terminal status
  (`useWalkForwardStatus`, ~line 112), results query gated on readiness, history, delete,
  cancel, equity-artifact query. `src/api/client.ts` is the axios client.
- `src/types/walkforward.ts` — the types + `isWalkForwardTerminalStatus` /
  `shouldFetchWalkForwardResults` helpers to mirror.
- `src/types/api.ts` — `WorkspaceId` union (extend it). `src/components/layout/AppShell.tsx`
  and the launcher (`src/workspaces/launcher/LauncherWorkspace.tsx`) — where workspaces
  declare their nav/launch entry; mirror how `walkforward`/`optimize` register.
- `src/store/slices/workspaceSlice.ts` — `pendingBacktestConfig` /
  `pendingOptimizationConfig` + their setters. **Reuse these to "promote" a winning candidate
  into the Backtest or Optimize workspace** (set the pending config, switch workspace).
- `src/components/optimize/` — `OptimizeConfigForm.tsx` and its sections (instrument / range /
  objective / study). The search config form reuses these for the shared fields plus the
  walk-forward window section plus a strategy multi-select.
- `src/mocks/` — MSW handlers; `src/mocks/walkforward.ts` is the pattern. Tests run against
  mocked endpoints.

---

## Goal

A new **Discover** workspace: configure a strategy search (instrument + range + objective +
walk-forward windows + which strategies + gate thresholds), launch it, watch per-candidate
progress, and read a **ranked leaderboard** of strategies by out-of-sample performance — each
row expandable to that strategy's walk-forward verdict, each promotable into Backtest/Optimize
— plus a history panel of past searches.

## Tasks

### 1. Types + API layer

- `src/types/strategySearch.ts`: `StrategySearchConfig`, `GateConfig`, request body, status
  payload, `CandidateResult`, `StrategySearchResults` (leaderboard + summary + best), history
  item, equity-artifact response — field-for-field from WO32's pasted contracts. Add
  `isStrategySearchTerminalStatus` / `shouldFetchStrategySearchResults` mirroring the
  walk-forward helpers.
- `src/api/queries/strategySearch.ts`: start mutation, status query (poll while running, same
  interval/stop-on-terminal pattern as `useWalkForwardStatus`), results query (gated on
  readiness), history list, delete, cancel, per-candidate equity-artifact query. MSW handlers
  in `src/mocks/strategySearch.ts` for all of them.

### 2. Workspace + registration

- New `WorkspaceId` `'discover'`; register in `AppShell` nav + the launcher (mirror
  `walkforward`). New `src/workspaces/discover/DiscoverWorkspace.tsx`, layout mirroring
  `WalkForwardWorkspace`: form → progress → results (leaderboard), history panel.

### 3. Config form — `src/components/discover/DiscoverConfigForm.tsx`

- Reuse optimize/walk-forward sections for instrument / date range / objective / study
  (n_trials, seed, sampler) and the **walk-forward windows** section (`train_days`,
  `test_days`, `mode`, `min_windows`) — pull these straight from `WalkForwardConfigForm`.
- **Strategy multi-select:** list registered strategies (from `GET /api/v1/strategies`, the
  existing strategies query), default **all selected**; tick-only strategies shown disabled
  with a "candle only" hint (search is candle-only this batch). Submitting with all selected
  sends `strategies: null` (or the full list — match WO32's contract).
- **Advanced → Gates** section: `min_completed_windows`, `min_oos_trades`, `efficiency_low`,
  `efficiency_high`, defaulted from the contract, collapsed by default.
- Client-side sanity hint: the implied window count for the chosen range + the candidate
  count ("will run N strategies × M windows"), and a warning under `min_windows` before the
  backend 422 — reuse the walk-forward form's window-count helper
  (`src/lib/walkforward/windowCount.ts`).

### 4. Progress — `src/components/discover/DiscoverProgress.tsx`

While running: "Candidate 3 / 9 — RSIMeanReversion — window 2/4 testing", driven by the
status payload (`current_candidate`/`total_candidates`/`candidate_id`/`strategy`/`phase`/
`window_index`/`total_windows`). An overall bar (`current_candidate / total_candidates`) plus
the inner window phase. Cancel button → cancel endpoint. Handle the backend-restart case
(status from DB, no live inner progress) gracefully.

### 5. Results — the leaderboard (the payoff)

`src/components/discover/LeaderboardTable.tsx` + `DiscoverResultsPanel.tsx`:

- **Sortable leaderboard table:** rank, strategy, OOS objective value, efficiency ratio, OOS
  trade count, and a **gate badge** (passed / flagged — show the `gate_flags` on hover).
  Passing candidates first (by rank), gated/`no_result`/`unsupported`/`error` candidates
  visibly de-emphasized below. Make the OOS-vs-IS framing explicit in the column header
  ("ranked on out-of-sample") so nobody mistakes it for in-sample.
- **Row expansion → per-candidate walk-forward detail:** fetch that candidate's equity
  artifact and render the stitched OOS curve + an IS-vs-OOS view by **reusing
  `WalkForwardResultsView` / `IsOosComparisonChart`** against the candidate's
  `oos_metrics` / `is_metrics_summary` / `best_params`. A `no_result`/`error` row expands to
  its reason, not a chart.
- **Promote actions** per row: "Send to Backtest" and "Send to Optimizer" — assemble the
  config from the candidate's strategy + `best_params` (+ the search's instrument/range),
  set `pendingBacktestConfig` / `pendingOptimizationConfig` via the store, and switch the
  active workspace. Confirm the receiving workspace hydrates from the pending config (it
  already does for the optimize→backtest path — follow that wiring).
- A prominent **"best strategy"** headline card above the table (winner's name + OOS
  objective + efficiency + a one-line honest gloss).

### 6. History panel — `src/components/discover/DiscoverHistoryPanel.tsx`

List past searches (status, symbol, candidate count, best strategy, best OOS objective,
created_at); open one to re-render the leaderboard (results endpoint + lake-backed
per-candidate equity); delete with confirm. Mirror `WalkForwardHistoryPanel`.

### 7. Tests

`pnpm test:run` additions (Vitest + MSW, follow the existing layout under `tests/`):

- Form: candidate-count + window-count hints; `min_windows` warning; multi-select default-all
  and the assembled request body matches WO32's contract; tick strategies disabled.
- Status polling renders candidate/window progress; terminal status stops polling.
- Leaderboard: rows render in OOS-rank order; gated/`no_result` rows styled and sorted below;
  gate badge + flags; efficiency/null formatting; row expansion fires the per-candidate
  equity query.
- Promote: "Send to Backtest" sets `pendingBacktestConfig` with the candidate's
  strategy+params and switches workspace.
- History: list renders; open → results query fired with run id.

---

## Definition of done

- `pnpm test:run` and the lint/typecheck scripts pass. **Do not report completion until they
  do.**
- No existing workspace/route behavior changes; walk-forward + optimize components reused, not
  forked (note any additive prop you added to a shared component).
- In your final message: confirm the manual smoke path if you ran it — backend up → open
  Discover → launch a 2-strategy search on a real instrument → watch the leaderboard populate
  → expand the winner → "Send to Backtest" hydrates the Backtest workspace.

## Out of scope

- Backend changes of any kind (contract gaps go back as WO32 follow-ups — note them).
- A "compare two candidates side by side" view (nice follow-up; the existing run-comparison
  workspace WO26 can absorb it later — note it, skip it).
- Tick-engine search UI; genetic-search UI (WO34 design).
- Parameter-stability heatmaps / deflated-Sharpe display (later in this phase).
