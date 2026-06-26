# WO140 — Frontend: Feature Scoring dashboard

## Shared context (read first)

Two-repo project on Windows. Frontend `q_frontend` uses `pnpm` (`pnpm test:run`, `pnpm typecheck`,
`pnpm lint`, `pnpm build`) — never npm/yarn. Read `docs/design/feature-intelligence.md`. Depends on
**WO137** (`useFeatureEvalRun`, `useFeatureLeaderboard`, types + mocks). Renders the **Feature
Scoring** tab. Backend data: **WO135** (`GET /feature-eval/{id}`, `GET /features/leaderboard`).

**Principle:** the evaluation results dashboard — leaderboard, metric heatmap, stability over time,
correlation clusters, recommended sets, and the weak/redundant list — rendered in **our own chart
stack** (recharts, as established by WO113–115), live-refreshing while a run is in progress.

## How the pieces work today (read these files)

- `src/components/optimize/OptimizationAnalyticsTab.tsx` — **the direct template**: a tabbed analytics
  surface that calls a polling analytics query (`useOptimizationAnalytics(studyId, { isRunning })`),
  handles loading/error, and composes panels. Model the Scoring dashboard on this.
- `src/components/optimize/ParamImportancePanel.tsx`, `ParallelCoordinatePanel.tsx`,
  `ParetoFrontPanel.tsx` — recharts panels reading plain JSON datasets. **Reuse their chart idioms;
  the metric heatmap and stability lines are the same class of component.**
- `src/api/queries/features.ts` (WO137) — `useFeatureEvalRun(runId, { isRunning })`,
  `useFeatureLeaderboard()`; `src/types/features.ts` — `FeatureEvalRun` (status + `leaderboard[]` +
  `clusters[]` + `heatmap`), `FeatureScoreRow`.
- `src/components/ui/` — `Panel`, `SectionHeader`, `StatTile`, `SegmentedToggle`, `FilterPills`.

## Tasks

### 1. Dashboard shell — `src/components/research/FeatureScoringDashboard.tsx`

- Takes a `runId` (from Feature Lab / the latest run; if none, show a "run an evaluation" empty state
  pointing at the Feature Lab tab). Calls `useFeatureEvalRun(runId, { isRunning })`; reuse the
  loading/error pattern from `OptimizationAnalyticsTab`. **Live:** while `status === 'running'`,
  partial datasets render and refresh (poll), exactly as the optimization analytics does.

### 2. Panels (recharts, our stack)

- **Leaderboard** (`FeatureLeaderboardPanel`): score-sorted `FeatureScoreRow`s with `global_score`,
  `rank_ic`, `stability`, cluster id, representative marker, leakage badge. Click a row → opens that
  feature's Passport (reuse WO139 via the workspace's selection state).
- **Metric heatmap** (`FeatureMetricHeatmap`): feature × metric (ic / rank_ic / mutual_info /
  stability) colored cells (diverging scale centered at 0 for IC). Recharts/SVG grid like the existing
  chart layers.
- **Stability over time** (`FeatureStabilityPanel`): per-feature window rank_ic line(s) so a
  regime-only feature visibly degrades across windows.
- **Correlation clusters** (`RedundancyClusterPanel`): clusters as grouped chips/cards; the
  representative highlighted. A simple cluster list is sufficient — no force-graph required for v1.
- **Recommended set** + **Weak/redundant**: two `Panel`s — the `recommended_feature_set` (one per
  cluster, diverse) and the low-score / down-weighted features.

### 3. Top stat row + run picker

- `StatTile`s: features evaluated, target + horizon, # clusters, top score. A small run picker
  (`SegmentedToggle` or select) to switch between recent eval runs (`useFeatureLeaderboard` for the
  latest-per-feature view, the run query for a specific run).

## Guardrails

> **Our chart stack.** recharts / the existing `src/components/charts` layers — **no Plotly**, no new
> heavy charting dep (consistent with WO113–115).
> **Live partials.** A running evaluation shows whatever datasets exist and refreshes; never block the
> whole dashboard on a finished run.
> **Leakage + redundancy honest.** Suspect features carry the badge in the leaderboard; redundant
> features are visibly grouped and the recommended set never lists two from one cluster.
> **Design system only** for chrome; charts use the shared chart primitives.

## Tests

- `src/components/research/__tests__/FeatureScoringDashboard.test.tsx` (MSW fixtures):
  - renders leaderboard sorted by `global_score`; a suspect fixture shows the badge.
  - heatmap renders a cell per feature×metric; clusters render with the representative marked; the
    recommended set contains no two members of the same cluster.
  - a `status: 'running'` fixture renders partial panels (does not show the error/empty state).
  - empty `runId` shows the "run an evaluation" pointer to Feature Lab.

## Docs

- `docs/design/feature-intelligence.md`: tick the Scoring dashboard landed; note it reuses the
  WO113–115 recharts idioms.

## Definition of done

- `pnpm typecheck && pnpm lint && pnpm test:run` pass; `pnpm build` succeeds — **do not report
  completion until they do.**
- Paste-in-final-message: confirmation the dashboard renders leaderboard + heatmap + clusters +
  recommended set, refreshes live while running, and the recommended set is one-per-cluster.

## Out of scope

- Kicking off an evaluation run / configuring it — **WO141** (Feature Lab).
- The Passport panel itself — **WO139** (reused here for row drill-in).
