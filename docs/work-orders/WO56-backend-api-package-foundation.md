# WO56 — Backend: API package foundation (routers/schemas/services split of `main.py`)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this batch ("API decomposition"):** `src/q_backend/api/main.py` has grown to
**~2,824 lines** — it instantiates the FastAPI app, defines **~54 Pydantic schemas**, **~55
routes**, and **~93 module-level functions**, importing nearly every subsystem. It is the single
most central file in the backend, and incoming work (execution, broker adapters, risk controls,
monitoring) will each add more surface here. This batch splits it into **per-domain `APIRouter`
modules**, a **`schemas/` package**, and a **service layer**, leaving `main.py` as a thin
app-assembly file.

**This WO is the foundation.** It creates the package skeleton, the shared dependency/lifespan
seams, and the conventions every later domain WO follows, then proves the pattern by migrating
the two trivial domains (**system** and **strategies**) end-to-end. WO57–WO60 migrate the
remaining domains against the conventions defined here. **No behavior, path, or response-model
change anywhere** — this is a pure structural refactor.

---

## How `main.py` works today (read it first)

- **App assembly:** `app = FastAPI(title=..., lifespan=lifespan)` (~L886), `app.add_middleware(
CORSMiddleware, ...)` (~L894). `lifespan` (~L862) initializes `market_data_service`, calls
  `optimization_jobs / walkforward_jobs / strategy_search_jobs / backtest_jobs.reconcile_orphaned_runs()`,
  and on shutdown `market_data_service.shutdown()`.
- **Singletons:** `logger` (~L92) and **`market_data_service = MarketDataService()` (~L557)** —
  used by the lifespan and ~every market route.
- **Routes:** `@app.get/post/put/delete/patch` handlers (55), each defining/returning a Pydantic
  schema. Domains map cleanly to URL prefixes: `system` (`/`, `/api/v1/system/*`), `strategies`
  (`/api/v1/strategies`), `market` (`/api/v1/market/*`, `/api/v1/market-data/*`), `backtest`
  (`/api/v1/backtest*`), `optimization` (`/api/v1/optimize`, `/optimizations*`), `walkforward`
  (`/api/v1/walkforward*`), `strategy_search` (`/api/v1/strategy-search*`), `storage`
  (`/api/v1/storage/*`), `news` (`/api/v1/news*`).
- **Schemas:** all `class X(BaseModel)` at L96–557. **Shared across domains:**
  `BulkDeleteBacktestsRequest`, `BulkDeleteOptimizationsRequest`, `BulkDeleteResponse` (L348–359).
- **DB dependency:** `src/q_backend/api/deps.py` → `get_session`. Keep it.
- **Job layer (already extracted, do NOT touch):** `api/backtest_jobs.py`, `optimization_jobs.py`,
  `walkforward_jobs.py`, `strategy_search_jobs.py`, `storage_jobs.py`.

---

## Goal

```
src/q_backend/api/
  main.py              # ONLY: create app, middleware, lifespan, include_router(...) — no routes/schemas
  lifespan.py          # NEW: the lifespan context manager
  dependencies.py      # NEW: shared providers — market_data_service singleton, get_market_data_service(),
                       #      _require_mt5_live(), _data_source_payload(); re-export get_session
  deps.py              # existing (get_session) — unchanged
  schemas/             # NEW package — one module per domain + common.py
    __init__.py
    common.py          # BulkDelete*, shared response models
    system.py  strategies.py  (this WO; others added by WO57–60)
  routers/             # NEW package — one APIRouter per domain
    __init__.py
    system.py  strategies.py  (this WO; others added by WO57–60)
```

`main.py` after the full batch is ~50 lines. After **this** WO it still contains the
not-yet-migrated domains, but system + strategies are gone from it and included via routers.

## Tasks

### 1. Package skeleton

Create `api/schemas/__init__.py`, `api/routers/__init__.py`. Add `api/dependencies.py` and
`api/lifespan.py`.

### 2. Shared dependencies module (`api/dependencies.py`)

- Move `market_data_service = MarketDataService()` here as the **single** app-wide instance.
- Provide `get_market_data_service() -> MarketDataService` (returns the singleton) for routers to
  depend on via `Depends`, plus a direct import for the lifespan.
- Move the cross-domain MT5/data-source helpers here: `_require_mt5_live`, `_data_source_payload`
  (and any MT5 helper used by >1 domain). Keep names stable; export them.
- Re-export `get_session` from `deps` for one-stop importing (optional but tidy).

### 3. Lifespan module (`api/lifespan.py`)

Move the `lifespan` async context manager here, importing `market_data_service` from
`dependencies` and the four `*_jobs.reconcile_orphaned_runs`. Behavior identical.

### 4. `schemas/common.py`

Move `BulkDeleteBacktestsRequest`, `BulkDeleteOptimizationsRequest`, `BulkDeleteResponse` here
(WO58/WO59 import them). No field changes.

### 5. Reference migration — `system` + `strategies` domains

Establish the template the other WOs copy:

- `schemas/system.py`: `StorageServiceStatus`, `StorageStatusResponse`, `SystemHealthResponse`,
  `DataSourceResponse`, `DataSourceUpdateRequest` (move verbatim).
- `routers/system.py`: `router = APIRouter(tags=["system"])`; move `read_root` (`/`),
  `get_system_health` (`/api/v1/system/health`), `get_data_source_setting` +
  `update_data_source_setting` (`/api/v1/system/data-source`). Use `@router.get(...)` with the
  **exact same paths**. Depend on `get_market_data_service` where the handler needs the singleton.
- `routers/strategies.py` + (no schema module needed if it returns registry types; otherwise
  `schemas/strategies.py`): move `list_strategies` (`/api/v1/strategies`).
- Delete those routes/schemas/helpers from `main.py`.

### 6. Thin `main.py` assembly

`main.py` keeps `app = FastAPI(..., lifespan=lifespan)` (importing `lifespan` from `api.lifespan`),
CORS middleware, and **`app.include_router(...)`** for every migrated router. Structure the
include list so later WOs add exactly one line each. All not-yet-migrated routes remain in
`main.py` for now (WO57–60 remove them).

### 7. Conventions (document at top of `routers/__init__.py` as a module docstring)

Pin the rules every domain WO follows: one `APIRouter` per domain named `router`; `tags=["<domain>"]`;
**exact original paths preserved** (no `prefix=` rewrites that change the URL); schemas live in
`schemas/<domain>.py`; domain logic lifted out of handlers goes to a **service** (extend the
existing domain package — `market_data/`, `backtesting/`, etc. — or `api/services/<domain>.py`
when it's API-specific); the shared `market_data_service` is obtained via
`get_market_data_service`, never re-instantiated; handlers stay thin (validate → call service →
map to schema).

## Guardrails

> **Zero API change.** Same paths, methods, status codes, request/response models. A diff of the
> OpenAPI schema (`app.openapi()`) before vs. after must show **no changes** for migrated routes.
> Add a test that asserts the migrated paths exist with the same methods.

> **One `market_data_service`.** Exactly one instance, in `dependencies.py`. Grep the tree for
> `MarketDataService(` — it must appear once (plus tests). The lifespan and all routers share it.

> **Job modules are frozen.** Do not edit `*_jobs.py`. Routers call them exactly as `main.py` does.

> **No import cycles.** `routers/*` import from `schemas/*`, `dependencies`, services, and
> `*_jobs`. `main.py` imports `routers/*` + `lifespan`. Nothing imports `main`.

## Tests — `tests/api/test_app_assembly.py` (new) + existing

- **Route inventory:** assert every route path+method that existed pre-split still exists on `app`
  (hard-code the system/strategies set this WO migrates; later WOs extend it).
- **OpenAPI stability:** snapshot `app.openapi()["paths"]` keys for the migrated routes; assert no
  change.
- **Singleton:** `dependencies.market_data_service is` the instance the lifespan uses; only one
  `MarketDataService()` construction.
- **system + strategies endpoints** behave identically (reuse/move any existing tests for them).
- Full existing `tests/` suite green and **unmodified** (other than imports if a test reached into
  `main.py` internals — fix the import, not the behavior).

## Docs

`q_backend/README.md`: add an "API layout" section — `main.py` assembles the app and includes
per-domain routers from `api/routers/`; schemas in `api/schemas/`; shared providers in
`api/dependencies.py`; domain logic in services. Point WO57–60 at the conventions.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- `main.py` no longer defines the system/strategies routes or schemas; they live in
  `routers/`+`schemas/` and are `include_router`-ed. `main.py` imports `lifespan` and the shared
  singleton from the new modules.
- In your final message paste: the new `api/` tree, the `routers/__init__.py` conventions
  docstring, the `dependencies.py` public surface, and the `include_router` block — WO57–60 build
  against these.

## Out of scope

- Migrating market / backtest / optimization / walkforward / strategy-search / storage / news —
  **WO57–WO60**.
- Any change to routes' behavior, auth, versioning, or the `*_jobs.py` job layer.
- Frontend (no API contract changes, so nothing to do).
