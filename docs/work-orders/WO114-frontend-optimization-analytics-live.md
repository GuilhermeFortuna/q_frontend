# WO114 — Frontend: Analytics tab + Pareto front + parallel coordinate (live)

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.
- (`pnpm test` is watch mode — use `pnpm test:run`.)

Read `docs/design/optimization-analytics.md` (**Live vs end-of-run** + **Frontend** sections).
Depends on **WO113** (`GET /api/v1/optimize/{study_id}/analytics`). Sibling **WO115** adds the param
importance panel to the same tab — leave a slot for it.

**Principle:** render Optuna's _data_ in our own chart stack. Pareto = recharts (matches
`OptimizationScatter`). Parallel coordinate = visx (`@visx/scale` + `@visx/shape` LinePath), since
recharts has no PCP. No Plotly.

## How the pieces work today (read these files)

- `src/components/optimize/OptimizationResultsTabs.tsx` — the tab host. `TabId` union +
  `TABS` array (`overview|chart|terrain|trials|logs`), the tab-button row, and the body switch.
  **Add an `analytics` tab here.** Note it receives `statusLabel` and `results` already.
- `src/components/optimize/OptimizationScatter.tsx` — the recharts idiom to copy (ResponsiveContainer,
  CHART_COLORS from `@/components/backtests/chartUtils`, `CHART_MIN_HEIGHT_PX`, selected-trial
  highlight via `Cell`).
- `src/api/queries/optimize.ts` — query module. `optimizeKeys` factory, `fetchOptimizationResults`,
  and the `results(studyId)` key. **Add the analytics query + key here.**
- `src/types/optimization.ts` — `OptimizationResults`, `OptimizationTrial`, `JobStatus`. **Add the
  analytics types here**, mirroring the WO113 JSON.
- The component that renders `OptimizationResultsTabs` and knows the live `status` (search for
  `useOptimizationStatus` / where `OptimizationResultsTabs` is mounted, likely
  `OptimizationResultsPanel.tsx` / `OptimizationWorkbench.tsx`) — it must pass `status` down so the
  query can poll while running.
- `package.json` already has `@visx/scale`, `@visx/shape`, `@visx/axis`, `@visx/group`,
  `@visx/responsive`, `@visx/tooltip`, `d3` — use them; **add no new deps.**

## Goal

A new **Analytics** tab that, while a study runs, animates the Pareto frontier and parallel-coordinate
plot from completed trials so far, then settles when finished.

```
OptimizationResultsTabs:  Overview | Chart | 3D Landscape | Trials | Analytics | Logs
                                                                      └─────────┐
  ParetoFrontPanel            ParallelCoordinatePanel          (ParamImportancePanel → WO115)
  recharts scatter,           visx polylines, one per trial,
  non-dominated highlighted   axis per param + objective
```

## Tasks

### 1. Types — `src/types/optimization.ts`

Add (mirror WO113 response exactly):

```ts
export type ParamImportanceEntry = { param: string; importance: number }
export type ParallelCoordinateRow = {
  number: number
  params: Record<string, number | string>
  values: number[]
}
export type ParallelCoordinatePayload = {
  params: string[]
  objectives: string[]
  rows: ParallelCoordinateRow[]
}
export type ParetoPoint = {
  number: number
  values: number[]
  params: Record<string, number | string>
}
export type ParetoFrontPayload = {
  is_multi_objective: boolean
  objectives: string[]
  points: ParetoPoint[]
}
export type OptimizationAnalytics = {
  study_id: string
  status: JobStatus
  is_multi_objective: boolean
  n_complete_trials: number
  objective_labels: string[]
  param_importances: Record<string, ParamImportanceEntry[]> | null
  parallel_coordinate: ParallelCoordinatePayload
  pareto_front: ParetoFrontPayload
}
```

### 2. Query — `src/api/queries/optimize.ts`

- `optimizeKeys.analytics = (studyId) => [...optimizeKeys.all, 'analytics', studyId] as const`.
- `fetchOptimizationAnalytics(studyId): Promise<OptimizationAnalytics>` → GET
  `/api/v1/optimize/${studyId}/analytics`.
- `useOptimizationAnalytics(studyId, { isRunning }: { isRunning: boolean })`:
  - `enabled: !!studyId`
  - `refetchInterval: isRunning ? 2500 : false` — **poll only while running**, stop when terminal.
  - `staleTime` small (0–1s) so live data refreshes.

`isRunning` = `status === 'running' || status === 'pending'`. Derive from the status the parent
already has; do not add a second status poll.

### 3. Tab wiring — `OptimizationResultsTabs.tsx`

- Extend `TabId` with `'analytics'` and add `{ id: 'analytics', label: 'Analytics' }` to `TABS`
  (place it after `trials`, before `logs`).
- In the body switch, render `<OptimizationAnalyticsTab studyId={results.study_id} status={…} />`.
  The tab needs the live `status`; thread it in as a prop from the parent (Task 5) — or read it from
  the same status query the panel uses. Keep `OptimizationResultsTabs` presentational.

### 4. New components — `src/components/optimize/`

- `OptimizationAnalyticsTab.tsx` — calls `useOptimizationAnalytics`, lays out the three panels in a
  responsive grid, and shows a subtle "Live · N trials" badge while running (use `n_complete_trials`).
  Renders `ParamImportancePanel` as a placeholder slot now; WO115 fills it.
- `ParetoFrontPanel.tsx` — recharts `ScatterChart` over `pareto_front`.
  - Multi-objective: x = `objectives[0]`, y = `objectives[1]`, plot all completed trials faintly +
    overlay `pareto_front.points` as the highlighted frontier (sorted by x so a connecting line reads
    as a frontier). Reuse `CHART_COLORS`, `CHART_MIN_HEIGHT_PX`, tooltip showing trial `number` +
    values. Clicking a point calls an optional `onSelectTrial`.
  - Single-objective (`is_multi_objective === false`): render value-vs-trial-number with the best
    point highlighted (don't pretend there's a frontier). Show a one-line caption explaining this.
- `ParallelCoordinatePanel.tsx` — visx. One vertical axis per entry in `[...params, ...objectives]`;
  each trial = a `LinePath` across axes. Use `@visx/scale` (`scaleLinear` per numeric axis,
  `scalePoint` for the axis positions; `scaleBand`/categorical handling for string params), `@visx/axis`
  `AxisLeft` per dimension, `@visx/group`, `@visx/responsive` ParentSize. Color lines by the primary
  objective value (d3 sequential scale) so good/bad regions read at a glance. Cap rendered lines at
  the payload's rows (already capped server-side); keep stroke opacity low (~0.25) for density.

> **Perf:** these mount inside a polling tab. Memoize derived scales/series with `useMemo` keyed on
> the payload identity; do not recompute on every render. The PCP can get heavy — if `rows.length`
> is large, draw with a single memoized array of `LinePath`s, not nested components per point. (See
> [[ui-performance-batch]] lessons: avoid per-row React nodes in hot charts.)

### 5. Thread `status` to the tab — parent panel

In whichever component mounts `OptimizationResultsTabs` (e.g. `OptimizationResultsPanel.tsx`), pass
the current `status` down so the Analytics tab knows whether to poll. The parent already has it (it
chooses `statusLabel`). Add a `status: JobStatus` prop to `OptimizationResultsTabs` and forward it.

## Guardrails

> **No new dependencies** — visx + d3 + recharts are already installed. **Do not add Plotly.**
> **Polling must stop** when status is terminal (`done|error|cancelled`) — verify `refetchInterval`
> becomes `false`. A finished study must make exactly the queries it needs, then go quiet.
> **Empty/early state:** while `n_complete_trials` is 0–few, panels must render an empty/loading
> state, never crash on empty `rows`/`points`.
> Param importance panel content is **WO115** — only leave its slot here.

## Tests

- `src/components/optimize/__tests__/ParetoFrontPanel.test.tsx`: multi-objective payload → frontier
  points highlighted; single-objective payload → best-point highlight, no frontier line. Empty
  points → empty state, no throw.
- `src/components/optimize/__tests__/ParallelCoordinatePanel.test.tsx`: renders one line per row;
  handles a categorical param axis; empty rows → empty state.
- `src/api/queries/__tests__/optimize.analytics.test.ts` (or extend existing): `refetchInterval` is a
  number when `isRunning`, `false` otherwise.

## Docs

- `docs/design/optimization-analytics.md`: tick that the live Analytics tab landed.

## Definition of done

- `pnpm test:run` green, `pnpm exec tsc -p tsconfig.app.json --noEmit` clean, `pnpm build` succeeds —
  **do not report completion until all three pass.**
- Paste-in-final-message: confirm (a) the Analytics tab appears between Trials and Logs, (b) polling
  stops on a finished study, (c) a screenshot/description of the Pareto + PCP panels on a multi-
  objective run.

## Out of scope

- Param importance panel — **WO115**.
- Backend endpoint — **WO113**.
- Slice/contour/EDF — not in v1.
