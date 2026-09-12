# WO50 — Backend: Local tick parquet store + ingestion (tick engine offline)

## Shared context (read first)

You are working in a two-repo project. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this batch ("Local Data Store"):** WO47–WO49 made the app run on **Linux**
without MT5 for **candle** backtests by reading OHLCV from a portable local parquet store.
This work order does the same for the **tick engine**: ingest raw ticks from MT5 into the
store and serve them to `get_ticks_columnar` from parquet so tick backtests/optimization run
offline. This is **Phase B** and is **backend only.**

**Prerequisites shipped:** WO47 (provider router), WO48 (OHLCV store + `local_store.py` +
Storage ingest API + `catalog.json`). Extend those — do not fork them.

---

## How things work today (read these files)

- `src/q_backend/market_data/tick_cache.py` — **the tick parquet schema already exists.**
  `COLUMNAR_TICK_KEYS = ("time_msc","bid","ask","last","volume","flags")`, `_TICK_DTYPE_MAP`,
  and `store`/`load` via pyarrow. The local tick store uses **this exact 6-column schema and
  dtypes** so the columnar contract matches the engine's.
- `src/q_backend/market_data/clients/metatrader.py` —
  `get_ticks_columnar(symbol, start, end, flags, use_cache) -> dict[str, np.ndarray]` is the
  ingestion source; it already chunks (`_fetch_ticks_range_chunked`) and enforces a max. The
  return dict (aligned int64 `time_msc` ascending + float/int columns) is the canonical shape
  to persist and reproduce. `_empty_ticks_columnar()` is the empty shape.
- `src/q_backend/market_data/clients/local.py` — `LocalParquetClient.get_ticks_columnar`
  currently returns empty (WO48). You implement it from parquet here.
- `src/q_backend/market_data/local_store.py` (WO48) — extend with tick writer/reader/catalog.
- `src/q_backend/api/storage_jobs.py` (WO48) — the ingest job; add `kind: "ticks"` handling.
- `src/q_backend/api/backtest_jobs.py` `_execute_tick` (~line 204) — the consumer:
  `market_data_service.get_ticks_columnar(symbol, start, end, flags=...)`. In `local` mode this
  must resolve to your parquet reader. `resolve_tick_flags` lives in
  `optimization/tick_backtest_runner`.

---

## Goal

Ticks live in the portable store and `local` mode serves them columnar, so a tick backtest runs
with no MT5.

### Layout (extends WO48)

```
{market_data_root}/ticks/{symbol_slug}/{YYYY-MM}.parquet      # Q_MARKET_DATA_ROOT (default data/market); COLUMNAR_TICK_KEYS schema
```

Catalog gains tick entries (distinct `kind`): `{"symbol","kind":"ticks","start","end","rows",
"bytes","updated_at"}` (months covered derivable from `start`/`end`). Keep OHLCV entries as-is
(treat them as `kind:"bars"`; add the `kind` field additively, defaulting existing rows to
`"bars"`).

## Tasks

### 1. Tick store (extend `local_store.py`)

- `write_ticks(symbol, arrays: dict[str, np.ndarray]) -> dict` — split by month from
  `time_msc`, merge with the existing month file, dedupe on `time_msc` (keep last), sort
  ascending, write parquet with the **`COLUMNAR_TICK_KEYS` schema + dtypes** (reuse the
  `tick_cache` write style). Refresh the catalog tick entry. Idempotent on overlap.
- `read_ticks_columnar(symbol, start, end) -> dict[str, np.ndarray]` — read intersecting month
  files, concat, filter to `[start, end]` by `time_msc`, return the aligned-arrays dict
  (ascending). Empty range → `_empty_ticks_columnar()`-shaped dict.
- `tick_available_range(symbol)` and inventory integration (tick rows in `list_inventory`).
- `delete_ticks(symbol)`.

### 2. `LocalParquetClient.get_ticks_columnar`

- Implement from `local_store.read_ticks_columnar` (ignore `flags`/`use_cache` — the stored
  ticks are already `COPY_TICKS_ALL`; if a narrower flag is requested, document that local mode
  serves all stored ticks). `get_ticks` (list form) can derive from the columnar arrays for the
  few endpoints that use it, or stay empty if unused offline.

### 3. Ingestion — `kind: "ticks"`

In `storage_jobs.py`, extend the ingest worker so `kind:"ticks"`:

- calls `market_data_service.get_ticks_columnar(symbol, start, end)` (MT5 source) — **chunk the
  range by month** before fetching so a multi-year request doesn't hit the engine's max-tick
  guard or exhaust memory; write each chunk via `write_ticks` and publish progress per month.
- The Storage API request body already carries `kind`; validate `"bars" | "ticks"`. Ticks
  ranges are huge — surface a clear progress/detail and keep writes incremental (don't hold the
  whole range in memory).

### 4. Tests

- Tick store round-trip: synthetic arrays spanning two months → `write_ticks` →
  `read_ticks_columnar` sub-range → arrays equal, ascending, deduped; re-ingest overlap → no
  dupes. `tmp_path` + `Q_MARKET_DATA_ROOT`.
- Schema/dtype: persisted columns and dtypes match `COLUMNAR_TICK_KEYS` / `_TICK_DTYPE_MAP`.
- Provider: `local` `get_ticks_columnar` reproduces written arrays.
- Tick backtest end-to-end with data-source `local` over ingested ticks completes with **no MT5
  calls** (spy the MT5 client). A tick backtest for a symbol with **no** stored ticks degrades
  with the clear "ingest ticks" error from WO48, not a 500.
- Ingest job `kind:"ticks"` (faked columnar source) reaches `completed`, files exist, inventory
  shows tick rows, progress advances per month.

### 5. Docs

Update `q_backend/README.md`: document the `ticks/{symbol}/{YYYY-MM}.parquet` layout, the
catalog `kind` field, and that local tick mode serves all stored ticks.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Real round trip: ingest ticks for a symbol/month from MT5 (Windows), switch data-source to
  `local`, run a **tick** backtest over that range successfully with MT5 disconnected.
- In your final message, **paste**: the tick catalog/inventory item shape (with `kind`) so
  WO51 renders ticks in the inventory table, and confirm the columnar contract is unchanged.

## Out of scope

- Frontend (WO51). OHLCV changes (WO48 owns bars; only add the additive `kind` field).
- Re-deriving bars from ticks; tick compression/retention beyond per-month files.
