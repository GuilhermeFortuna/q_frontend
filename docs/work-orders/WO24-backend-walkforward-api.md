# WO24 — Backend: walk-forward API, job lifecycle, and persistence

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** this batch ("Research Validation") adds walk-forward analysis.
WO23 shipped the compute core in `src/q_backend/optimization/walkforward.py`:
`WalkForwardConfig`, `split_windows`, `WalkForwardRunner` (one up-front data fetch via
`DefaultBacktestRunner.from_market_data_sliced`, per-window Optuna optimize → out-of-sample
test, stitched OOS equity, efficiency ratio, `progress_callback`). WO22 shipped the Parquet
lake module (`src/q_backend/storage/lake/`) with the layout convention
`{data_lake_root}/<kind>/{run_id}/...`. This work order exposes walk-forward over the API
with the same job lifecycle as optimization studies, persists run/window metadata to
Postgres, and writes the stitched OOS artifacts to the lake. It is **backend only**
(WO25 builds the frontend against the contracts you paste in your completion message).

**Prerequisites shipped:** WO22 (lake module), WO23 (walk-forward core).

---

## How the optimization job lifecycle works today (read these files)

This WO is deliberately a **mirror** of the optimization study plumbing — read it first
and copy its patterns rather than inventing new ones:

- `src/q_backend/api/optimization_jobs.py` — the template. `OptimizationJob` in-memory
  registry, module-level `ThreadPoolExecutor` (~line 114), `start_job` (~line 376),
  `_persist_progress` → Redis (`storage/redis/progress.py`), `_persist_study_start/
_persist_study_status/_persist_study_finish` → Postgres via `session_scope()`
  (best-effort try/except — compute never fails because storage is down),
  `status_payload_from_db` fallback when the in-memory job is gone (server restart).
- `src/q_backend/api/main.py` — the `/api/v1/optimize*` and `/api/v1/optimizations*`
  endpoints (~lines 1400–1530): start, status, results, list, bulk-delete, delete, cancel.
- `src/q_backend/storage/db/models.py` + `repositories.py` — `OptimizationStudy`/
  `OptimizationTrial` tables and their `create_*`/`update_*`/`list_*` functions; mirror
  the shapes. `alembic/` holds the migration pattern.

---

## Goal

```
POST   /api/v1/walkforward                  → {"run_id": ...}            # start (background)
GET    /api/v1/walkforward/{run_id}         → status + progress payload  # live via Redis/memory, DB fallback
GET    /api/v1/walkforward/{run_id}/results → full WalkForwardResult JSON
POST   /api/v1/walkforward/{run_id}/cancel  → status payload
GET    /api/v1/walkforwards                 → paginated history list
DELETE /api/v1/walkforwards/{run_id}        → 204 (+ lake artifact cleanup)
```

The request body is `{"optimization": <OptimizationConfig>, "walkforward":
<WalkForwardConfig>}` — the existing optimizer config reused verbatim, plus the WO23
window config.

## Tasks

### 1. Postgres tables (Alembic migration, additive)

- `walkforward_runs`: id (UUID pk), name, status (`RunStatus` values), `config` JSON (the
  full request body), `result_summary` JSON (aggregate OOS metrics + efficiency + window
  count — **summary only**), `lake_paths` JSON, `error_message`, `started_at`,
  `finished_at`, timestamps. Index on status and created_at.
- `walkforward_windows`: id, `run_id` FK (CASCADE), `window_number`, train/test start/end
  datetimes, status (`completed` / `no_result`), `best_params` JSON, `is_metrics` JSON,
  `oos_metrics` JSON. Unique (run_id, window_number).
- Repository functions in `storage/db/repositories.py` following the existing naming:
  `create_walkforward_run`, `update_walkforward_run`, `create_walkforward_window`,
  `get_walkforward_run`, `list_walkforward_runs`, `delete_walkforward_run`.

> **GUARDRAIL — metadata only.** Per-window metrics JSON is fine; the stitched OOS equity
> curve and the OOS trade list go to the **lake**, never to Postgres. (Window-level
> `is_metrics`/`oos_metrics` are small dicts — that's summary metadata, allowed.)

### 2. Job module — `src/q_backend/api/walkforward_jobs.py`

Mirror `optimization_jobs.py`:

- In-memory job registry + its own small `ThreadPoolExecutor` (walk-forward runs are long;
  `max_workers=1` is acceptable and serializes runs — note it in the module docstring).
- `start_job`: build the runner **on the request thread** —
  `DefaultBacktestRunner.from_market_data_sliced(...)` so the single MT5 fetch happens on
  the MT5-initialized thread (same constraint documented in `from_market_data`) — then
  submit `WalkForwardRunner.run(progress_callback=...)` to the executor.
- The `progress_callback` updates the in-memory job and best-effort-writes Redis progress:
  `{"status", "current_window", "total_windows", "phase": "optimizing"|"testing",
"windows_completed"}`. Reuse `storage/redis/progress.py` helpers with a key prefix that
  cannot collide with optimization study ids.
- On finish: persist window rows + run `result_summary`, write lake artifacts (task 3),
  set status `completed`/`failed` (+`error_message`). All storage writes best-effort.
- Cancellation: cooperative, like optimization cancel — a flag the runner checks between
  windows (extend `WalkForwardRunner` minimally if WO23 didn't include a cancel hook:
  an optional `should_stop: Callable[[], bool]` checked at each window boundary is enough;
  mid-window Optuna trials finish their current trial).

### 3. Lake artifacts (reuse WO22's module)

On completion write, under `{data_lake_root}/walkforward/{run_id}/`:

- `oos_equity.parquet` — the stitched OOS equity curve.
- `oos_trades.parquet` — concatenated OOS trades.
- `windows.parquet` — one row per window (dates, status, key IS/OOS metrics, params as
  JSON string) for convenient research loading.

Record the dict in `walkforward_runs.lake_paths`. Add
`GET /api/v1/walkforward/{run_id}/artifacts/equity` returning the same point-list JSON
shape as WO22's backtest equity artifact endpoint (WO25/WO26 share one frontend reader).

### 4. Endpoints in `main.py`

Wire the six routes (table above) following the optimization endpoints' conventions:
422 on invalid config (e.g. range too short for `min_windows` — surface WO23's
`ValueError` message), 404 on unknown run id, status endpoint falls back to DB payload
when the in-memory job is gone. `GET .../results` returns the full per-window list +
aggregate OOS metrics + equity curve points (from memory while the job lives; from
DB + lake after a restart).

### 5. Tests

- End-to-end over synthetic data (faked market data service, 2 windows × 2 trials):
  POST → poll status to `completed` → results JSON has windows, OOS metrics, efficiency;
  DB rows exist; lake files exist.
- **Postgres stopped** (monkeypatch `session_scope` to raise): the run still completes and
  the live results endpoint still serves from memory. (Global checklist item 1.)
- Cancel between windows → status `failed` or `cancelled` per your status model, no
  further windows run.
- Status payload survives a simulated restart (clear the in-memory registry, status served
  from DB).
- Migration up/down clean on a scratch DB (follow the existing Alembic test pattern, or at
  minimum `alembic upgrade head` in CI fashion locally).

### 6. Docs

Update `q_backend/README.md`: endpoint table for walk-forward, the request body shape,
lake layout addition.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Existing optimization endpoints and tests untouched and green.
- In your final message, paste the exact JSON contracts: the POST request body, the status
  payload, the results payload (per-window record + aggregate), and the artifact endpoint
  shape — **WO25 builds the entire frontend against this message.**

## Out of scope

- Any frontend change (WO25).
- Tick-engine walk-forward (reject `engine="tick"` with 422 + clear detail).
- Parallel windows, distributed runs.
- Monte Carlo / deflated Sharpe (later WOs in this phase).
