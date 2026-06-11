# WO7 — Backend: enriched snapshot, batch quotes, ticks + instrument info endpoints

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** the Market page of the frontend is being upgraded into a
Bloomberg-style terminal. Today the backend's market snapshot endpoint returns only
`{symbol, last, changePct, volume}`, there is no batch-quote endpoint (so the frontend
watchlist shows hardcoded fake prices), and tick data is only exposed through a legacy
endpoint shape the frontend never adopted. The MT5 connection already has everything we
need — `symbol_info_tick` returns bid/ask/last, `symbol_info` returns digits/tick sizes,
`copy_ticks_range` returns the tape. This work order surfaces that data through clean
`/api/v1/market/*` endpoints. Match the style of surrounding code. Do not add new
dependencies. This work order is **backend only.**

---

## How the market endpoints work today (read these files)

- `src/q_backend/api/main.py` — all routes live here.
  - `GET /api/v1/market/snapshot/{symbol}` (~line 583) — connects MT5, `symbol_info_tick`,
    computes `changePct` from D1 closes. **This is the endpoint you will enrich.** Note it
    already handles the market-closed fallback via `copy_rates_from_pos`.
  - `GET /api/v1/market-data/ticks` (~line 433) — legacy tick endpoint, query-param symbol,
    returns raw `Tick` models. Leave it alone; you will add a new frontend-shaped one.
  - `GET /api/v1/market-data/symbol/{symbol}` (~line 372) — returns the **raw**
    `mt5.symbol_info()._asdict()` (100+ fields). Leave it alone; you will add a curated one.
- `src/q_backend/market_data/clients/metatrader.py` — `MetaTrader5Client`. All MT5 calls are
  serialized through `_run_locked`. `get_symbol_info` and `get_ticks` already exist.
  **Follow this pattern: never call `mt5.*` from the route without going through the client
  lock** (the existing snapshot route violates this — it is acceptable to keep its style, but
  any new client methods you add must use `_run_locked`).
- `src/q_backend/market_data/models.py` — `OHLCV` and `Tick` Pydantic models.
- Response models for `/api/v1/market/*` (e.g. `MarketSnapshotResponse`,
  `InstrumentResponse`) are defined in/near `api/main.py` — find them and follow the
  camelCase aliasing convention used by `OhlcvBarResponse`.

---

## Goal

Give the frontend real, rich quote data: an enriched single-symbol snapshot, a batch
snapshot endpoint for the watchlist, a recent-ticks endpoint for a time-&-sales tape, and a
curated instrument-info endpoint for contract specs.

## Tasks

### 1. Enrich `GET /api/v1/market/snapshot/{symbol}`

Extend `MarketSnapshotResponse` (additive only) to:

```json
{
  "symbol": "PETR4",
  "last": 41.08,
  "bid": 41.07,
  "ask": 41.09,
  "spread": 0.02,
  "changePct": -0.34,
  "changeAbs": -0.14,
  "volume": 45683500,
  "dayOpen": 41.2,
  "dayHigh": 41.55,
  "dayLow": 40.9,
  "prevClose": 41.22,
  "digits": 2,
  "tickTime": "2026-06-09T14:32:11Z"
}
```

- `bid`/`ask`/`tickTime` come from `symbol_info_tick`; `spread = ask - bid`.
- `dayOpen/dayHigh/dayLow` come from today's D1 bar (`copy_rates_from_pos(symbol,
TIMEFRAME_D1, 0, 2)` — you already fetch this for `changePct`; reuse it, don't re-fetch).
- `prevClose` is the previous D1 close; `changeAbs = last - prevClose`.
- `digits` comes from `mt5.symbol_info(symbol).digits`.
- When the market is closed and `symbol_info_tick` is empty, fall back as the current code
  does and set `bid`/`ask` to the last close (spread 0), never to 0.0 if a close exists.

> **GUARDRAIL — back-compat.** `symbol`, `last`, `changePct`, `volume` MUST keep their
> exact names and semantics. The frontend and its MSW mocks consume them today. All new
> fields are additive. If a value is unavailable, return a sensible fallback (0.0 / null
> per the response model), never a 500.

### 2. Batch quotes: `GET /api/v1/market/snapshots?symbols=PETR4,VALE3,WIN$`

- Comma-separated `symbols` query param (cap at 50 symbols; 422 above that).
- Returns `{"snapshots": [MarketSnapshotResponse, ...]}` — same shape as task 1, one entry
  per **resolvable** symbol.
- Unknown/unselectable symbols are **silently skipped** (the watchlist may contain stale
  symbols; one bad symbol must not 404 the whole batch).
- One MT5 connect for the whole batch, not one per symbol. Factor the per-symbol snapshot
  build out of the task-1 route into a helper both routes share.
- If MT5 is offline entirely, return 503 (same behavior as the single-symbol route).

### 3. Recent ticks: `GET /api/v1/market/ticks/{symbol}?limit=200`

Frontend-shaped time-&-sales feed:

```json
{
  "ticks": [
    {
      "timestamp": "2026-06-09T14:32:11.123Z",
      "bid": 41.07,
      "ask": 41.09,
      "last": 41.08,
      "volume": 300,
      "side": "buy"
    }
  ]
}
```

- `limit` default 200, max 1000. Return the **most recent** `limit` ticks, newest last.
- Implement via a new client method using `mt5.copy_ticks_from` (count-based) under
  `_run_locked`, or reuse `get_ticks` with a recent time window — whichever is simpler,
  but it must not scan unbounded history.
- `side` is derived from MT5 tick flags: `TICK_FLAG_BUY` (32) → `"buy"`,
  `TICK_FLAG_SELL` (64) → `"sell"`, both/neither → `null`. Use `mt5.TICK_FLAG_BUY` /
  `mt5.TICK_FLAG_SELL` constants, not magic numbers.
- Filter out informational ticks with no trade (`last == 0` and no buy/sell flag) so the
  tape shows trades, not quote updates — unless that would empty the result (FX symbols
  have no `last`), in which case return quote ticks with `side: null`.

### 4. Instrument info: `GET /api/v1/market/instrument-info/{symbol}`

Curated contract-spec subset of `symbol_info` (the existing raw endpoint dumps 100+
fields; the frontend needs a stable, typed contract):

```json
{
  "symbol": "WIN$",
  "description": "Mini Indice Bovespa",
  "exchange": "BMF",
  "currencyBase": "BRL",
  "currencyProfit": "BRL",
  "digits": 0,
  "point": 1.0,
  "tickSize": 5.0,
  "tickValue": 1.0,
  "contractSize": 0.2,
  "volumeMin": 1.0,
  "volumeMax": 500.0,
  "volumeStep": 1.0,
  "spreadFloating": true
}
```

Source fields: `description`, `path`/`exchange`, `currency_base`, `currency_profit`,
`digits`, `point`, `trade_tick_size`, `trade_tick_value`, `trade_contract_size`,
`volume_min`, `volume_max`, `volume_step`, `spread_float`. Reuse
`MetaTrader5Client.get_symbol_info` — do not add a parallel MT5 call path. 404 for
unknown symbols, 503 when MT5 is offline.

### 5. Tests

Follow the existing test approach for MT5-backed routes (look at how current tests mock
the MT5 client / `market_data_service`):

- Enriched snapshot: all new fields present; legacy fields unchanged; market-closed
  fallback produces non-zero bid/ask from last close.
- Batch: multiple symbols → multiple snapshots; one bad symbol among good ones → bad one
  skipped, others returned; >50 symbols → 422; MT5 offline → 503.
- Ticks: limit respected; `side` mapping for buy/sell/none flags; trade-only filtering and
  the FX quote-tick fallback.
- Instrument info: field mapping from a fake `symbol_info` dict; 404 unknown symbol.

### 6. Docs

Update `q_backend/README.md`: document the three new endpoints and the enriched snapshot
fields.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- In your final message, paste example JSON responses for ALL four endpoints (snapshot,
  snapshots, ticks, instrument-info) — the frontend work orders (WO8, WO10) build their
  TypeScript types and MSW mocks against these contracts.

## Out of scope

- Any frontend change.
- WebSockets / streaming (a later phase; polling consumes these endpoints for now).
- Market depth (`market_book_get`) — later phase.
- Removing or changing the legacy `/api/v1/market-data/*` endpoints.
- New third-party dependencies.
