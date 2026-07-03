# WO184 — Backend: RemoteMt5Client + `remote` data-source config

## Shared context (read first)

Part of the WO183–WO186 remote-gateway batch; read `docs/design/mt5-remote-gateway.md`
(in `q_frontend/docs/design/`) and the WO183 completion contract (endpoint table + wire
formats). WO183 built the gateway server; this WO builds the Linux-side client that speaks to
it and the config plumbing. Routing/service integration is WO185 — this WO must not touch
`service.py` / `routing.py`.

Backend repo: `q_backend`, Python managed with `uv` (`uv run pytest` — never pip/poetry).

## Files to read

- `q_backend/gateway/mt5_gateway.py` (WO183) — the wire contract this client consumes
- `src/q_backend/market_data/clients/base.py` — `MarketDataProvider` Protocol (the surface to
  implement)
- `src/q_backend/market_data/clients/metatrader.py` — reference semantics: `OhlcvAvailableRange`
  dataclass, `COLUMNAR_TICK_KEYS`, `_empty_ticks_columnar`, `TIMEFRAME_NAMES`
- `src/q_backend/market_data/clients/local.py` — the other non-MT5 provider, style reference
- `src/q_backend/market_data/timezone.py` — `to_brasilia_naive`, `unix_seconds_to_brasilia_naive`
- `src/q_backend/storage/runtime_config.py` — `_VALID_SOURCES`, `DataSource`,
  `get_data_source`/`set_data_source`

## Goal

```python
# src/q_backend/market_data/clients/remote.py
class RemoteMt5Client:  # satisfies MarketDataProvider (runtime_checkable)
    def __init__(self, base_url: str | None = None, token: str | None = None): ...
    # base_url default: get_remote_gateway_url() -> runtime config key
    # "remote_gateway_url", env fallback Q_MT5_GATEWAY_URL, else None
```

`RemoteMt5Client` behaves exactly like `MetaTraderClient` from a consumer's point of view:
same methods, same return types, same naive-Brasília datetimes on `OHLCV.time`.

## Tasks

1. Extend `src/q_backend/storage/runtime_config.py`:
   - `_VALID_SOURCES` / `DataSource` gain `"remote"` (now `auto | mt5 | remote | local`);
   - new `get_remote_gateway_url() -> str | None` / `set_remote_gateway_url(value)` on the
     same JSON config (key `remote_gateway_url`), with `Q_MT5_GATEWAY_URL` env taking
     precedence when set; new `get_remote_gateway_token()` (key `remote_gateway_token`, env
     `Q_MT5_GATEWAY_TOKEN`).
2. Create `src/q_backend/market_data/clients/remote.py` implementing every
   `MarketDataProvider` method using `httpx` (already a backend dependency — do not add a new
   HTTP library):
   - `is_supported() -> bool`: True iff a gateway URL is configured.
   - `is_available() -> bool`: GET `/v1/health` with ~1s timeout; result cached for 30s
     (monotonic clock) so an offline gateway degrades instantly instead of hanging every call.
     On the first successful health check, verify schema major version: gateway
     `schema_version` major != client's supported major → log an explicit error, treat as
     unavailable (never raise from `is_available`).
   - `connect()` = a health probe; `disconnect()` = drop the cached health state.
   - `get_ohlcv(symbol, timeframe, start, end) -> list[OHLCV]`: convert `start`/`end` with
     `to_brasilia_naive(...)`, send as ISO strings; decode the `.npz`; build `OHLCV` models
     converting the raw `time` epochs with `unix_seconds_to_brasilia_naive`; `spread`/
     `real_volume` become `None` when the column is absent from the archive.
   - `get_ticks_columnar(...) -> dict[str, np.ndarray]`: decode `.npz` into exactly the
     `COLUMNAR_TICK_KEYS` arrays with the dtypes of `_empty_ticks_columnar()`; reuse the same
     tick-cache behavior contract as `MetaTraderClient` (`use_cache=True` goes through
     `market_data/tick_cache.py` with a cache key that includes the provider, so remote and
     native entries never collide).
   - `get_ticks` / `get_recent_ticks`: derive from the columnar call the same way
     `LocalParquetClient` does (reuse its conversion helpers rather than duplicating them; if
     they are private to `clients/local.py` or `clients/metatrader.py`, move them to a neutral
     shared module — the design doc sanctions this cleanup).
   - `get_available_ohlcv_range` → `OhlcvAvailableRange`; `get_symbol_info` (404 → `None`);
     `search_symbols`.
   - Every request sends `X-Gateway-Token` when a token is configured. Gateway error bodies
     (`{"error", "code"}`) map to the same exception types `MetaTraderClient` raises in the
     equivalent situation (`ConnectionError` for `mt5_unavailable`/network failure,
     `ValueError` for bad params).
3. Timeout discipline: health = ~1s; data calls = generous but bounded (30s default,
   overridable via constructor). A timeout raises `ConnectionError` — never hangs.

## Guardrails

> This WO does not wire the client into `MarketDataService` or routing — WO185 does. No edits
> to `service.py`, `routing.py`, `api/storage_jobs.py`.
> Timestamp convention is sacred: raw epochs from the wire are converted with the existing
> `market_data/timezone.py` helpers only. No new timezone code.
> No new dependencies (`httpx` + `numpy` only).

## Tests

`tests/market_data/test_remote_client.py` — an in-process fake gateway (stdlib
`ThreadingHTTPServer` on port 0 serving canned JSON + `.npz` built with
`np.savez_compressed`), plus fixtures reused from `tests/market_data/test_local_provider.py`
where sensible:

- `isinstance(RemoteMt5Client(...), MarketDataProvider)` (runtime-checkable protocol);
- `get_ohlcv` round-trip: known raw epochs → expected naive-Brasília `OHLCV.time` values
  (assert equality with `unix_seconds_to_brasilia_naive(epoch)`); absent `spread` column →
  `spread is None`;
- `get_ticks_columnar` round-trip: keys, dtypes, values; empty result → `_empty_ticks_columnar`
  shape;
- health caching: unreachable URL → first `is_available()` fast-fails, second returns within
  the cache window without a new request (count requests in the fake);
- schema major mismatch (fake reports `"2.0"`) → unavailable + logged error;
- gateway 503 `mt5_unavailable` → `ConnectionError`; 400 → `ValueError`; token sent when
  configured;
- `runtime_config`: `"remote"` accepted by `set_data_source`, URL/token getters honor env
  precedence (extend `tests/storage` coverage where `runtime_config` is already tested).

## Docs

Docstrings on `RemoteMt5Client` and the new runtime-config keys (mention `Q_MT5_GATEWAY_URL`
/ `Q_MT5_GATEWAY_TOKEN` in `q_backend/README.md`'s environment table if one exists).

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must include:
the constructor/config resolution order (env vs runtime config), the exception mapping table,
and which shared helpers (if any) were moved out of `clients/metatrader.py`/`clients/local.py`
into a neutral module.

## Out of scope

Service/routing/ingest integration and fetch-through caching (WO185); Wine setup (WO186);
any change to `/v1/` wire semantics (that belongs to WO183 and would bump the schema version).
