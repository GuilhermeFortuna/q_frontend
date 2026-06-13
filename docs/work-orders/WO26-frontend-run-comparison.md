# WO26 — Frontend: backtest run comparison (overlaid equity curves + metrics grid)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck/lint: `pnpm lint` (check `package.json` for exact names)

**Context for this work:** this batch ("Research Validation") turns the platform into a
research instrument. WO22 gave every completed backtest run durable Parquet artifacts and
two read endpoints:

```
GET /api/v1/backtests/{run_id}/artifacts/equity → {"run_id", "points": [{"time", "equity"}, ...]}
GET /api/v1/backtests/{run_id}/artifacts/trades → {"run_id", "trades": [...]}
```

(Exact shapes are pasted in WO22's completion message — build against that.) Until now the
history panel could only re-open one run at a time; the core research question — _"is
strategy B actually better than strategy A on this instrument?"_ — required eyeballing two
screens. This work order adds side-by-side comparison of saved runs. It is **frontend
only** and depends on WO22's endpoints (runs created before WO22 return 404 for artifacts —
handle it, don't crash).

---

## How the frontend works today (read these files)

- `src/workspaces/backtests/BacktestsWorkspace.tsx` — the host workspace.
- `src/components/backtests/BacktestHistoryPanel.tsx` + `BacktestHistoryFilters.tsx` —
  the history list: row layout, selection/open behavior, the existing bulk-delete
  checkbox mechanics (if bulk-select already exists, **extend that selection state** for
  compare rather than adding a second checkbox column).
- `src/components/backtests/EquityCurveChart.tsx` + `chartUtils.ts` — the single-run
  equity chart; see what charting primitive it wraps before deciding how to render
  multiple series.
- `src/api/queries/backtests.ts` — query patterns; `src/types/backtesting.ts` — run/
  result types. `src/mocks/` — MSW handlers for tests.
- `src/components/backtests/BacktestMetricsBar.tsx` — the metric names/formatting to keep
  consistent in the comparison grid (`src/lib/backtesting/performance.ts` for formatters).

---

## Goal

Select 2–5 runs in the backtest history panel → **Compare** → one view with all equity
curves overlaid on a shared time axis and a metrics grid with one column per run,
best-in-row highlighted.

## Tasks

### 1. API layer

`src/api/queries/backtests.ts` (or a sibling): `useBacktestEquityArtifact(runId)` against
the WO22 equity endpoint, plus a helper to fetch several run ids in parallel
(`useQueries`). A 404 (pre-WO22 run) resolves to an "artifact unavailable" state per run —
not an error wall for the whole comparison. MSW handlers added.

### 2. Compare selection in the history panel

- Multi-select in `BacktestHistoryPanel` (reuse/extend the bulk-delete selection if
  present). A **Compare (n)** button enables at 2 ≤ n ≤ 5; beyond 5, oldest-selected drops
  or selection is blocked with a hint — your call, document it in the panel.
- Selection state lives in the workspace (or its store slice), not duplicated per row.

### 3. Comparison view — `src/components/backtests/RunComparisonView.tsx`

Rendered within the backtests workspace (panel/drawer/route-state — match how the
workspace already switches between form and results; do not add a global route unless the
workspace pattern demands it).

- **Overlaid equity chart**: one colored series per run (stable, legible palette from the
  design tokens in `src/styles/globals.css`), shared time axis spanning the union of
  ranges, legend mapping color → run label (`strategy · symbol · timeframe · created date`
  — runs may share a strategy, so include enough to disambiguate). Toggle a series by
  clicking its legend entry. **Normalize toggle:** absolute equity vs % return from each
  run's starting capital (essential when initial capitals differ — default to % when they
  do).
- **Metrics grid**: rows = the metrics `BacktestMetricsBar` shows (net profit, win rate,
  profit factor, max drawdown, Sharpe, trades, …) sourced from each run's
  `result_summary` (already in the history list payload — no extra fetch); columns = runs.
  Highlight the best value per row (mind direction: max drawdown wants the smallest
  magnitude). Reuse the formatters from `src/lib/backtesting/performance.ts`.
- Runs whose equity artifact 404'd still get their metrics column, with the chart legend
  marking "no curve (pre-artifact run)".

### 4. Tests

- Selection: compare button enables at 2, caps at 5.
- Comparison view: N mocked runs render N series + N metric columns; best-per-row
  highlight respects metric direction (drawdown vs profit).
- Normalization math: % series starts at 0 for each run regardless of capital.
- A 404 artifact yields the degraded state, others still render.

---

## Definition of done

- `pnpm test:run` and the lint/typecheck scripts pass. **Do not report completion until
  they do.**
- Single-run history open/delete behavior unchanged.
- In your final message: note where selection state lives and any follow-up worth a WO
  (e.g. comparing walk-forward runs, trade-level diff).

## Out of scope

- Backend changes (WO22 is the contract; gaps go back as follow-ups).
- Comparing optimization studies or walk-forward runs (this WO is backtest runs only;
  the walk-forward equity artifact shares the same JSON shape, so extending later is easy).
- Trade-level comparison, statistical tests on curve differences (later phase).
- PDF/report export of comparisons.
