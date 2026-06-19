# WO58 — Backend: backtest router + run service (extract from `main.py`)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context:** batch "API decomposition" (read **WO56** for the package skeleton + conventions). This
WO migrates the **backtest** domain into `routers/backtest.py` + `schemas/backtest.py` + a
**backtest run service** (the synchronous run logic + lake artifacts currently inline in
`main.py`). The **job layer `api/backtest_jobs.py` stays as-is** — this WO only moves the
synchronous endpoints + their helpers. **No API change.** Depends on WO56; sequence after/around
WO57 to avoid `main.py` conflicts.

---

## How the pieces work today (read these in `main.py`)

- **Routes:** `/api/v1/backtest/run` (`run_backtest`, synchronous), `/api/v1/backtest`
  (`start_backtest`, job), `/api/v1/backtest/{run_id}` (`get_backtest_status`),
  `/api/v1/backtest/{run_id}/result` (`get_backtest_result`), `/api/v1/backtests` (`list_backtests`),
  `/api/v1/backtests/bulk-delete` (`bulk_delete_backtests`), `/api/v1/backtests/{run_id}`
  (`get_backtest` / `patch_backtest` / `delete_backtest`), `/api/v1/backtests/{run_id}` equity +
  trades artifact routes (`get_backtest_equity_artifact`, `get_backtest_trades_artifact`).
- **Inline logic to lift into a service:** `_backtest_run_fields`, `_backtest_run_list_item`,
  `_backtest_run_detail`, `_backtest_request_config`, `_resolve_tick_flags`,
  `_columnar_to_tick_arrays`, `_run_tick_backtest`, `_start_backtest_run`,
  `_build_equity_dataframe`, `_write_backtest_lake_artifacts`, `_finish_backtest_run`,
  `_artifact_datetime_to_iso`, `_serialize_trades_artifact`, `_serialize_equity_artifact`,
  `_delete_backtest_lake_artifacts`.
- **Schemas:** `BacktestRequest`, `ChartIndicatorSeries`, `BacktestResponse`,
  `BacktestStartResponse`, `BacktestStatusResponse`, `BacktestRunListItem`,
  `BacktestRunListResponse`, `BacktestRunDetailResponse`, `BacktestRunPatchRequest`,
  `EquityArtifactPoint`, `BacktestEquityArtifactResponse`, `BacktestTradesArtifactResponse`.
  **Shared** `BulkDelete*` now live in `schemas/common.py` (WO56) — import them.
- Collaborators (unchanged): `backtesting/factory.py` (`build_strategy`), `backtesting/engine.py`,
  `backtesting/chart_data.py`, `backtesting/tick/*`, `backtesting/costs.py`,
  `backtesting/position_sizing.py`, `storage/lake/*`, `storage/db/*`, `api/backtest_jobs.py`,
  `api/deps.py` (`get_session`).

---

## Goal

```python
# routers/backtest.py
@router.post("/api/v1/backtest/run", response_model=BacktestResponse)
def run_backtest(request: BacktestRequest):
    return backtest_run_service.run_sync(request)     # bar/tick dispatch + chart serialization

@router.delete("/api/v1/backtests/{run_id}")
def delete_backtest(run_id: str, session: Session = Depends(get_session)):
    backtest_run_service.delete(session, run_id)      # incl. lake artifact cleanup
```

## Tasks

### 1. `schemas/backtest.py`

Move all backtest schemas above verbatim; import `BulkDelete*` from `schemas/common.py`.

### 2. Backtest run service

Create the service (prefer `backtesting/run_service.py` so it sits in the backtest domain package;
`api/services/backtest.py` acceptable). Move the inline helpers: synchronous bar + tick backtest
execution (`_run_tick_backtest`, `_start_backtest_run`, `_finish_backtest_run`, request→config,
tick-flag/array conversion), equity-dataframe build, lake artifact **write/read/serialize/delete**,
and the DB-row→response mappers. Pass `Session`/runners as arguments — no hidden globals beyond
`logger`.

### 3. `routers/backtest.py`

`router = APIRouter(tags=["backtest"])`. Move every backtest route at its **exact path**, including
the three handlers sharing `/api/v1/backtests/{run_id}` (GET/PATCH/DELETE). Keep
`Depends(get_session)` where used. Handlers call the run service.

### 4. Wire + delete

`app.include_router(backtest.router)`; remove migrated routes/schemas/helpers from `main.py`.

## Guardrails

> **Zero API change.** Same paths/methods/status/models; OpenAPI backtest paths unchanged.

> **Job layer frozen.** `backtest_jobs.py` is not edited; the `start_backtest` route delegates to
> it exactly as before. This WO only moves the _synchronous_ run + artifact logic.

> **Lake artifacts identical.** Artifact paths, serialization, and the delete-cleanup behavior
> move verbatim — no change to what's written or where.

> **Service testable.** Lifted functions take their collaborators (session, runner, dataframe) as
> arguments.

## Tests — `tests/api/test_backtest_router.py` (+ move existing backtest tests)

- Backtest routes exist with original paths+methods (extend inventory test); the three-verb
  `{run_id}` route resolves correctly per method.
- Synchronous `run_backtest` (bar **and** tick paths) returns the same response shape; chart data
  serialized identically (port existing assertions).
- Artifact read/serialize and `delete_backtest` lake-cleanup behave as before (service unit tests).
- Existing `tests/api/test_backtest_*` and artifact tests green and unmodified.

## Docs

`q_backend/README.md` API-layout section: backtest domain = `routers/backtest.py` +
`schemas/backtest.py` + the run service; jobs remain in `backtest_jobs.py`.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- All backtest routes served from `routers/backtest.py`; `main.py` has none; sync-run + artifact
  logic in the service.
- Paste the backtest route list, the run-service public surface, and confirmation OpenAPI backtest
  paths are unchanged.

## Out of scope

- Other domains (WO56/57/59/60). The job layer. Any behavior/contract change.
