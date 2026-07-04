# WO189 — Backend: research pipelines read through the routed service (no more direct `local_store` reads)

## Shared context (read first)

Part of the WO188–WO190 batch; **runs after WO188** (it relies on coverage-aware
`MarketDataService.get_ohlcv`). Read `docs/design/mt5-remote-gateway.md`.

The gateway feeds anything that goes through `MarketDataService` — backtests, discovery,
optimization, Market-page charts, Storage ingestion. But five research modules import
`local_store.read_ohlcv` **directly**, so on Linux they silently compute on stale parquet
even when the gateway could serve fresh data: feature-matrix builds, feature evaluation
runs, feature evidence, autoencoder training/gating, and alpha-research preflight. This WO
gives them one shared read-through seam.

Backend repo: `q_backend`, Python managed with `uv` (`uv run pytest` — never pip/poetry).
Paths relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

The five direct readers (every `local_store.read_ohlcv` import outside `market_data/`):

- `src/q_backend/features/matrix.py` (two call sites: the indexed-frame loader and the raw
  bars path)
- `src/q_backend/features/evaluation_service.py`
- `src/q_backend/features/evidence_service.py`
- `src/q_backend/neural/gate.py`
- `src/q_backend/alpha_research/preflight.py`

The service seams:

- `src/q_backend/market_data/service.py` — `get_ohlcv` (after WO188: local fast path,
  gateway gap-fill in auto mode)
- `src/q_backend/api/dependencies.py` — the API-process `market_data_service` singleton
- `src/q_backend/tasks/worker_context.py` — `get_worker_market_data_service()` (per
  Dramatiq-worker-process service; lazily created)
- `tests/conftest.py` — the autouse fixture that isolates tests from a live dev gateway
  (clears `Q_MT5_GATEWAY_URL`, no-ops `load_env`, swaps the dependencies singleton's remote
  client) — your tests inherit this; don't fight it

## Goal

```python
# src/q_backend/market_data/read_through.py
def read_ohlcv_fresh(symbol, timeframe, start, end, *, service=None) -> list[OHLCV]:
    """local_store.read_ohlcv drop-in that routes through MarketDataService,
    so coverage gaps are gap-filled from the gateway when one is reachable."""
```

All five modules call this instead of `local_store.read_ohlcv`; offline behavior is
unchanged (local parquet, exactly as today).

## Tasks

1. Create `src/q_backend/market_data/read_through.py` with `read_ohlcv_fresh` as above.
   Service resolution when `service is None`: the already-initialized Dramatiq worker
   service if this process has one (expose a non-creating peek in `worker_context`, e.g.
   `peek_worker_market_data_service() -> MarketDataService | None` — do **not** trigger
   lazy creation just to answer the question), else the `api.dependencies` singleton.
   Return type/shape must match `local_store.read_ohlcv` exactly so call sites only change
   the import.
2. Swap the import + call in the five modules (six call sites). No other logic changes in
   those files — same ranges, same downstream processing.
3. Graceful degrade must be inherited, not reimplemented: with no gateway and no native MT5,
   `read_ohlcv_fresh` must behave exactly like `local_store.read_ohlcv` (auto mode falls to
   local). If any of the five modules would now raise where it previously returned empty
   (e.g. explicit `remote` source with the gateway down), catch `ConnectionError` in
   `read_ohlcv_fresh` and fall back to `local_store.read_ohlcv` with a warning — research
   pipelines must never become un-runnable offline.

## Guardrails

> One data load per run: these pipelines already front-load their bars once per run — do
> not add refresh calls inside loops, epochs, or per-feature iterations. The read-through
> happens exactly where the old `read_ohlcv` call happened.
> Determinism/PIT: gap-filling only _extends_ local data before the run reads it; it never
> mutates bars a previous run saw (`write_ohlcv` merges by bar time). Evaluation-run
> reproducibility contracts (recorded data ranges, lockbox boundaries, leakage exemptions
> in `tests/leakage_exemptions.py`) are untouched — if any test there needs edits, stop and
> flag it instead.
> `strategy_builder/registry.py` imports `_OHLCV_COLUMNS` (a schema constant, not a read) —
> leave it alone.
> `execution/` stays out of scope entirely (live execution is native-MT5-on-Windows).

## Tests

`tests/market_data/test_read_through.py` (new):

- with an injected fake service, `read_ohlcv_fresh` returns the service's (gap-filled)
  bars and matches `local_store.read_ohlcv`'s shape/ordering contract;
- `ConnectionError` from the service → falls back to local bars + warning;
- worker-context resolution: initialized worker service is preferred; otherwise the
  dependencies singleton; `peek_worker_market_data_service` never lazily creates.

Plus one seam test per consumer (in their existing test homes under `tests/features/`,
`tests/neural/`, and the alpha-research tests): monkeypatch `read_ohlcv_fresh` and assert
the pipeline consumes its output — proving the swap actually happened and pinning it
against regression to a direct `local_store` import. Cheap invariant check to add to one of
them: `grep`-style assertion that no module outside `market_data/` imports
`local_store.read_ohlcv` (mirror how other structural tests in the suite do this, if any;
otherwise a small test walking `src/q_backend` sources).

## Docs

Docstring on `read_ohlcv_fresh` (resolution order, degrade behavior). One paragraph in
`q_frontend/docs/design/mt5-remote-gateway.md` §consumers: "research pipelines read through
the service as of WO189".

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must
include: the list of swapped call sites (file:line before/after), the service-resolution
order, and the degrade behavior table. Production trigger: none needed — the swap is live
on the next API/worker restart; state explicitly in the final message that the invariant
test guards against future direct-read regressions.

## Out of scope

Coverage planning itself (WO188); tick reads; `execution/`; changing what ranges the
pipelines request or any feature/evaluation semantics; live E2E validation (WO190).
