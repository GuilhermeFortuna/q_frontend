# MT5 Remote Data Gateway — fresh WIN$/WDO$ data on Linux

**Status:** Design approved 2026-07-03. WO183–WO186 landed (gateway server,
`RemoteMt5Client` + `remote` config, `remote` routing + fetch-through + ingest
provider switch, and the Wine setup script + systemd units + operator guide). The
manual E2E checklist in `q_backend/docs/mt5-wine-gateway.md` awaits a run on the target
Wine machine.
**Related:** hardening batch WO177–182 (must land first).

## Context / problem

Development happens on a dual-boot machine. On Linux there is no MetaTrader5, so the
backend falls back to the local parquet store (`data_source=local`), which is only as
fresh as the last Windows ingest. The symbols that matter — B3 futures `WIN$` / `WDO$` —
have **no alternative free source**: Yahoo Finance (yfinance) does not carry B3 futures
(only `.SA` equities, `^BVSP`, US tickers), B3's public files are daily settlements only,
and unofficial routes (tvdatafeed) are shallow and ToS-gray. yfinance was evaluated and
**deferred** — the empty `q_backend/src/q_backend/market_data/clients/yfinance.py`
placeholder stays for a future equities/US research batch.

The requirement is **same-day fresh futures data while working on Linux**, without
touching live execution (which stays native-MT5-on-Windows only).

## Decision

Run the MT5 terminal **under Wine** on the Linux machine, with a small **HTTP data
gateway** (Windows-Python inside the same Wine prefix) exposing just the market-data
calls. The Linux backend talks to it through a new `RemoteMt5Client` that implements the
existing `MarketDataProvider` protocol. Routing treats it as a third source:
**fetch-through + cache** — prefer it when reachable, persist what it returns into the
local parquet store, degrade to `local` when offline.

The gateway is deliberately **location-agnostic**: if Wine proves flaky, the identical
gateway script runs on a Windows VM / spare machine / VPS and the Linux client is
reconfigured with a URL — zero code changes.

## Architecture

```
Linux backend (q_backend)                     Wine prefix (same machine)
┌─────────────────────────────┐               ┌──────────────────────────┐
│ MarketDataService           │   HTTP /v1    │ mt5_gateway.py           │
│  ├─ MetaTraderClient (n/a)  │──────────────▶│  (Windows-Python, stdlib │
│  ├─ RemoteMt5Client  ◀──────┤  JSON + .npz  │   + MetaTrader5 + numpy) │
│  └─ LocalParquetClient      │               │        │                 │
│        ▲ fetch-through      │               │  MT5 terminal (Wine)     │
│  local parquet store        │               └──────────────────────────┘
└─────────────────────────────┘
```

### 1. Gateway server (`q_backend/gateway/mt5_gateway.py`)

Standalone script, **stdlib `http.server` + `MetaTrader5` + `numpy` only** (numpy is
already a hard dependency of the MetaTrader5 package) — nothing to pip-install into the
Wine Python beyond MetaTrader5 itself. Binds `127.0.0.1:<port>` (default 18812).

**Versioned API — all endpoints under `/v1/`:**

| Endpoint                                   | Method | Response                                                                             |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------ |
| `/v1/health`                               | GET    | JSON: `{status, schema_version, mt5_connected, terminal_build}`                      |
| `/v1/symbol_info?symbol=`                  | GET    | JSON (mirrors `MetaTraderClient.get_symbol_info` dict)                               |
| `/v1/symbols/search?query=`                | GET    | JSON list                                                                            |
| `/v1/available_range?symbol=&timeframe=`   | GET    | JSON (`OhlcvAvailableRange` fields)                                                  |
| `/v1/ohlcv?symbol=&timeframe=&start=&end=` | GET    | **`.npz`** columns: `time, open, high, low, close, tick_volume, spread, real_volume` |
| `/v1/ticks?symbol=&start=&end=&flags=`     | GET    | **`.npz`** columnar tick arrays (same keys as `get_ticks_columnar`)                  |

- **Bulk format:** `np.savez_compressed` streamed as `application/octet-stream`; client
  loads with `np.load`. JSON only for small metadata responses.
- **Versioning:** `SCHEMA_VERSION = "1.x"` constant in the gateway; client checks major
  version at `/v1/health` and refuses a mismatch with a clear error. Breaking wire
  changes bump to `/v2/`.
- **Timestamps:** raw MT5 epoch seconds / `time_msc` pass through **unchanged** — the
  Linux side reuses the existing naive-Brasília conventions in
  `market_data/timezone.py` verbatim, so gateway-fetched bars are byte-identical to
  natively-fetched ones.
- Chunking of long ranges reuses the same range-splitting approach as
  `MetaTraderClient._fetch_ohlcv_range_chunked` (implemented gateway-side).
- Security posture: localhost-only bind; optional shared-secret header for the VM/VPS
  deployment case.

### 2. Linux client (`market_data/clients/remote.py` — `RemoteMt5Client`)

Implements `MarketDataProvider` (`clients/base.py`) with the same method surface as
`MetaTraderClient`: `get_ohlcv`, `get_ticks_columnar`, `get_symbol_info`,
`get_available_ohlcv_range`, `search_symbols`, `is_supported`, `is_available`.

- Config: gateway URL from runtime config (key `remote_gateway_url`) with
  `Q_MT5_GATEWAY_URL` env fallback.
- `is_available()` = `/v1/health` probe, short timeout (~1s), result cached ~30s so an
  offline gateway degrades instantly instead of hanging every request.
- Deserializes `.npz` into the existing `OHLCV` models / columnar dicts — downstream
  consumers see no difference from `MetaTraderClient`.

### 3. Routing — `remote` joins `auto | mt5 | local`

- `storage/runtime_config.py`: add `"remote"` to `_VALID_SOURCES` / `DataSource`.
- `market_data/service.py` (`_resolve_provider`, `_resolve_ohlcv_provider`) and
  `market_data/routing.py` (`resolve_ohlcv_source`): third branch. **`auto` preference
  order: native MT5 → remote gateway → local parquet.**
- **Fetch-through cache:** bars/ticks read via the gateway are also written into the
  local parquet store (same dedup/append path as ingestion,
  `market_data/local_store.py::write_ohlcv/write_ticks`), so every read enriches the
  offline cache. In **`auto`** mode (WO188), OHLCV reads are **coverage-aware**: when
  the gateway wins routing, local parquet is the fast path if its envelope already
  covers the requested range; otherwise only missing head/tail segments are fetched,
  persisted, and the full range is served from local parquet. Explicit **`remote`**
  source always performs a full-range gateway fetch.

### 4. Ingestion through the gateway

`api/storage_jobs.py` currently hardcodes `service.mt5_client.get_ohlcv/get_ticks_columnar`;
switch it to the resolved provider so the existing "download history" job (and its UI)
works identically on Linux through the gateway. No new job type.

### Consumers

As of WO189, research pipelines (feature-matrix builds, feature evaluation, feature
evidence, neural latent gating, and alpha-research preflight) load OHLCV through
`market_data/read_through.py::read_ohlcv_fresh`, which delegates to
`MarketDataService.get_ohlcv` so coverage-aware gateway gap-fill applies. Offline
behavior is unchanged: with no gateway, reads fall through to local parquet exactly as
before.

### 5. Out of scope

- **Everything under `execution/`** (live brokers, `quote_source.py`) — live execution
  stays native-MT5-on-Windows only.
- yfinance client (deferred; placeholder file untouched).
- Snapshot/instrument raw-`mt5.*` calls in `market_data/api_service.py` — nice-to-have
  follow-up, not required for backtests/research freshness.

### 6. Wine setup & operations

Delivered in WO186 — operator guide: `q_backend/docs/mt5-wine-gateway.md`; setup script:
`q_backend/gateway/setup_wine.sh`; systemd user units: `q_backend/gateway/systemd/`
(`mt5-terminal.service` + `mt5-gateway.service` + `mt5-gateway.env.example`).

- Doc + helper script: dedicated Wine prefix, MT5 terminal install, Windows-Python
  install, `pip install MetaTrader5`, launching terminal + gateway; systemd user unit
  example so both start on login (the `mt5-gateway.service` unit is the production
  trigger for the WO183 server).
- Pins (deliberate, no auto-update): Windows Python 3.11.9, `MetaTrader5==5.0.5735`, and
  the Wine version recorded + change-checked in the prefix marker.
- Known risks: (a) terminal-under-Wine stability — mitigation: same gateway on a
  Windows VM, no code change; (b) MetaTrader5 pip package occasionally lags Wine —
  mitigation: pin the Wine prefix and the package version in the setup doc.

## Testing

- Unit: `RemoteMt5Client` against a fake in-process gateway (stdlib HTTP server serving
  canned JSON/`.npz` payloads), including schema-version mismatch and timeout paths.
- Routing: new `remote` branch + `auto` fallback order (remote reachable / unreachable).
- Round-trip: gateway-fetched bars land in the parquet store identical to fixture bars
  ingested via the native path (guards the timezone convention).
- App-wide smoke (WO190): `tests/integration_smoke/test_gateway_app_wide.py` (fake gateway
  in CI; live pass via `Q_MT5_GATEWAY_URL` + manual checklist in
  `q_frontend/docs/dev/gateway-app-wide-validation.md`).
- Manual E2E against real Wine + terminal is part of verification, not CI.
