# WO135 — Backend: Evaluation run persistence + leaderboard API

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/feature-intelligence.md`. Depends on **WO133** (metrics) + **WO134** (clusters/score)

- **WO130/131** (feature store DB + API). This is the orchestration + persistence WO for Phase 2 and
  backfills the Feature Passport's `score`/`evaluation_history`.

**Principle:** run the full evaluation for a `(symbol, timeframe, range, target, feature set)`, store
the scores + clusters, and serve the leaderboard / heatmap / cluster data the Feature Scoring
dashboard (later frontend batch) needs. The Passport's `score` becomes the latest `global_score`.

## How the pieces work today (read these files)

- `src/q_backend/features/matrix.py` (WO129), `targets.py` (WO132), `evaluation.py` (WO133),
  `scoring.py` (WO134) — the compute chain to orchestrate.
- `src/q_backend/storage/db/models.py` + `repositories.py` (WO130) — model + repo style;
  `increment_feature_usage`; the `StrategySearchRun`/`StrategySearchCandidate` run+children pattern is
  the template for `EvaluationRun`/`FeatureScoreRow`.
- `alembic/versions/` — add one new revision (don't edit existing).
- `src/q_backend/api/routers/features.py` + schemas (WO131) — extend the Passport here.
- `src/q_backend/api/routers/optimization.py` — router/run-trigger style.

## Goal

```python
# src/q_backend/features/evaluation_service.py
def run_evaluation(
    session, *, symbol, timeframe, start, end, target: TargetSpec, feature_set: list[FeatureRequest]
) -> EvaluationRun: ...   # builds matrix → evaluates → scores → persists
```

```
POST /api/v1/feature-eval                 → kick off a run, returns run id
GET  /api/v1/feature-eval/{run_id}        → status + leaderboard + clusters + heatmap data
GET  /api/v1/features/leaderboard         → latest global_score per feature (for the dashboard)
```

## Tasks

### 1. Models + migration

- `EvaluationRun` (UUID/Timestamp mixins): `symbol`, `timeframe`, `start`, `end`, `target_name`,
  `target_horizon`, `matrix_id` (FK-ish string to the lake matrix), `status` (reuse `RunStatus`),
  `feature_count`, `result_summary` (PortableJSON), `error_message`.
- `FeatureScoreRow`: `run_id` FK (CASCADE), `feature_id`, `feature_name`, `ic`, `rank_ic`,
  `mutual_info`, `stability`, `global_score`, `cluster_id`, `is_representative`, `leakage_status`,
  `regime_ics` (PortableJSON). UniqueConstraint(`run_id`, `feature_id`).
- One Alembic revision, down-revision = head.

### 2. Orchestration — `evaluation_service.py`

- `run_evaluation`: `build_feature_matrix` → `compute_target` → `evaluate_matrix` → `cluster_redundant`
  - `score_features` → persist `EvaluationRun` + `FeatureScoreRow`s. `result_summary` holds the
    recommended set + cluster count + top score.
- `increment_feature_usage` for each evaluated feature name (so usage reflects evaluation activity).
- Mirror the existing async/job pattern if discovery/optimization runs are backgrounded; if a simple
  synchronous run fits the test budget, that's acceptable for v1 — match whatever
  `StrategySearchRun` does.

### 3. API — extend `api/routers/features.py` (+ schemas)

- `POST /api/v1/feature-eval` — body `{symbol, timeframe, start, end, target:{name,horizon}, features:[…]}`
  → create run, return `{run_id, status}`.
- `GET /api/v1/feature-eval/{run_id}` — status + `leaderboard` (score-sorted `FeatureScoreRow`s) +
  `clusters` + `heatmap` (feature×metric grid: ic/rank_ic/mutual_info/stability per feature). 404 on
  unknown id.
- `GET /api/v1/features/leaderboard` — the latest `global_score` per feature across runs.

### 4. Backfill the Feature Passport (WO131)

- `GET /api/v1/features/{name}` now fills `score` (latest `global_score`) and `evaluation_history`
  (per-run `{run_id, target, rank_ic, global_score, evaluated_at}` desc). No schema change — WO131
  reserved those fields.

## Guardrails

> **Reproducible runs.** A run records its `matrix_id`; re-running the same inputs reuses the cached
> matrix (WO129) and produces the same scores. Store enough provenance to reproduce.
> **Leakage flags propagate.** `leakage_status` flows from WO133 into `FeatureScoreRow` and into the
> Passport — a suspect feature is visibly suspect in the leaderboard.
> **Migration only adds.** New tables; down-revision chained to head.
> **One matrix per run.** Don't rebuild the matrix per feature; build once, evaluate all.

## Tests

- `tests/features/test_evaluation_service.py`: `run_evaluation` on a small fixture persists one
  `EvaluationRun` + N `FeatureScoreRow`s; `result_summary` has the recommended set; usage counts bump.
- `tests/api/test_feature_eval_api.py`:
  - `POST /feature-eval` then `GET /feature-eval/{id}` returns a score-sorted leaderboard + clusters +
    heatmap; unknown id → 404.
  - `GET /features/leaderboard` returns latest score per feature.
  - after a run, `GET /features/rsi` Passport `score` is non-null and `evaluation_history` is non-empty.

## Docs

- `docs/design/feature-intelligence.md`: tick Phase 2 persistence/API complete; list the endpoints +
  the Passport backfill.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the `GET /feature-eval/{id}` leaderboard JSON for one real run and the now
  non-null `score` in the `GET /features/rsi` Passport.

## Out of scope

- Feeding scores into GA discovery's search space — **WO136**.
- The Feature Scoring frontend dashboard — later batch (this WO provides its data).
