# WO113 — Backend: Optuna-derived optimization analytics service + endpoint

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/optimization-analytics.md` (the whole doc — it sets the live-vs-end-of-run rule
and the multi-objective per-target rule). This WO has **no dependencies**; WO114/WO115 (frontend)
depend on it.

**Principle:** Optuna computes, we serve JSON. No Plotly. We expose Optuna's _data_
(`get_param_importances`, completed-trial rows, `best_trials`) for our own charts to render.

## How the pieces work today (read these files)

- `src/q_backend/optimization/storage.py` — `load_or_create_study(config, ...)` returns a live
  `optuna.Study` from the `optuna` Postgres schema (`load_if_exists=True`). **This is how we get a
  real `optuna.Study` for the importance evaluators.**
- `src/q_backend/api/optimization_jobs.py`
  - `results_payload_from_db(study_id)` (line ~794) — the canonical reload pattern: parse uuid,
    `get_optimization_study(session, uuid)`, strip `config["persisted_snapshot"]`, then
    `OptimizationConfig.model_validate(config_for_validation)`. **Copy this reload shape.**
  - `get_job(study_id)` / `results_payload(job)` (line ~758) — in-memory job path; `job.config` is a
    live `OptimizationConfig`, `job.status`, `job.result.study` is the running optuna study.
  - `get_persisted_study_status(study_id)` (line ~778) — returns `study.status`
    (`pending|running|done|cancelled|error`).
  - `_parse_study_uuid` — uuid parsing/validation used above.
- `src/q_backend/optimization/exporter.py` — `serialize_trial(FrozenTrial)` (the trial shape the
  frontend already consumes) and the `study.trials_dataframe()` usage.
- `src/q_backend/optimization/models.py` — `OptimizationConfig.is_multi_objective()`,
  `optuna_directions()`, `objective.mode`.
- `src/q_backend/api/routers/optimization.py` — `get_optimization_results` (line ~62) is the sibling
  endpoint to model the new one on (job-first, then DB fallback, with 404/409 semantics).
- `src/q_backend/api/schemas/` — response schema modules (see how `OptimizationResultsResponse` is
  defined and imported into the router).

## Goal

One state-aware endpoint returns the three analytics datasets; while the study runs it returns the
two live ones and a `null` importance.

```jsonc
// GET /api/v1/optimize/{study_id}/analytics
{
  "study_id": "…",
  "status": "running", // running | done | cancelled | error
  "is_multi_objective": true,
  "n_complete_trials": 142,
  "objective_labels": ["return", "drawdown"], // 1 entry for single-objective
  "param_importances": null, // null while running / < MIN_TRIALS; else per-target
  "parallel_coordinate": {
    "params": ["short_period", "long_period", "atr_mult"],
    "objectives": ["return", "drawdown"],
    "rows": [
      {
        "number": 12,
        "params": { "short_period": 10, "long_period": 30, "atr_mult": 2.0 },
        "values": [0.34, -0.12],
      },
    ],
  },
  "pareto_front": {
    "is_multi_objective": true,
    "objectives": ["return", "drawdown"],
    "points": [
      {
        "number": 88,
        "values": [0.41, -0.08],
        "params": {
          /* … */
        },
      },
    ],
  },
}
```

When finished, `param_importances` is e.g.
`{ "return": [ {"param": "short_period", "importance": 0.62}, … ], "drawdown": [ … ] }`
(sorted desc, one list per objective target).

## Tasks

### 1. Analytics service — new `src/q_backend/optimization/analytics.py`

```python
def compute_study_analytics(
    study: optuna.Study,
    config: OptimizationConfig,
    *,
    is_running: bool,
) -> dict[str, Any]:
    ...
```

- **Completed trials only** for every dataset: filter `study.trials` to
  `state == TrialState.COMPLETE` (skip pruned/failed/running). Define
  `n_complete = len(complete_trials)`.
- **parallel_coordinate:** union of param names across completed trials (stable sorted), objective
  labels from `objective_labels(config)` (helper below). `rows[i].values` is the trial's
  `values` (multi) or `[value]` (single). Cap rows at **MAX_PCP_ROWS = 2000** (most recent by
  number) to keep payloads sane on huge studies — note the cap in the response if applied.
- **pareto_front:** if `config.is_multi_objective()` → `study.best_trials` → points with `values`
  - `params`. Else → single best trial (by direction) as the only point; `is_multi_objective:false`.
- **param_importances:** if `is_running` **or** `n_complete < MIN_TRIALS (=30)` → return `None`.
  Else compute per target:
  - single-objective: `optuna.importance.get_param_importances(study)` → one list under the
    objective label.
  - multi-objective: for each objective index `i`, call
    `get_param_importances(study, target=lambda t, i=i: t.values[i])`; key by objective label.
  - Each list = `[{"param": k, "importance": float(v)}, …]` sorted desc. Wrap the whole importance
    block in try/except → on `RuntimeError`/insufficient-data return `None` (never 500 the endpoint
    because fANOVA was unhappy).
- Add `objective_labels(config) -> list[str]`: `["return", "drawdown"]` for the multi mode, else a
  single label derived from `objective.mode` (e.g. `[config.objective.mode.value]`). Keep it the one
  source of truth used by all three datasets.

### 2. Reload helpers — `analytics_payload(study_id)` in `api/optimization_jobs.py`

Add two functions next to the results ones:

- `analytics_payload(job: OptimizationJob) -> Optional[dict]` — uses `job.result.study` if present,
  else `load_or_create_study(job.config)`; `is_running = job.status not in TERMINAL`.
- `analytics_payload_from_db(study_id) -> Optional[dict]` — mirror `results_payload_from_db`'s reload
  (uuid parse, load study row, strip `persisted_snapshot`, `OptimizationConfig.model_validate`), then
  `load_or_create_study(opt_config)` and `compute_study_analytics(study, opt_config, is_running=False)`.
  Return `None` if the study row is missing.
- Both wrap `compute_study_analytics` and add the envelope fields (`study_id`, `status`,
  `is_multi_objective`, `n_complete_trials`, `objective_labels`).

> **Reload safety:** `load_or_create_study` must use `load_if_exists=True` and **must not** start new
> trials or mutate the study. Confirm it only reads. Do not pass a budget. If reload raises (study not
> in optuna schema yet — e.g. status `pending`), log + return a payload with empty datasets and
> `status` from the DB, not a 500.

### 3. Importance cache

Cache the _importance block only_ (the expensive part) keyed by `(study_id, n_complete_trials)` — a
module-level dict or `functools.lru_cache` on a helper taking those two keys. Parallel-coordinate and
pareto are cheap reads; recompute them every call so live polling stays fresh. Document the cache key
in a comment.

### 4. Endpoint — `api/routers/optimization.py`

```python
@router.get(
    "/api/v1/optimize/{study_id}/analytics",
    response_model=OptimizationAnalyticsResponse,
)
def get_optimization_analytics(study_id: str):
    job = optimization_jobs.get_job(study_id)
    if job is not None:
        payload = optimization_jobs.analytics_payload(job)
        if payload is not None:
            return payload
    payload = optimization_jobs.analytics_payload_from_db(study_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"Study '{study_id}' not found.")
    return payload
```

Unlike `/results`, **do not 409 while running** — partial analytics are the whole point.

### 5. Schema — `api/schemas/…`

Add `OptimizationAnalyticsResponse` and nested models (`ParamImportanceEntry`,
`ParallelCoordinatePayload`, `ParallelCoordinateRow`, `ParetoFrontPayload`, `ParetoPoint`) matching
the JSON above. `param_importances: Optional[dict[str, list[ParamImportanceEntry]]]`. Export it
wherever the sibling `OptimizationResultsResponse` is exported and import into the router.

## Guardrails

> **Read-only.** This endpoint never creates trials, never writes to the optuna study, never mutates
> the app DB. It only loads + computes.
> **Never 500 on analytics-specific failure.** fANOVA insufficient data, a study still `pending`, or
> a reload miss must degrade to `null`/empty datasets with a valid `status`, not an exception.
> **One study load per request.** Don't reload the optuna study more than once per call.
> **Determinism not required** (fANOVA has its own internals), but completed-trial filtering and row
> ordering (by trial `number`) must be stable.

## Tests

- `tests/optimization/test_analytics.py` (unit, in-memory study — build a small optuna study with
  known trials):
  - single-objective: `param_importances` is `None` below MIN_TRIALS, a sorted non-empty per-label
    list at/above it; `parallel_coordinate.rows` has one row per COMPLETE trial; pruned/failed
    trials excluded.
  - multi-objective (return/drawdown): `pareto_front.is_multi_objective` is `true`,
    `points` ⊆ completed trials and is the non-dominated set; `param_importances` has both objective
    labels as keys.
  - fANOVA failure path: monkeypatch `get_param_importances` to raise → service returns
    `param_importances: None`, no exception.
- `tests/api/test_optimization_analytics_endpoint.py`:
  - 404 for unknown study id.
  - a finished persisted study returns all three datasets (importance non-null).
  - a `running` study returns `parallel_coordinate` + `pareto_front` populated and
    `param_importances` `null` (does **not** 409).

## Docs

- `docs/design/optimization-analytics.md`: tick that the backend service + endpoint landed (no new
  doc).

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the exact `GET …/analytics` JSON for one finished multi-objective study
  and one running study, and confirmation the running case returns `param_importances: null` without
  a 409.

## Out of scope

- All rendering — **WO114** (Pareto + parallel coordinate, live) and **WO115** (param importance).
- Slice/contour/EDF — not in v1 (see design doc "Deferred").
