# WO185 — Backend: `remote` routing, fetch-through cache, ingest provider switch

## Shared context (read first)

Part of the WO183–WO186 remote-gateway batch; read `docs/design/mt5-remote-gateway.md`
(in `q_frontend/docs/design/`). WO183 delivered the gateway server, WO184 the
`RemoteMt5Client` + `remote` config value. This WO makes the backend actually use it:
routing preference **native MT5 → remote gateway → local parquet**, fetch-through persistence
into the parquet store, and the ingestion job switched off its hardcoded `mt5_client`.

Backend repo: `q_backend`, Python managed with `uv` (`uv run pytest` — never pip/poetry).

## Files to read

- `src/q_backend/market_data/service.py` — `MarketDataService.__init__` (~55),
  `_resolve_provider` (~78), `active_provider` (~98), `_resolve_ohlcv_provider` (~145),
  `get_ohlcv`/`get_ticks_columnar` (~160/177)
- `src/q_backend/market_data/routing.py` — `resolve_ohlcv_source` (returns
  `Literal["local","mt5"]` today), `has_local_ohlcv`, `symbol_selectable_in_mt5`
- `src/q_backend/market_data/clients/remote.py` (WO184)
- `src/q_backend/api/storage_jobs.py` — `_run_bars_ingest` (~118, hardcoded
  `service.mt5_client.get_ohlcv` at ~143), `_run_ticks_ingest` (~184, hardcoded
  `get_ticks_columnar` at ~211)
- `src/q_backend/market_data/local_store.py` — `write_ohlcv` (~282), `write_ticks` (~461)
- `src/q_backend/api/routers/market.py` — the data-source endpoint that surfaces
  `active_provider()`
- `tests/market_data/test_routing.py`, `tests/market_data/test_provider_abstraction.py`

## Goal

```python
# service.py — auto mode preference, per design doc:
# native MT5 (supported + connected) -> remote gateway (configured + healthy) -> local parquet
service = MarketDataService()
service.active_provider()   # -> Literal["mt5", "remote", "local"]
service.acquisition_provider()  # -> MetaTraderClient | RemoteMt5Client (for ingest), raises
                                # ConnectionError when neither is reachable
```

## Tasks

1. `MarketDataService.__init__` constructs `self._remote_client = RemoteMt5Client()`.
   Extend `_resolve_provider`, `_resolve_ohlcv_provider`, `active_provider` with the third
   branch. Explicit `data_source="remote"` behaves like explicit `"mt5"` does today: if no
   gateway URL is configured, raise `ConnectionError` with an actionable message; if
   configured but unhealthy, let the call surface the `ConnectionError` (no silent fallback —
   consistent with the existing explicit-`mt5` policy and WO179's silent-failure rules).
2. `routing.resolve_ohlcv_source` returns `Literal["local","mt5","remote"]`. `auto` logic:
   keep today's shape, inserting remote between mt5 and local — prefer `mt5` when the terminal
   is connected and the symbol selectable; else `remote` when `service._remote_client
.is_available()`; else `local` when `has_local_ohlcv(...)`; a symbol with no local data and
   no reachable provider keeps today's behavior for missing data (resolve to the best
   available acquirer so the error is honest, not a silent empty result).
3. Fetch-through cache in `MarketDataService`: when the resolved OHLCV/tick provider is the
   remote client, persist what it returned before handing it back — `local_store.write_ohlcv(
symbol, timeframe, bars)` / `local_store.write_ticks(symbol, arrays)`. Best-effort:
   wrap in try/except, log a warning with symbol/timeframe on failure, never fail the read
   (annotate per the WO179 exception policy). Native-MT5 reads keep today's behavior
   (unchanged); local reads obviously don't re-write.
4. `api/storage_jobs.py`: replace both `service.mt5_client...` call sites with a new public
   `MarketDataService.acquisition_provider()` — native client when supported+available, else
   remote client when available, else raise `ConnectionError("no acquisition provider:
MetaTrader5 not installed and no reachable gateway")`. Update the two error strings that
   say "from MT5" to name the actual provider. Production trigger (cutover guardrail): this
   is the existing Storage-page ingest job — already wired via `actors.run_storage_ingest`;
   no new trigger needed, but verify the job runs end-to-end on a Linux box with only a
   gateway configured.
5. The data-source API endpoint that validates/echoes sources must accept `"remote"`
   (`set_data_source` already does after WO184 — verify the router doesn't keep its own enum)
   and `active_provider()`'s new `"remote"` value must serialize cleanly through the existing
   response model.

## Guardrails

> Nothing under `src/q_backend/execution/` is touched. `execution/quote_source.py` keeps using
> `service.mt5_client` — live quotes never come from the gateway.
> Fetch-through is write-behind, best-effort, and read-path-safe: a parquet write failure must
> never fail or alter the data returned to the caller.
> One conversion convention: bars persisted via fetch-through must be byte-identical to bars
> ingested natively (same `OHLCV` models in, same `write_ohlcv` path — no re-serialization
> shortcuts).
> Determinism: backtests/GA that resolve to `local` must be unaffected by whether a gateway
> is configured.

## Tests

Extend `tests/market_data/test_routing.py` and `tests/market_data/test_provider_abstraction.py`,
new `tests/market_data/test_fetch_through.py`; use a stub `RemoteMt5Client` (monkeypatched
attribute on the service) rather than real HTTP:

- `auto` resolution matrix: (native up, remote up) → `mt5`; (native down, remote up) →
  `remote`; (both down, local data) → `local`; explicit `remote` with no URL → `ConnectionError`;
- explicit `local` never touches the remote client (assert no `is_available` calls);
- fetch-through: remote `get_ohlcv` result lands in a tmp-path local store via `write_ohlcv`
  and `read_ohlcv` returns identical bars (reuse `test_local_store.py` fixtures); a
  `write_ohlcv` raise is swallowed + logged and the caller still gets the bars;
- tick fetch-through analog via `write_ticks`;
- `acquisition_provider()`: native > remote > `ConnectionError`; `_run_bars_ingest` with a
  stub service whose acquisition provider is the remote stub completes and writes the store
  (extend the existing storage-jobs test module under `tests/api` or `tests/storage`,
  wherever `_run_bars_ingest` is covered today — add coverage there if it is not).

## Docs

Update the routing docstring in `market_data/routing.py` and the design doc's status line
(`docs/design/mt5-remote-gateway.md` → mark WO183–185 landed when done).

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must include:
the final `auto` resolution order as implemented (paste the branch), the fetch-through call
sites, and confirmation that `grep -rn "mt5_client" src/q_backend/api/storage_jobs.py` is
empty.

## Out of scope

Frontend Storage/Settings UI exposure of the `remote` source and gateway URL field (backlog —
the API contract from this WO is its input). Wine setup + systemd (WO186). Snapshot/instrument
raw-`mt5.*` calls in `market_data/api_service.py` (deferred per design doc).
