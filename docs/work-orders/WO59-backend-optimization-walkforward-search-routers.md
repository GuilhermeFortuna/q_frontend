# WO59 — Backend: optimization, walk-forward & strategy-search routers (extract from `main.py`)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context:** batch "API decomposition" (read **WO56** for the package skeleton + conventions). This
WO migrates the **three job-backed domains** — optimization, walk-forward, and strategy-search —
into per-domain routers + schema modules. These handlers are **already thin**: they validate input
and delegate to `optimization_jobs.py` / `walkforward_jobs.py` / `strategy_search_jobs.py`, then
map results to a response model. So there is **little/no service extraction** here — mostly moving
routes + schemas and importing the shared `BulkDelete*` from `schemas/common.py`. **No API change.**
Depends on WO56; sequence to avoid `main.py` conflicts with WO57/58/60.

---

## How the pieces work today (read these in `main.py`)

**Optimization** (`/api/v1/optimize`, `/api/v1/optimizations*`):
`start_optimization`, `get_optimization_status`, `get_optimization_results`, `list_optimizations`,
`bulk_delete_optimizations`, `delete_optimization`, `cancel_optimization` → delegate to
`optimization_jobs`. Schemas: `OptimizationStartResponse`, `OptimizationStatusResponse`,
`OptimizationResultsResponse`, `OptimizationStudyListItem`, `OptimizationStudyListResponse`
(+ `BulkDeleteOptimizationsRequest`/`BulkDeleteResponse` from `common`).

**Walk-forward** (`/api/v1/walkforward*`, `/api/v1/walkforwards*`):
`start_walkforward`, `get_walkforward_status`, `get_walkforward_results`, `cancel_walkforward`,
`list_walkforwards`, and the `{run_id}` route → delegate to `walkforward_jobs`. Schemas:
`WalkForwardStartResponse`, `WalkForwardStatusResponse`, `WalkForwardWindowResultResponse`,
`WalkForwardResultsResponse`, `WalkForwardRunListItem`, `WalkForwardRunListResponse`. Request type
`WalkForwardRequest` already lives in `walkforward_jobs.py`.

**Strategy-search / discovery** (`/api/v1/strategy-search*`, `/api/v1/strategy-searches*`):
`start_strategy_search`, `get_strategy_search_status`, `get_strategy_search_results`,
`list_strategy_searches`, `cancel_strategy_search`, `delete_strategy_search`, and the candidate
artifact/genome routes → delegate to `strategy_search_jobs`. Schemas:
`StrategySearchStartResponse`, `StrategySearchStatusResponse`, `StrategySearchCandidateResponse`,
`StrategySearchResultsResponse`, `StrategySearchRunListItem`, `StrategySearchRunListResponse`,
`StrategySearchCandidateEquityArtifactResponse`, `StrategySearchCandidateGenomeResponse`. Config
type `StrategySearchConfig` lives in `optimization/strategy_search.py`.

Shared: `Depends(get_session)` on the list/delete handlers; `BulkDelete*` in `schemas/common.py`.

---

## Goal

Three routers, each a thin delegator to its existing job module:

```python
# routers/optimization.py
router = APIRouter(tags=["optimization"])

@router.post("/api/v1/optimize", response_model=OptimizationStartResponse)
def start_optimization(config: OptimizationConfig):
    return optimization_jobs.start_job(config)   # unchanged delegation
```

## Tasks

### 1. Schema modules

`schemas/optimization.py`, `schemas/walkforward.py`, `schemas/strategy_search.py` — move the
listed schemas verbatim. Import `BulkDelete*` from `schemas/common.py`.

### 2. Routers

`routers/optimization.py`, `routers/walkforward.py`, `routers/strategy_search.py`, each with
`router = APIRouter(tags=[...])`. Move every route at its **exact path** (mind the singular vs.
plural paths and the shared `{run_id}`/`{study_id}` routes). Keep delegation to the `*_jobs`
modules and `Depends(get_session)` exactly as today.

### 3. Optional thin service

Only if a handler contains non-trivial mapping logic beyond "call job → build model", lift that into
`api/services/<domain>.py`. Otherwise keep handlers as thin delegators — do **not** invent a service
layer where there's nothing to extract (YAGNI).

### 4. Wire + delete

Add `app.include_router(...)` for the three routers; remove migrated routes/schemas from `main.py`.

## Guardrails

> **Zero API change.** Same paths/methods/status/models; OpenAPI paths for all three domains
> unchanged (assert in test). Watch the singular/plural pairs (`/walkforward` vs `/walkforwards`,
> `/strategy-search` vs `/strategy-searches`).

> **Job modules frozen.** No edits to `optimization_jobs.py` / `walkforward_jobs.py` /
> `strategy_search_jobs.py`; routers call them as `main.py` did.

> **No gratuitous service layer.** These domains are thin by design; only extract a service if real
> logic exists in the handler.

## Tests — `tests/api/test_jobs_routers.py` (+ keep existing persistence tests)

- All optimization/walk-forward/strategy-search routes exist with original paths+methods (extend
  the inventory test); singular/plural and `{id}` routes resolve correctly.
- The existing `test_optimization_persistence`, `test_walkforward_persistence`,
  `test_strategy_search_persistence` (and the new genetic tests) pass **unmodified** (fix only
  imports if they reached into `main.py`).
- Full suite green.

## Docs

`q_backend/README.md` API-layout section: list the three job-backed router modules and note they
delegate to the existing `*_jobs.py`.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- All three domains served from their routers; `main.py` has none of their routes/schemas.
- Paste the three route lists and confirmation the OpenAPI paths are unchanged.

## Out of scope

- market / backtest / storage / news (WO57/58/60). Editing the job layer. Behavior changes.
