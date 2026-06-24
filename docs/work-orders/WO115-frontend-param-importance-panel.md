# WO115 — Frontend: param importance panel + pending/empty states (end-of-run)

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.
- (`pnpm test` is watch mode — use `pnpm test:run`.)

Read `docs/design/optimization-analytics.md` (**Live vs end-of-run** + **Multi-objective note**).
Depends on **WO113** (`param_importances` in the analytics payload) and **WO114**
(`OptimizationAnalyticsTab` + `OptimizationAnalytics` types + the empty slot this WO fills).

**Principle:** render Optuna's fANOVA _numbers_ as a plain recharts bar chart in our aesthetic. No
Plotly.

## How the pieces work today (read these files)

- `src/components/optimize/OptimizationAnalyticsTab.tsx` (from WO114) — already calls
  `useOptimizationAnalytics` and leaves a placeholder slot for `ParamImportancePanel`. Fill it.
- `src/types/optimization.ts` — `ParamImportanceEntry`, `OptimizationAnalytics.param_importances`
  (`Record<string, ParamImportanceEntry[]> | null`) and `objective_labels` (added in WO114).
- `src/components/optimize/OptimizationScatter.tsx` — recharts idiom (ResponsiveContainer,
  `CHART_COLORS`, `CHART_MIN_HEIGHT_PX`, tooltip styling) to match.
- `src/components/optimize/BestParamsCard.tsx` — existing card/styling vocabulary (carbon/brass/
  silver classes) to stay visually consistent.

## Goal

A bar chart of parameter importances that is correct when finished, honest while running.

```
PARAM IMPORTANCE                         target: ( return ▾ )   // toggle only if multi-objective
  short_period   ███████████████ 0.62
  long_period    ████████ 0.31
  atr_mult       ██ 0.07
  ───
  While running → "Importance is computed once the search finishes (needs ≥ 30 trials)."
```

## Tasks

### 1. `ParamImportancePanel.tsx` — `src/components/optimize/`

Props: `{ analytics: OptimizationAnalytics }` (or just the fields it needs — `param_importances`,
`objective_labels`, `is_multi_objective`, `status`, `n_complete_trials`).

- **Pending state** (`param_importances === null`): render a muted explanatory card. Distinguish two
  reasons using `status` + `n_complete_trials`:
  - still running → "Importance is computed once the search finishes."
  - finished but `null` (too few trials / fANOVA failed) → "Not enough completed trials to rank
    importance (needs ≥ 30)." Keep copy in sync with WO113's `MIN_TRIALS`.
- **Loaded state:** horizontal recharts `BarChart`, one bar per `ParamImportanceEntry`, sorted desc
  (server already sorts — don't re-sort unless defensive). Bar labels = importance to 2 decimals.
  Use `CHART_COLORS`/brass accents, `CHART_MIN_HEIGHT_PX`, a tooltip with param + value.
- **Multi-objective target toggle:** when `is_multi_objective` and `param_importances` has multiple
  keys (`objective_labels`), render a small segmented control / select to pick which objective's
  importance to show (default `objective_labels[0]`). Single-objective → no toggle, just the one
  list. State is local to the panel.

### 2. Wire into the tab

Replace the WO114 placeholder slot in `OptimizationAnalyticsTab.tsx` with `<ParamImportancePanel … />`.
No layout rework beyond filling the slot.

## Guardrails

> **No new dependencies** (recharts already installed). **No Plotly.**
> **Honest pending copy:** never show a zeroed/empty bar chart as if importance were "all zero" —
> a `null` payload is a _pending/insufficient_ state, render the explanatory card instead.
> **Keep the MIN_TRIALS number in one mental place:** it lives in WO113's backend; the frontend copy
> just states "≥ 30". If WO113 changed it, match it.
> Per-target toggle is **local UI state only** — it must not trigger a refetch (the payload already
> carries all targets).

## Tests

- `src/components/optimize/__tests__/ParamImportancePanel.test.tsx`:
  - `param_importances: null` + `status: 'running'` → running-pending copy, no chart.
  - `param_importances: null` + terminal status → insufficient-trials copy.
  - populated single-objective → bars rendered, no target toggle.
  - populated multi-objective (two keys) → target toggle present; switching the toggle changes the
    rendered series **without** issuing a new query (assert no refetch / pure local state).

## Docs

- `docs/design/optimization-analytics.md`: tick that param importance landed — completing the v1 set.

## Definition of done

- `pnpm test:run` green, `pnpm exec tsc -p tsconfig.app.json --noEmit` clean, `pnpm build` succeeds —
  **do not report completion until all three pass.**
- Paste-in-final-message: confirm (a) running studies show the pending card, (b) a finished multi-
  objective study shows the bar chart with a working return/drawdown target toggle.

## Out of scope

- Backend importance computation/caching — **WO113**.
- Pareto + parallel coordinate + tab scaffold — **WO114**.
- Slice/contour/EDF — not in v1.
