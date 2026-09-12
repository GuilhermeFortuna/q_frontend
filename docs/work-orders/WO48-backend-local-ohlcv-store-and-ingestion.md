# WO48 — Backend: Local OHLCV parquet store + MT5 ingestion API

## Shared context (read first)

You are working in a two-repo project. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this batch ("Local Data Store"):** the goal is to run the app on **Linux**
without MT5 by reading market data from a **portable local parquet store** populated on Windows
from MT5. WO47 already turned `MarketDataService` into a provider router (`auto`/`mt5`/`local`)
and added a `LocalParquetClient` **stub** that returns empty. This work order makes the store
real for **OHLCV bars**: a writer/reader/catalog on disk, the `LocalParquetClient.get_ohlcv`
implementation, and a **Storage API** (download-from-MT5 job + inventory + delete) that the
WO49 UI drives. **Ticks are out of scope here — WO50.** This work order is **backend only.**

**Prerequisite shipped:** WO47 (provider abstraction + `MarketDataProvider` interface +
`Q_*` settings conventions). Build the local provider against the interface WO47 pasted.

---

## How things work today (read these files)

- `src/q_backend/market_data/clients/local.py` — the WO47 `LocalParquetClient` stub. You
  replace its `get_ohlcv` / `get_available_ohlcv_range` / `search_symbols` / `get_symbol_info`
  bodies with parquet/catalog reads.
- `src/q_backend/market_data/clients/metatrader.py` — `MetaTraderClient.get_ohlcv(symbol,
timeframe, start, end) -> list[OHLCV]` is the **ingestion source**. It already chunks large
  ranges safely (`_fetch_ohlcv_range_chunked`, the `_get_chunk_days` map) — reuse it; do not
  re-implement chunking. The accepted timeframe **names** come from WO47's name map.
- `src/q_backend/market_data/models.py` — `OHLCV` (fields: `time, open, high, low, close,
tick_volume, spread?, real_volume?`). The store round-trips these exact fields.
- `src/q_backend/market_data/tick_cache.py` — the parquet precedent: configurable root via
  env (`cache_dir()`), project-relative resolution, symbol slugging (`_slug_symbol`),
  pyarrow `pq.write_table`/`read_table`. Mirror this style.
- `src/q_backend/storage/lake/artifacts.py` — the other parquet precedent: relative-path
  bookkeeping, `_project_root()`, best-effort writes. Mirror its conventions.
- `src/q_backend/storage/settings.py` — the root **already exists**:
  `market_data_root: str = "data/market"` (env `Q_MARKET_DATA_ROOT`, `env_prefix="Q_"`). Use
  it; do **not** add a second setting. Resolve it like `data_lake_root` (absolute, or
  project-relative; mkdir on use).
- `src/q_backend/storage/redis/progress.py` + `src/q_backend/api/backtest_jobs.py` /
  `optimization_jobs.py` — the **background-job + Redis-progress pattern** to clone for the
  ingestion job (enqueue → worker loops → publish progress → status endpoint reads it). Read
  how a job id is created, how progress is published, and how the status endpoint polls.
- `src/q_backend/tasks/worker_context.py` — `get_worker_market_data_service()` gives the
  worker its `MarketDataService`; the ingest worker uses it to call `get_ohlcv` via MT5.

---

## Goal

A portable, self-describing OHLCV store; the local provider serves bars from it; and a Storage
API to fill, list, and prune it.

### Layout (portable — copy the folder, it works on Linux)

```
{market_data_root}/                   # Q_MARKET_DATA_ROOT, default data/market
  ohlcv/{symbol_slug}/{timeframe}/{YYYY}.parquet
  catalog.json
```

- Bars partitioned by **year** per `{symbol, timeframe}` — bounded file sizes and cheap
  append. Parquet columns = the `OHLCV` fields, `time` as the canonical ascending key.
- `catalog.json` — the self-describing manifest, an array of:
  `{"symbol", "timeframe", "start": ISO, "end": ISO, "rows": int, "bytes": int, "updated_at": ISO}`.
  The local provider and the Storage UI read this instead of scanning files / MT5.

## Tasks

### 1. Store module

New `src/q_backend/market_data/local_store.py`:

- `market_data_root() -> Path` — resolve the existing `settings.market_data_root` like `tick_cache.cache_dir()`
  (absolute or project-relative; mkdir on use). Reuse a `_slug_symbol` equivalent.
- `write_ohlcv(symbol, timeframe, bars: list[OHLCV]) -> dict` — convert to DataFrame, split by
  `time.year`, and for each year **merge with the existing year file**, dedupe on `time`
  (keep last), sort ascending, write parquet (pyarrow). Then refresh `catalog.json` for that
  `{symbol, timeframe}` (recompute start/end/rows/bytes across its year files). Return the
  updated catalog entry. **Idempotent**: re-ingesting an overlapping range must not duplicate
  bars.
- `read_ohlcv(symbol, timeframe, start, end) -> list[OHLCV]` — read only the year files that
  intersect `[start, end]`, concat, filter to the range, return `OHLCV` models ascending.
- `available_range(symbol, timeframe) -> OhlcvAvailableRange | None` — from the catalog.
- `list_inventory() -> list[dict]` — the catalog entries (the Storage UI's table source).
- `delete_ohlcv(symbol, timeframe) -> None` — remove the `{symbol}/{timeframe}` dir and its
  catalog rows (best-effort).
- `stored_symbols() -> list[dict]` — distinct symbols from the catalog (for `search_symbols`).
- Keep catalog writes **atomic** (write temp + replace) so a crash mid-write can't corrupt it.

### 2. Implement `LocalParquetClient` (OHLCV)

In `clients/local.py`, replace the stubbed bodies:

- `get_ohlcv` → `local_store.read_ohlcv(...)`.
- `get_available_ohlcv_range` → `local_store.available_range(...)`.
- `search_symbols(query)` → filter `local_store.stored_symbols()` by substring (shape matches
  `MetaTraderClient.search_symbols`: `{name, description, path, custom}` — synthesize
  `description`/`path` from the catalog; `custom=False`).
- `get_symbol_info(symbol)` → minimal dict from the catalog (enough for endpoints that only
  read `name`; return `None` if not stored).
- `get_ticks` / `get_ticks_columnar` / `get_recent_ticks` → still empty/"not stored" (WO50).
  `get_ticks_columnar` returns the empty-arrays shape; a candle backtest in `local` mode must
  work, a tick backtest degrades with a clear "no local tick data — ingest ticks (WO50)" error.

### 3. Ingestion job

New `src/q_backend/api/storage_jobs.py` (mirror `backtest_jobs.py`):

- A worker entry `run_ingest_job(job_id, request_json)` that:
  - Parses `{symbol, timeframes: [str], start, end, kind: "bars"}`.
  - For each timeframe: calls `market_data_service.get_ohlcv(symbol, tf, start, end)` (this
    resolves to MT5 when available — ingestion is a Windows activity), then
    `local_store.write_ohlcv(...)`.
  - Publishes progress per timeframe (and optionally per year-chunk) via the Redis progress
    helper, with a terminal `completed`/`failed` status and a result summary
    (per-timeframe rows written + final range).
  - **Best-effort, isolated:** one timeframe failing (e.g. MT5 returns nothing) flags that
    timeframe but does not abort the others.
- A job registry/status the API reads (reuse the existing job-store pattern other jobs use).

### 4. Storage API endpoints

Add to `api/main.py` (or a small `api/storage` router, matching how other job APIs attach):

```
GET    /api/v1/storage/inventory
       → {"root": "<abs path>", "items": [ {symbol, timeframe, start, end, rows, bytes, updated_at}, ... ]}

POST   /api/v1/storage/ingest
       body {"symbol": str, "timeframes": [str], "start": ISO, "end": ISO, "kind": "bars"}
       → {"job_id": str, "status": "queued"}

GET    /api/v1/storage/ingest/{job_id}
       → {"job_id", "status": "queued"|"running"|"completed"|"failed",
          "progress": 0..1, "detail": str,
          "results": [ {timeframe, rows, start, end, status} ] | null,
          "error": str | null}

DELETE /api/v1/storage/{symbol}/{timeframe}
       → {"deleted": true, "symbol", "timeframe"}
```

- Validate timeframes against WO47's accepted-names list (422 on unknown).
- `ingest` requires MT5 to be **available** (the source); if `mt5_available()` is `False`,
  return a clear 409/503 ("ingestion needs MT5; you're on a machine without it"), since you
  can't fill the store from a machine that has no broker connection.
- Endpoints read the catalog/job store directly and must work with the **active provider =
  local** (inventory/delete don't need MT5).

### 5. Wire the new root into health

`GET /api/v1/system/health` `dataLakeStatus` already exists; additively surface the market-data
root + item count if cheap (optional). Do not change existing health field shapes.

### 6. Tests

- Store round-trip: `write_ohlcv` synthetic bars across two years → `read_ohlcv` a sub-range →
  exact bars back, ascending, deduped. Re-ingest an overlapping range → no duplicates, catalog
  start/end/rows correct. Use `tmp_path` + `Q_MARKET_DATA_ROOT`.
- Provider parity: a `local` `get_ohlcv` over an ingested range returns the same bar count and
  values that were written (and that `MetaTraderClient` would have returned for that data).
- Catalog: `list_inventory` reflects writes and deletes; atomic-write leaves no partial file.
- Ingest job (faked `MarketDataService.get_ohlcv` returning synthetic bars): job reaches
  `completed`, files exist, inventory shows the rows; one timeframe raising → that timeframe
  `failed`, others `completed`.
- API: inventory/ingest/status/delete happy paths; `ingest` with MT5 unavailable → clear
  error; unknown timeframe → 422.
- Candle backtest end-to-end with data-source `local` over an ingested symbol/timeframe/range
  completes with **no MT5 calls** (spy/monkeypatch the MT5 client to assert it's untouched).

### 7. Docs

Update `q_backend/README.md`: document the `ohlcv/{symbol}/{timeframe}/{YYYY}.parquet` +
`catalog.json` layout, `Q_MARKET_DATA_ROOT`, portability (copy folder / repoint root), and the
Storage endpoints.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- A round trip works in practice: ingest a real symbol/timeframe from MT5 (Windows), confirm
  parquet under `data/market/ohlcv/...` + a populated `catalog.json`, switch data-source
  to `local`, run a candle backtest for that range successfully.
- In your final message, **paste**: the four Storage endpoint JSON shapes (request + response)
  and the catalog/inventory item shape — **WO49 builds the entire Storage UI against them** —
  plus the lake layout (WO50 extends it with `ticks/{symbol}/{YYYY-MM}.parquet`).

## Out of scope

- Ticks (WO50) — leave `get_ticks*` empty/"not stored".
- Any frontend (WO49). The System data-source card/setting (WO47 shipped the endpoint; WO49
  builds the card).
- Retention/compaction beyond per-year files; multi-provider sources beyond MT5→local.
