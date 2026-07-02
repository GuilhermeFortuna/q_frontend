# WO175 — Backend: deployment live chart endpoint (bars + strategy indicators)

## Shared context (read first)

Read `docs/design/paper-live-execution.md` and the WO169/WO171 completion contracts. The Execution
workspace can start/pause/stop a paper deployment but shows nothing about *what the strategy sees*.
This WO exposes a read-only chart payload per deployment: the same bounded OHLCV window the forward
evaluator consumes, augmented with the strategy's own indicator series, serialized in the exact
shape the backtest chart already uses. The value proposition is **parity** — the chart must be
computed through the identical code path the worker evaluates, never a frontend re-implementation.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- `src/q_backend/execution/evaluator.py` — `_augmented_frame()` is the parity-critical indicator
  path (strategy `compute_indicators` + exit-rule ATR/Donchian augmentation)
- `src/q_backend/execution/warmup.py` — `compute_window_bound_bars`
- `src/q_backend/execution/strategy_build.py` — `build_strategy_from_compiled`
- `src/q_backend/backtesting/chart_data.py` — `serialize_chart_data` (target payload shape)
- `src/q_backend/backtesting/strategy.py` — `ChartIndicatorSpec` / `get_chart_indicators`
- `src/q_backend/api/routers/execution.py` and `src/q_backend/api/schemas/execution.py`
- `src/q_backend/api/routers/market.py` — how OHLCV reads funnel through `MarketDataService`
  (WO47 provider router: must work in `mt5` and `local` modes)
- `tests/api/test_execution_api.py`, `tests/execution/test_evaluator.py`

## Goal

`GET /api/v1/execution/deployments/{id}/chart` returns completed bars plus the deployment
strategy's indicator series so the frontend can render, in real time, exactly what the worker
evaluates on each bar close.

## Tasks

1. Extract the evaluator's exit-rule indicator augmentation (`_augmented_frame`'s ATR/Donchian
   completion) into a shared helper (e.g. `execution/indicator_frame.py`) called by **both** the
   evaluator and the new endpoint, so the two paths cannot drift.
2. Add `GET /api/v1/execution/deployments/{id}/chart` with query param `bars` (display bars,
   default 200, bounded max 1000):
   - resolve the deployment's immutable identity (symbol, timeframe, `compiled_config`);
   - fetch `bars + compute_window_bound_bars(compiled_config)` completed bars through
     `MarketDataService` (forming bar excluded, matching evaluator semantics);
   - `build_strategy_from_compiled` → shared augmentation helper → `serialize_chart_data`;
   - trim the returned payload to the last `bars` bars **after** indicator computation, so
     leading warm-up NaNs never reach the display window.
3. Response schema: reuse/mirror the backtest chart shapes (`bars: [{timestamp, open, high, low,
   close, volume}]`, `indicators: [{key, label, pane, color, values}]`) plus additive metadata:
   `symbol`, `timeframe`, `last_bar_close_time`, `next_bar_close_time` (for the frontend
   countdown), and `window_bound_bars`.
4. Cache the computed payload in-process keyed on `(deployment_id, bars, last completed bar open
   time)`; 5-second polling must not recompute indicators until a new bar lands.
5. Degrade honestly: deployment not found → 404; market data unavailable (MT5 down in `mt5` mode,
   empty local store in `local` mode) → 503 with a clear detail message, never a 500 or an empty
   200.

## Guardrails

- Read-only: no worker state, no evaluator instance, no order/lifecycle mutation, no broker call.
- Indicator math goes through the shared helper — no duplicated ATR/Donchian/`compute_indicators`
  logic in the router.
- No bars or indicator series persisted to Postgres (compute-and-return only).
- Market data reads funnel through `MarketDataService` (works under `auto`/`mt5`/`local`).
- Existing execution endpoints stay byte-compatible; the new endpoint is strictly additive.
- Bounded work: `bars` capped, window bound reused — never full-history loads.

## Tests

- Parity test: for a seeded window, the endpoint's indicator values at each bar equal the values
  the `StrategyEvaluator` sees for the same bars (drive both through the shared helper with a
  known strategy config).
- Payload shape test: keys/panes/colors come from `get_chart_indicators`; warm-up NaNs serialize
  as `null`; display trim returns exactly `bars` bars with fully-warmed indicators.
- Cache test: two requests with an unchanged last bar compute indicators once (call-count spy);
  a new completed bar invalidates.
- 404 / 503 degradation tests (unknown deployment, market data provider raising).
- Existing evaluator tests green and unmodified after the helper extraction.
- OpenAPI smoke plus full `uv run pytest`.

## Docs

Update the backend endpoint inventory and **paste the complete chart JSON contract** (one real
payload with at least two indicators on different panes) in the completion message — WO176 builds
the entire frontend against it.

## Definition of done

Polling the endpoint during a running paper deployment returns the strategy's true indicator
series over the evaluator's window, recomputed only on new bars, in a shape the existing chart
stack can render.

## Out of scope

WebSockets/streaming, tick-resolution charts, frontend work (WO176), decision/fill markers (the
frontend composes those from existing endpoints), and any worker changes beyond the helper
extraction.
