# WO57 — Backend: market-data router + service (extract from `main.py`)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context:** batch "API decomposition" (see **WO56**, which you must read — it created
`api/routers/`, `api/schemas/`, `api/dependencies.py`, and the conventions all domain WOs follow).
This WO migrates the **market-data** domain — the largest and most logic-heavy slice of the old
`main.py` — into `routers/market.py` + `schemas/market.py` + a **market service**, leaving the
router handlers thin. **No API change.** Depends on WO56; should land before/independently of
WO58–60 (disjoint routes, but all touch `main.py`/`include_router` — sequence to avoid conflicts).

---

## How the pieces work today (read these in `main.py`)

Market routes and their (currently inline) helpers:

- **Routes:** `/api/v1/market-data/symbol/{symbol}` (`get_symbol_info`), `/api/v1/market-data/ohlcv`
  (`get_ohlcv`), `/api/v1/market-data/ticks` (`get_ticks`), `/api/v1/market/instruments`
  (`get_market_instruments`), `/api/v1/market/symbols/search` (`search_symbols`),
  `/api/v1/market/snapshot/{symbol}` (`get_market_snapshot`), `/api/v1/market/snapshots`
  (`get_market_snapshots`), `/api/v1/market/ticks/{symbol}` (`get_market_ticks`),
  `/api/v1/market/instruments`-info (`get_market_instrument_info`), `/api/v1/market/ohlcv/{symbol}`
  (`get_market_ohlcv`), and the ohlcv available-range route (`get_market_ohlcv_available_range`).
- **Inline domain logic to lift into a service:** `_infer_asset_class`, `_raw_symbol_to_instrument`,
  `_merge_instruments_by_symbol`, `_stored_instruments`, `_search_instrument_sources`,
  `_build_market_snapshot`, `_tick_side`, `_is_trade_tick`, `_format_tape_ticks`,
  `_symbol_info_to_instrument_response`, `_utc_iso_seconds`, `_utc_iso_milliseconds`,
  `_normalize_market_timeframe`, `_symbol_selectable_in_mt5`, `_has_local_ohlcv`,
  `_resolve_ohlcv_source`, `_fetch_ohlcv_rows`, `_fetch_ohlcv_available_range`,
  `_ohlcv_to_bar_response`.
- **Schemas:** `InstrumentResponse`, `MarketSnapshotResponse`, `MarketSnapshotsResponse`,
  `MarketTapeTickResponse`, `MarketTicksResponse`, `InstrumentInfoResponse`, `OhlcvBarResponse`,
  `OhlcvAvailableRangeResponse` (and any market-only model in the L96–557 block).
- **Shared singleton:** `market_data_service` — now in `api/dependencies.py` (WO56). Use
  `get_market_data_service`.
- Existing collaborators (unchanged): `market_data/service.py` (`MarketDataService`),
  `market_data/clients/metatrader.py`, `market_data/timezone.py`, `market_data/local_store.py`,
  `storage/runtime_config.py`.

---

## Goal

```python
# routers/market.py — thin handlers
@router.get("/api/v1/market/snapshot/{symbol}", response_model=MarketSnapshotResponse)
def get_market_snapshot(symbol: str, mds: MarketDataService = Depends(get_market_data_service)):
    snapshot = market_service.build_snapshot(mds, symbol)   # logic lives in the service
    if snapshot is None:
        raise HTTPException(404, ...)
    return snapshot
```

## Tasks

### 1. `schemas/market.py`

Move every market schema listed above verbatim (no field changes).

### 2. Market service

Create the service holding the lifted logic (prefer `market_data/api_service.py` to keep it in the
market domain package; `api/services/market.py` is acceptable if it depends on API-only types).
Move the inline helpers (instrument inference/merge/search, snapshot building, tape formatting,
ohlcv source resolution + fetch + range, timeframe normalization, tick classification,
iso-time helpers). Functions take an explicit `MarketDataService` (and `local_store`/runtime-config)
argument — **no hidden globals** — so they're unit-testable without the app.

### 3. `routers/market.py`

`router = APIRouter(tags=["market"])`. Move all market routes with **exact original paths**.
Handlers: validate inputs → call the market service (passing the injected `market_data_service`) →
map to the schema. Preserve every status code and error message (e.g. 404 for unknown symbol,
the MT5-live guard via `_require_mt5_live` from `dependencies`).

### 4. Wire + delete

`app.include_router(market.router)` in `main.py`; delete the migrated routes, schemas, and helpers
from `main.py`.

## Guardrails

> **Zero API change.** Same paths/methods/status/models. OpenAPI paths for market routes
> unchanged (assert in test).

> **One data provider.** Use the shared `market_data_service` via `get_market_data_service`; do
> **not** construct a new `MarketDataService`.

> **Service is pure-ish.** Lifted functions receive their collaborators as arguments; the only
> module global allowed is `logger`. This is what makes them testable and keeps the router thin.

> **MT5/local source behavior identical.** `_resolve_ohlcv_source` / `_symbol_selectable_in_mt5` /
> `_has_local_ohlcv` logic moves verbatim — the local-vs-MT5 decision must not change.

## Tests — `tests/api/test_market_router.py` (+ move existing market tests)

- Each market route exists with its original path+method (extend the WO56 inventory test).
- Snapshot/instruments/ohlcv handlers return the same shapes as before (port existing assertions;
  add service-level unit tests for `build_snapshot`, instrument merge/search, `resolve_ohlcv_source`).
- 404/guard paths preserved (unknown symbol; MT5-live required).
- Full suite green and unmodified.

## Docs

`q_backend/README.md` API-layout section: note the market domain lives in `routers/market.py` +
`schemas/market.py` + the market service.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- All market routes served from `routers/market.py`; `main.py` has none of them; logic is in the
  service with argument-injected collaborators.
- Paste the market route list (path+handler), the service's public functions, and confirmation the
  OpenAPI market paths are byte-identical.

## Out of scope

- Other domains (WO58–60). The `*_jobs.py` job layer. Any behavior/contract change.
