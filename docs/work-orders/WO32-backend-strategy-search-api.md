# WO32 — Backend: strategy-search API, job lifecycle, and persistence

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** this batch ("Discovery") adds automatic strategy search. WO30
shipped registry→search-space derivation; WO31 shipped the compute core in
`src/q_backend/optimization/strategy_search.py`: `StrategySearchConfig`,
`StrategySearchRunner` (sweep registered strategies → per-candidate walk-forward →
OOS-ranked leaderboard), `CandidateResult`, `SearchProgress`. This WO exposes that over the
API with the **same job lifecycle as walk-forward** (WO24), persists run + per-candidate
leaderboard metadata to Postgres, and writes per-candidate OOS artifacts to the Parquet lake.
It is **backend only** — WO33 builds the frontend against the contracts you paste in your
completion message.

**Prerequisites shipped:** WO31 (search core), WO22 (lake module), WO23/WO24 (walk-forward
core + its job/persistence pattern).

---

## The template you are mirroring (read this first, copy its patterns)

This WO is deliberately a **near-clone of the walk-forward job plumbing**. Read it and mirror
it; do not invent new patterns.

- `src/q_backend/api/walkforward_jobs.py` — **the template in full.** Note: module docstring
  on the single-worker pool; `WalkForwardJob` dataclass + in-memory `_jobs` registry +
  `_lock` + `ThreadPoolExecutor(max_workers=1)`; `start_job` builds the runner **on the
  request thread** via `DefaultBacktestRunner.from_market_data_sliced` (line ~317) then
  submits `_run_job`; `_make_progress_cb` mirrors progress to Redis; `_persist_run_start /
_persist_run_status / _persist_run_finish` are best-effort try/except (compute never fails
  because storage is down); `status_payload` / `results_payload` for the live job and
  `status_payload_from_db` / `results_payload_from_db` for after a restart; `request_cancel`
  sets a cooperative flag; lake writers + an equity-artifact loader.
- `src/q_backend/api/main.py` — the walk-forward route block (search the file for
  `walkforward`): `POST /api/v1/walkforward`, `GET /api/v1/walkforward/{id}`,
  `GET .../{id}/results`, `POST .../{id}/cancel`, `GET /api/v1/walkforwards`,
  `DELETE /api/v1/walkforwards/{id}`, `GET .../{id}/artifacts/equity`. Flat `@app.get/post`
  style (no routers). Mirror it.
- `src/q_backend/storage/db/models.py` + `repositories.py` — `walkforward_runs` /
  `walkforward_windows` tables and their `create_*/update_*/get_*/list_*/delete_*` functions;
  `RunStatus` enum. `alembic/` holds the migration pattern.
- `src/q_backend/storage/lake/artifacts.py` — `write_walkforward_artifacts` /
  `read_walkforward_artifact` / `delete_walkforward_artifacts` and the
  `{data_lake_root}/<kind>/{run_id}/...` layout convention.
- `src/q_backend/storage/redis/progress.py` — `set_job_progress` / `get_job_progress` /
  `delete_job_progress` with a `namespace` arg.

---

## Goal

```
POST   /api/v1/strategy-search                       → {"run_id": ...}     # start (background)
GET    /api/v1/strategy-search/{run_id}              → status + progress    # Redis/memory, DB fallback
GET    /api/v1/strategy-search/{run_id}/results      → full leaderboard JSON
POST   /api/v1/strategy-search/{run_id}/cancel       → status payload
GET    /api/v1/strategy-searches                     → paginated history list
DELETE /api/v1/strategy-searches/{run_id}            → 204 (+ lake cleanup)
GET    /api/v1/strategy-search/{run_id}/candidates/{candidate_id}/artifacts/equity
                                                     → stitched OOS equity points for one candidate
```

Request body is the WO31 `StrategySearchConfig` (JSON). Validation rejects multi-objective and
a date range too short for `min_windows` (surface WO31/WO23's `ValueError` text as a 422).

## Tasks

### 1. Postgres tables (Alembic migration, additive)

Mirror `walkforward_runs` / `walkforward_windows`:

- `strategy_search_runs`: id (UUID pk), name, status (`RunStatus` values), `config` JSON
  (full request body), `result_summary` JSON (objective_mode, candidate counts,
  best candidate id + its OOS objective + efficiency — **summary only**), `lake_paths` JSON,
  `error_message`, `started_at`, `finished_at`, timestamps. Index on status + created_at.
- `strategy_search_candidates`: id, `run_id` FK (CASCADE), `candidate_id` (string),
  `strategy` (string), `status`, `rank` (nullable int), `objective_value` (nullable),
  `robustness_score` (nullable), `efficiency` (nullable), `gate_flags` JSON, `passed_gates`
  bool, `oos_metrics` JSON, `is_metrics_summary` JSON, `best_params` JSON, `window_count`,
  `completed_windows`. Unique (run_id, candidate_id).
- Repository fns following existing naming: `create_strategy_search_run`,
  `update_strategy_search_run`, `create_strategy_search_candidate`,
  `get_strategy_search_run`, `list_strategy_search_runs`, `delete_strategy_search_run`.

> **GUARDRAIL — metadata only in Postgres.** Per-candidate metric **dicts** are summary
> metadata (allowed). The stitched OOS **equity curves** and OOS **trade lists** go to the
> **lake**, never to Postgres — same rule as walk-forward.

### 2. Job module — `src/q_backend/api/strategy_search_jobs.py`

Clone `walkforward_jobs.py`:

- `StrategySearchRequest(BaseModel)` wrapping the WO31 `StrategySearchConfig` (or accept it
  directly — match whatever shape WO31 settled on; keep the body minimal).
- In-memory job registry + own `ThreadPoolExecutor(max_workers=1)` (searches are long;
  serialize them — note it in the docstring). A search namespace constant
  `PROGRESS_NAMESPACE = "strategy_search"` for Redis (must not collide with `walkforward`).
- `start_job`: build the runner **on the request thread** via `from_market_data_sliced`
  (the single MT5 fetch must happen on the MT5-initialized thread — same constraint as
  walk-forward), then submit `StrategySearchRunner.run(progress_callback=..., should_stop=...)`.
- `_make_progress_cb`: map `SearchProgress` → the job fields → Redis payload
  `{"status","current_candidate","total_candidates","candidate_id","strategy","phase",
"window_index","total_windows"}`.
- On finish: persist per-candidate rows + run `result_summary`, write lake artifacts
  (task 3), set terminal status. All storage writes best-effort try/except.
- `request_cancel`: cooperative flag the runner checks **between candidates** (WO31's
  `should_stop`); the in-flight candidate's walk-forward finishes its current window.
- `status_payload` / `results_payload` (live) and `status_payload_from_db` /
  `results_payload_from_db` (post-restart, from DB + lake). `results_payload` returns the
  full leaderboard: per-candidate records + the summary + the best candidate.

### 3. Lake artifacts (reuse WO22's module)

Under `{data_lake_root}/strategy_search/{run_id}/`:

- `leaderboard.parquet` — one row per candidate (id, strategy, status, rank, objective,
  robustness, efficiency, gates, key OOS metrics, best_params as JSON string) for research
  loading.
- `candidates/{candidate_id}/oos_equity.parquet` — that candidate's stitched OOS curve.
- (Optional but cheap) `candidates/{candidate_id}/oos_trades.parquet`.

Add `write_strategy_search_artifacts` / `read_strategy_search_artifact` /
`delete_strategy_search_artifacts` to `storage/lake/artifacts.py` mirroring the walk-forward
writers. Record the dict in `strategy_search_runs.lake_paths`. The per-candidate equity
endpoint reads `candidates/{candidate_id}/oos_equity.parquet` and returns the same point-list
shape (`[{"time","equity"}]`) the frontend walk-forward reader already uses.

### 4. Endpoints in `main.py`

Wire the seven routes (table above) mirroring the walk-forward endpoints' conventions: 422 on
invalid/short-range/multi-objective config (surface the `ValueError` text), 404 on unknown
run id or unknown candidate id, status endpoint falls back to the DB payload when the
in-memory job is gone. `GET .../results` serves from memory while the job lives, from DB +
lake after a restart.

### 5. Tests

- End-to-end over synthetic data (fake market-data service, 2–3 strategies × 2 windows × 2
  trials): POST → poll status to `completed` → results JSON has a ranked leaderboard, a best
  candidate, summary counts; DB run + candidate rows exist; lake files exist; the
  per-candidate equity endpoint returns points for the winner.
- **Postgres stopped** (monkeypatch `session_scope` to raise): the search still completes and
  the live results endpoint still serves from memory. (Global checklist item 1.)
- **Lake unwritable** (monkeypatch the writer to raise): the run still completes; results
  serve from memory; no crash. (Best-effort both ways.)
- Cancel between candidates → terminal `cancelled`/`failed` per your status model; remaining
  candidates don't run.
- Status + results survive a simulated restart (clear the in-memory registry → served from DB
  - lake).
- Migration up/down clean on a scratch DB (follow the existing Alembic test pattern).
- Existing walk-forward / optimization endpoints + tests untouched and green.

### 6. Docs

`q_backend/README.md`: endpoint table for strategy search, the request body shape, the lake
layout addition.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Existing walk-forward + optimization endpoints and tests untouched and green.
- In your final message, paste the **exact JSON contracts** — WO33 builds the entire frontend
  against this message:
  1. the POST request body (`StrategySearchConfig` JSON, with one fully-populated example),
  2. the status payload (running + terminal),
  3. the results payload (one full `CandidateResult` record + the summary + best),
  4. the history list item shape,
  5. the per-candidate equity-artifact response shape.

## Out of scope

- Any frontend change (WO33).
- Tick-engine search; multi-objective ranking (reject both with 422 / skip as in WO31).
- Parallel candidates, distributed runs.
- Genetic search, deflated-Sharpe correction (WO34 design).
