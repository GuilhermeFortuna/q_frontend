# WO141 — Frontend: Feature Lab (interactive evaluation + set comparison)

## Shared context (read first)

Two-repo project on Windows. Frontend `q_frontend` uses `pnpm` (`pnpm test:run`, `pnpm typecheck`,
`pnpm lint`, `pnpm build`) — never npm/yarn. Read `docs/design/feature-intelligence.md`. Depends on
**WO137** (`useStartFeatureEval`, types, mocks) + **WO140** (the Scoring dashboard it routes results
into). Renders the **Feature Lab** tab and **closes the Research frontend batch (WO137–141)**. Backend:
**WO135** (`POST /api/v1/feature-eval`).

**Principle:** the interactive bench — pick a symbol, timeframe, feature set, prediction target, and
evaluation window; kick an evaluation; and compare feature sets. It's the front door that produces the
runs WO140 visualizes.

## How the pieces work today (read these files)

- `src/api/queries/features.ts` (WO137) — `useStartFeatureEval()` (→ `POST /api/v1/feature-eval`,
  returns `{ run_id, status }`), `useFeatureList()` (to pick features), `useFeatureEvalRun(runId,
{ isRunning })`. `src/types/features.ts` — `EvalRunRequest` (`symbol`, `timeframe`, `start`, `end`,
  `target: { name, horizon }`, `features: FeatureRequest[]`).
- `src/components/research/FeatureScoringDashboard.tsx` (WO140) — where a finished/running `runId` is
  shown; the Lab hands its `run_id` to the Scoring tab.
- Symbol/timeframe/date pickers already exist for backtests/optimize — **reuse them**
  (search `src/components/backtests` + `src/workspaces/backtests` for the instrument/timeframe/date
  controls; do not build new ones). `src/components/ui/` — `Panel`, `LabeledField`, `RangeChips`/
  `RangeInput` (eval window), `FilterPills` (feature multiselect), `SegmentedToggle`, `Button`,
  `NumberInput` (horizon).

## Tasks

### 1. Config form — `src/components/research/FeatureLab.tsx`

- **Symbol** + **Timeframe**: reuse the existing backtests/optimize pickers.
- **Feature set**: multiselect over `useFeatureList()` (grouped by category; "select all in category",
  "recommended only" using the latest leaderboard's recommended set). Builds `features:
FeatureRequest[]` (name + version + params; default params unless the user overrides).
- **Prediction target**: a select over the target family (`fwd_return`, `fwd_log_return`,
  `fwd_vol_adj_return`, `fwd_direction`) + a `NumberInput` horizon (bars).
- **Evaluation window**: date range / `RangeChips` for start–end.
- Validate the form (≥1 feature, valid window, horizon ≥ 1) before enabling **Evaluate Features**.

### 2. Actions

- **Evaluate Features**: `useStartFeatureEval(request)` → on success, switch to the Feature Scoring tab
  with the returned `run_id` (live results stream there). Disable + spinner while pending.
- **Compare Feature Sets**: let the user save the current config as "Set A" / "Set B", run both, and
  show their leaderboards side-by-side (two `FeatureScoringDashboard`s in a compare layout, or a merged
  delta table of `global_score` per feature). Keep v1 to two sets.
- **Discover Similar Historical Regimes** and **Train Autoencoder/Transformer** from the roadmap are
  **out of scope** (neural phases deferred) — do not add buttons that 404.

### 3. Recent runs

- A small list of recent eval runs (from `useFeatureLeaderboard`/a runs query) so the user can reopen a
  prior run in the Scoring tab without re-running.

## Guardrails

> **Reuse pickers.** Symbol/timeframe/date controls come from the existing backtests/optimize
> components — no new instrument pickers.
> **No dead actions.** Only wire buttons whose backend exists (WO135). Neural/regime-similarity actions
> are omitted, not stubbed to a 404.
> **Validated before submit.** Don't POST an empty feature set or an invalid window/horizon.
> **Hand off, don't duplicate.** The Lab produces a `run_id`; visualization lives in WO140 — the Lab
> does not re-implement the leaderboard.

## Tests

- `src/components/research/__tests__/FeatureLab.test.tsx` (MSW fixtures):
  - the form disables **Evaluate** until a feature, target+horizon, and window are set.
  - submitting calls `useStartFeatureEval` with a correctly-shaped `EvalRunRequest` and routes to the
    Scoring tab with the returned `run_id`.
  - "recommended only" preselects exactly the leaderboard's recommended set.
  - Compare mode runs two sets and shows both leaderboards.

## Docs

- `docs/design/feature-intelligence.md`: tick Feature Lab landed; mark the Research frontend batch
  (WO137–141) complete; restate that Neural Features / regime-similarity remain deferred.

## Definition of done

- `pnpm typecheck && pnpm lint && pnpm test:run` pass; `pnpm build` succeeds with Research in its own
  chunk — **do not report completion until they do.**
- Paste-in-final-message: confirmation Evaluate posts a valid `EvalRunRequest` and lands on the live
  Scoring dashboard, and that no deferred (neural/regime) actions are wired.

## Out of scope

- Result visualization — **WO140**. Backend evaluation — **WO135**.
- Neural feature training + "similar historical regimes" — roadmap Phase 3/4, deferred.
