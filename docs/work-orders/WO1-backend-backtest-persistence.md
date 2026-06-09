# WO1 — Backend: session dependency + backtest persistence + history endpoints

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** the backend has a fully-written persistence layer
(`src/q_backend/storage/db/`) — SQLAlchemy models (`models.py`), an Alembic migration,
and a `repositories.py` with `create_*`/`update_*` functions — but the API never imports
any of it. Backtests currently run ephemerally. **We are wiring the existing persistence
in, not redesigning it.** Match the style of surrounding code. Do not add new
dependencies without asking. Keep changes minimal and reviewable.

This work order is **backend only.**

---

## Goal

Persist every backtest run and expose history endpoints, without breaking the existing
ephemeral compute path.

## Tasks

### 1. Session dependency

Create `src/q_backend/api/deps.py` with a FastAPI dependency `get_session()` that yields a
`Session` from `create_session_factory()` (in `storage/db/engine.py`) and commits / rolls
back per request. A `session_scope()` contextmanager already exists in that module for
non-request code — reuse its pattern, do not duplicate it.

### 2. Read functions in `repositories.py`

The file currently has only `create_*`/`update_*`. Add, matching the existing style:

- `get_backtest_run(session, run_id)`
- `list_backtest_runs(session, *, limit=50, offset=0, symbol=None)` — newest first
- `get_or_create_strategy(session, *, name)`

### 3. Wire `POST /api/v1/backtest/run` (`api/main.py`, around line 632)

- **Before** running: `get_or_create_strategy` → `create_backtest_config` →
  `create_backtest_run(status=RUNNING, started_at=now)`.
- **On success:** `update_backtest_run(status=COMPLETED, result_summary=<metrics dict>, finished_at=now)`.
- **On exception:** `update_backtest_run(status=FAILED, error_message=str(exc), finished_at=now)`.
- Add `run_id: str | None` to the `BacktestResponse` model and return it. This MUST be
  **additive** — the existing fields (`metrics`, `trades`, `bars`, `indicators`) stay
  exactly as they are.

> **GUARDRAIL — graceful degradation.** Backtests currently work with NO database. If any
> persistence call raises (e.g. Postgres down), log a warning and STILL return the computed
> result with `run_id=null`. The compute path must never hard-fail on a DB outage. Wrap
> persistence in a small helper rather than scattering try/except inline.

> **GUARDRAIL — storage tiering.** Store ONLY the small `metrics` dict in `result_summary`.
> Do NOT put `trades`, `bars`, or indicator series into Postgres. Leave `lake_paths` null.
> Those large arrays belong to a later data-lake phase.

### 4. History endpoints

Add to `api/main.py`, using the `get_session` dependency:

- `GET /api/v1/backtests` — paginated list
- `GET /api/v1/backtests/{run_id}` — full run; 404 if missing

**Response schemas to implement exactly (the frontend agent builds against these):**

`GET /api/v1/backtests?limit=&offset=&symbol=`

```json
{
  "items": [
    {
      "run_id": "3f9a1c8e7b...",
      "symbol": "WIN$",
      "strategy": "MACrossover",
      "timeframe": "M5",
      "status": "completed",
      "created_at": "2026-06-09T12:00:00Z",
      "summary": { "...": "the same metrics dict POST /backtest/run returns (or null if failed)" }
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

`GET /api/v1/backtests/{run_id}`

```json
{
  "run_id": "3f9a1c8e7b...",
  "symbol": "WIN$",
  "strategy": "MACrossover",
  "timeframe": "M5",
  "status": "completed",
  "config": { "...": "the full backtest request that produced this run" },
  "result_summary": { "...": "metrics dict, or null" },
  "error_message": null,
  "started_at": "2026-06-09T12:00:00Z",
  "finished_at": "2026-06-09T12:00:03Z",
  "created_at": "2026-06-09T12:00:00Z"
}
```

> **NOTE for downstream:** the detail endpoint intentionally does NOT return
> `trades`/`bars`/`indicators` — those are not persisted. History detail shows metrics +
> config only. (The frontend will offer a "re-run" to regenerate charts.)

### 5. Tests

Tests use in-memory SQLite + fakeredis already — see `tests/storage/conftest.py`.

- Extend `tests/storage/test_repositories.py` for the three new read functions.
- Add an API test: running a backtest persists a run that then appears in
  `GET /api/v1/backtests` and is fetchable via `GET /api/v1/backtests/{id}`.
- Add a test that asserts the compute path still returns a result when persistence is
  unavailable (run_id null), proving the graceful-degradation guardrail.

### 6. Docs

Update the **API Reference** section of `q_backend/README.md` with the two new endpoints.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- In your final message, paste the **exact** final JSON shapes of both new endpoints — the
  frontend work order (WO2) depends on them.

## Out of scope

- Optimization persistence (that is WO3).
- Any frontend change.
- Storing trades/bars/indicators anywhere in Postgres.
- New third-party dependencies.
