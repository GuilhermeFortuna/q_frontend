# WO3 — Backend: optimization study/trial persistence + restart-safe results

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`

**Context for this work:** the backend has a fully-written persistence layer
(`src/q_backend/storage/db/`) — models, migration, and a `repositories.py` with
`create_*`/`update_*` functions including `create_optimization_study`,
`update_optimization_study`, `create_optimization_trial`, `update_optimization_trial`.
Optuna studies currently run in in-memory background threads (`api/optimization_jobs.py`),
mirror progress to Redis, and are **lost on server restart** — results 404 afterward.
**We are wiring the existing persistence in, not redesigning it.**

This builds on **WO1** (which adds `api/deps.py` and the read-function pattern in
`repositories.py`). This work order is **backend only.**

---

## Goal

Persist Optuna studies and trials to Postgres, and make study results survive a server
restart — without breaking the existing in-memory + Redis progress path.

## Tasks

### 1. Use a DB-backed study id

In `api/optimization_jobs.py`, on `start_job`, call `create_optimization_study(status=PENDING)`
and use the returned DB UUID **as** the `study_id`.

> **GUARDRAIL — id contract.** The frontend polls `/api/v1/optimize/{study_id}` and keys
> React Query on this string. `study_id` MUST stay a plain string in every API response.
> Today it is `uuid4().hex`; a DB UUID rendered as hex string is compatible — verify all
> optimize responses still serialize identically (same field, same string shape).

### 2. Persist trials + study status from the worker thread

In the progress callback / job lifecycle, upsert finished trials
(`create_optimization_trial` / `update_optimization_trial`) and update study status on
completion / cancellation / error.

> **GUARDRAIL — use `session_scope()`, not the request dependency.** Background worker
> threads must persist via the `session_scope()` contextmanager in `storage/db/engine.py`.
> Do NOT use the request-scoped `get_session` dependency from a thread.

> **GUARDRAIL — graceful degradation.** Same rule as backtests: if Postgres is down, log a
> warning and continue. The in-memory job + Redis progress path must still work end to end.

### 3. Restart-safe results

`GET /api/v1/optimize/{id}/results` currently 404s once the in-memory job is gone. Add a
fallback: when the in-memory job is missing, rebuild the results payload from the persisted
study + its trials, returning the same `OptimizationResultsResponse` shape as today.

### 4. List endpoint

Add `GET /api/v1/optimizations` — paginated list of studies. Add a
`list_optimization_studies(session, *, limit=50, offset=0)` read function to
`repositories.py` (newest first).

**Response schema to implement:**

```json
{
  "items": [
    {
      "study_id": "3f9a...",
      "name": "WIN$ MA sweep",
      "status": "done",
      "best_value": 1.83,
      "n_trials": 100,
      "completed_trials": 100,
      "created_at": "2026-06-09T12:00:00Z"
    }
  ],
  "total": 7,
  "limit": 50,
  "offset": 0
}
```

### 5. Tests

Tests use in-memory SQLite + fakeredis (`tests/storage/conftest.py`,
`tests/optimization/conftest.py`).

- Assert a study + its trials land in the DB during a run.
- Assert results **rebuild from persistence** after the in-memory job is dropped
  (simulate restart by clearing the in-memory `_jobs` dict).
- Assert the optimize endpoints still return `study_id` as a string of the same shape.

### 6. Docs

Update the **API Reference** section of `q_backend/README.md` with `GET /api/v1/optimizations`
and the restart-safe results behavior.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- In your final message, paste the exact `GET /api/v1/optimizations` response shape and
  confirm the `study_id` string shape is unchanged — WO4 depends on both.

## Out of scope

- Frontend changes (that is WO4).
- Changing the in-memory/Redis progress mechanism (keep it; persistence is added alongside).
- Storing large per-trial chart/series arrays — persist params + metrics only.
- New third-party dependencies.
