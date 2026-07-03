# WO183 — Backend: MT5 data gateway server

## Shared context (read first)

This is part of the WO183–WO186 remote-gateway batch. Read `docs/design/mt5-remote-gateway.md`
(in `q_frontend/docs/design/`) — it is the approved spec for the whole batch. Problem: on Linux
(dual-boot) there is no native MetaTrader5, so `WIN$`/`WDO$` data goes stale. Solution: the MT5
terminal runs under Wine with a small HTTP gateway next to it; the Linux backend consumes it
through a protocol-compatible client (WO184) and routing (WO185). Live execution is untouched.

Backend repo: `q_backend`, Python managed with `uv` (`uv run pytest` — never pip/poetry).

## Files to read

- `src/q_backend/market_data/clients/metatrader.py` — the behavior the gateway mirrors:
  `TIMEFRAME_NAMES` / `_resolve_mt5_timeframe` (~line 197/237), `_get_chunk_days` (~274),
  `_fetch_ohlcv_range_chunked`, `get_ohlcv` (~489), `get_ticks_columnar` (~695),
  `get_available_ohlcv_range` (~590), `COLUMNAR_TICK_KEYS` (~52), `_empty_ticks_columnar` (~71)
- `src/q_backend/market_data/models.py` — `OHLCV` field names = the `.npz` column names
- `docker/metatrader5-stub/MetaTrader5/__init__.py` — the existing fake-MT5 pattern for tests

## Goal

A single-file, dependency-minimal HTTP server that runs on Windows-Python inside a Wine prefix
(or any Windows box) and exposes MT5 market-data reads:

```python
# q_backend/gateway/mt5_gateway.py  (stdlib http.server + MetaTrader5 + numpy ONLY)
SCHEMA_VERSION = "1.0"
# GET /v1/health          -> JSON {"status": "ok", "schema_version": "1.0",
#                                  "mt5_connected": bool, "terminal_build": int | None}
# GET /v1/symbol_info     ?symbol=                       -> JSON dict | 404
# GET /v1/symbols/search  ?query=                        -> JSON list
# GET /v1/available_range ?symbol=&timeframe=            -> JSON {symbol,timeframe,start,end,bar_count} | 404
# GET /v1/ohlcv           ?symbol=&timeframe=&start=&end= -> .npz (application/octet-stream)
# GET /v1/ticks           ?symbol=&start=&end=&flags=     -> .npz (application/octet-stream)
```

## Tasks

1. Create `q_backend/gateway/mt5_gateway.py` — deliberately **outside `src/`** so it can never
   import `q_backend` (the Wine Python has only stdlib + `MetaTrader5` + numpy). Configuration
   via argparse/env: `--host` (default `127.0.0.1`), `--port` (default `18812`), optional
   `--token` (when set, require header `X-Gateway-Token` on every request; 401 otherwise).
2. Wire contract (WO184 codes against this exactly):
   - `start`/`end` query params are **ISO-8601 naive Brasília wall-clock** strings (the same
     naive datetimes `MetaTraderClient` passes to `mt5.copy_rates_range`). The gateway parses
     with `datetime.fromisoformat` and passes them through — it does **no** timezone math.
   - `/v1/ohlcv` `.npz` arrays, all equal length: `time` (int64, raw MT5 epoch seconds exactly
     as returned by `copy_rates_range`), `open`/`high`/`low`/`close` (float64), `tick_volume`
     (int64), and `spread`/`real_volume` (int64) only when present in the rates dtype.
   - `/v1/ticks` `.npz` arrays with the same keys/dtypes as
     `metatrader._empty_ticks_columnar()`: `time_msc` int64 (raw MT5 milliseconds), `bid`/`ask`/
     `last`/`volume` float64, `flags` int32. `flags` query param: `all` (default) or `trade`,
     mapped to `mt5.COPY_TICKS_ALL`/`COPY_TICKS_TRADE`.
   - Serialization: `np.savez_compressed` into an in-memory buffer, served as
     `application/octet-stream`. JSON is only for `/v1/health`, `/v1/symbol_info`,
     `/v1/symbols/search`, `/v1/available_range` and for errors
     (`{"error": str, "code": str}` with a proper HTTP status).
3. Reimplement chunked fetching gateway-side (copy the logic of `_get_chunk_days` +
   `_fetch_ohlcv_range_chunked`, adapted; no q_backend import). Timeframe validation mirrors
   `TIMEFRAME_NAMES`; unknown timeframe → 400. Symbol not selectable → 404 with code
   `symbol_not_found`. MT5 not initialized → 503 with code `mt5_unavailable` (and
   `mt5_connected: false` in `/v1/health`, still HTTP 200 there).
4. Connection management: `mt5.initialize()` on startup (best-effort, retried lazily per
   request if it failed), `mt5.shutdown()` on SIGINT/SIGTERM. Use `ThreadingHTTPServer`;
   serialize actual `mt5.*` calls behind a single lock (the MT5 IPC is not thread-safe).
5. Production trigger (cutover guardrail): the gateway is launched by the Wine setup + systemd
   user unit delivered in WO186 (`gateway/systemd/mt5-gateway.service`). This WO must leave a
   `if __name__ == "__main__":` entry point and a `README` note in the module docstring showing
   the exact launch command WO186 will install.

## Guardrails

> The gateway is read-only market data. It must not import or expose any trading/order API
> (`order_send`, `positions_get`, …) — live execution stays native-MT5-only.
> No imports from `q_backend`; stdlib + `MetaTrader5` + `numpy` only. numpy is already a hard
> dependency of the MetaTrader5 package, so nothing extra is installed into the Wine Python.
> No timezone conversion anywhere in the gateway: raw MT5 epochs out, naive-Brasília ISO in.
> Breaking wire changes bump `SCHEMA_VERSION` major and move endpoints to `/v2/` — never mutate
> `/v1/` semantics.

## Tests

`tests/market_data/test_mt5_gateway.py` — load the gateway module from its file path with
`importlib`, after installing a fake `MetaTrader5` module into `sys.modules` (follow the
`docker/metatrader5-stub` pattern; give the fake canned `copy_rates_range`/`copy_ticks_range`
structured arrays). Start the server on port 0 in a thread; exercise over real HTTP:

- `/v1/health` reports `schema_version == "1.0"` and `mt5_connected`;
- `/v1/ohlcv` round-trip: response `.npz` decodes to the exact arrays the fake returned
  (raw epochs untouched), correct dtypes;
- `/v1/ticks` round-trip incl. `flags=trade` mapping and empty-result shape
  (`_empty_ticks_columnar` keys, zero length);
- invalid timeframe → 400 with `{"code": ...}`; unknown symbol → 404; fake `initialize`
  failing → 503 `mt5_unavailable`;
- `--token` set: request without header → 401, with header → 200.

## Docs

Module docstring documents every endpoint, the wire contract, and the launch command. The
operator-facing setup doc is WO186, not here.

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must include:
the full endpoint table with response formats, the `SCHEMA_VERSION` value, and the exact
launch command line.

## Out of scope

The Linux-side client (WO184), routing/ingest integration (WO185), Wine/systemd setup (WO186).
Snapshot/instrument endpoints mirroring `market_data/api_service.py` raw `mt5.*` calls
(explicitly deferred in the design doc).
