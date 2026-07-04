# WO188 — Backend: coverage-aware OHLCV reads (local fast path, gateway fills gaps)

## Shared context (read first)

Part of the WO188–WO190 "gateway feeds the whole app" batch, building on the shipped
WO183–186 remote-gateway work — read `docs/design/mt5-remote-gateway.md` first. The gateway
is validated end-to-end on the Storage page. The problem now is efficiency of everything
else: in `auto` mode the routing preference is **native MT5 → remote gateway → local
parquet**, so while the gateway is reachable _every_ OHLCV read (each new backtest range,
each Market-page chart window) downloads the full requested range over the Wine HTTP
gateway, even when local parquet already covers it. Fetch-through persists the bars, but the
next different range re-downloads again. This WO makes local parquet the fast path and uses
the gateway only for what is actually missing.

Backend repo: `q_backend`, Python managed with `uv` (`uv run pytest` — never pip/poetry).
Paths relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `src/q_backend/market_data/routing.py` — `resolve_ohlcv_source` (range-agnostic; in auto,
  remote wins whenever the gateway is healthy), `has_local_ohlcv`
- `src/q_backend/market_data/service.py` — `get_ohlcv` / `_resolve_ohlcv_provider` /
  `_fetch_through_ohlcv` (write-behind persist of remote reads),
  `get_available_ohlcv_range`
- `src/q_backend/market_data/local_store.py` — `available_range(symbol, timeframe)`
  (the envelope), `read_ohlcv`, `write_ohlcv` (merges into year-partitioned parquet —
  overlapping writes are safe)
- `src/q_backend/tasks/data.py` — the per-job OHLCV parquet cache (unchanged; it sits above
  this layer)
- `tests/market_data/test_routing.py`, `tests/market_data/test_fetch_through.py` — the
  existing contracts to preserve

## Goal

```python
# service.get_ohlcv, auto mode, remote resolved:
#   local envelope covers [start, end]        -> read local, zero gateway calls
#   partial coverage                          -> fetch ONLY missing head/tail from gateway,
#                                                fetch-through persist, then read local
#   no local data                             -> full remote fetch (today's behavior)
```

## Tasks

1. New helper in `src/q_backend/market_data/routing.py` (or a sibling `coverage.py` if
   `routing.py` gets crowded):
   `plan_ohlcv_read(symbol, timeframe, start, end) -> CoveragePlan` — a small dataclass with
   `serve_from: Literal["local", "provider"]` and `missing: list[tuple[datetime, datetime]]`
   (0–2 segments: head `[start, local.start)` and/or tail `(local.end, end]`), computed from
   `local_store.available_range`. Envelope coverage is the contract: internal holes
   (weekends, holidays, session gaps) are trusted, consistent with how Storage ingestion
   already reasons about ranges — no bar-count heuristics.
2. `MarketDataService.get_ohlcv`: when `resolve_ohlcv_source` picks `remote` **and the
   configured source is `auto`**, apply the plan — fetch only the missing segments via the
   remote client, `_fetch_through_ohlcv` each (write_ohlcv merges), then serve the full
   range with `local_store.read_ohlcv`. Reading back from local after the merge is
   deliberate: one dedup/ordering path, and the returned bars are exactly what later
   local-only runs will see (determinism). If a segment fetch raises `ConnectionError`
   mid-plan, degrade honestly: if local fully covers the range serve local, otherwise
   re-raise.
3. Explicit sources stay literal: `local` → local only, `mt5` → native only, `remote` →
   always full-range gateway fetch with today's fetch-through (the user explicitly asked for
   the gateway; don't second-guess). Coverage planning applies to `auto` only.
4. `auto` + gateway down + local covers the range: must serve local without raising (this
   already works via routing falling to `local`; add a regression test since step 2 touches
   the path).
5. Leave `get_available_ohlcv_range` as-is (in auto it reports the provider's — i.e. the
   gateway's — full server range, which is what the Backtests/Market date pickers should
   see). Leave the tick paths (`get_ticks*`) as-is.

## Guardrails

> Determinism: "one data load per run" is preserved — `tasks/data.py`'s per-job cache is
> untouched and still sits above this layer. A given `[start, end]` read returns bars from
> the local store after (at most one round of) gap-filling; repeated identical reads with no
> new server data are pure local reads.
> `_fetch_through_ohlcv` stays best-effort for persist failures, but note the interaction:
> if the parquet write fails, step 2 cannot serve the merged range from local — in that case
> fall back to stitching remote segments + local bars in memory for this read (log a
> warning), never silently drop bars.
> Timestamp convention is sacred: all comparisons in naive-Brasília datetimes, no new
> timezone code.
> No changes to the gateway server (`q_backend/gateway/mt5_gateway.py`) or the `/v1/` wire
> contract.

## Tests

`tests/market_data/test_coverage_plan.py` (new) + extensions to `test_routing.py` /
`test_fetch_through.py`, using a counting fake remote client:

- fully covered range → served from local, **zero** remote calls;
- tail gap only (request end beyond local end) → exactly one remote call for `(local.end,
end]`, merged bars persisted, full range returned;
- head gap, and head+tail combined;
- empty local store → single full-range remote fetch (behavior identical to today);
- gateway `ConnectionError` mid-tail-fetch with local covering the range → local served,
  no raise; without coverage → raises;
- persist failure (monkeypatched `write_ohlcv` raising) → in-memory stitched result equals
  the merged expectation, warning logged;
- explicit `remote` source → full-range gateway fetch even when local covers (literal
  semantics preserved).

## Docs

Update the routing docstring at the top of `routing.py` (it currently documents "remote
wins when reachable") and the corresponding paragraph in
`q_frontend/docs/design/mt5-remote-gateway.md` with the coverage-plan behavior.

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must
include: the `CoveragePlan` semantics (fields + the 4 auto-mode cases), the degrade matrix
(gateway down / persist failed × covered / not covered), and confirmation that explicit
`local`/`mt5`/`remote` behavior is byte-identical to before. This lands in production the
moment the API/workers restart — no config change; `auto` simply gets cheaper.

## Out of scope

Routing research pipelines that bypass the service entirely (WO189); tick coverage
planning; gateway server changes; live E2E validation (WO190).
