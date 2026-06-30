# WO160 — Backend: causal cross-instrument context for WIN$ and WDO$

## Shared context (read first)

Read `docs/design/instrument-specific-alpha-research.md`. Depends on WO158 and may run in parallel with
WO159 after WO158 merges. This WO supersedes WO44 for the currently available local data. Initial
scope is deliberately narrow: WIN$ and WDO$ context only.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- WO158 completion message
- `src/q_backend/market_data/service.py`
- `src/q_backend/market_data/api_service.py`
- `src/q_backend/market_data/timezone.py`
- `src/q_backend/optimization/backtest_runner.py`
- `src/q_backend/api/strategy_search_jobs.py`
- `src/q_backend/backtesting/genome/node_specs.py`
- `src/q_backend/backtesting/genome/composite_strategy.py`
- `src/q_backend/features/compute.py`
- `src/q_backend/features/matrix.py`

## Goal

Allow a single-instrument strategy to read explicitly lagged, backward-aligned context from another
instrument without ever opening a position in that context instrument.

Required initial recipes:

- Exogenous close and return over a bounded lookback.
- Exogenous normalized return/z-score.
- Rolling correlation and relative-strength spread between primary and exogenous returns.
- Exogenous direction/volatility regime boolean or oscillator gates.

Initial allowed mappings:

- Trading WIN$ H1 may use WDO$ H1 context derived causally from WDO$ M15 if necessary.
- Trading WDO$ M15 may use WIN$ M15 context.
- CCM$ H1 has no exogenous requirement in v1.

## Tasks

1. Add `ExogenousSeriesConfig` to the research/search configuration: symbol, source timeframe,
   resampling rule, availability lag, and requested recipes.
2. Load each required symbol/timeframe once on the caller thread. Align with `merge_asof(direction=
"backward")` after applying the configured availability lag; reject forward or negative lags.
3. Attach namespaced exogenous columns to the reused evaluation frame and expose typed genome nodes
   plus Feature Store recipes referencing only those columns.
4. Persist the exact source range, timeframe, lag, and content fingerprint in run artifacts.
5. Fail the data preflight clearly when overlap or continuity is insufficient; do not silently fill a
   multi-month gap.

## Guardrails

- The engine still trades only `backtest.symbol`; exogenous symbols never become positions.
- No contemporaneous forward join, bidirectional interpolation, or backfill from a future bar.
- Resampling uses completed source bars only.
- One market-data load per symbol/timeframe per research run.
- Disabled/empty exogenous configuration leaves existing search behavior unchanged.
- Do not add unavailable ES/NQ, futures-curve, order-flow, or fundamental data in this WO.

## Tests

- Planted lead/lag series proving only the configured past exogenous value is visible.
- Prefix causality and negative-lag rejection.
- H1-from-M15 resampling boundary test using only completed M15 bars.
- One-load-per-symbol call-count test across multiple candidates and trials.
- No-overlap, stale-series, and large-gap preflight failures.
- Regression proving the request cannot cause trades in the exogenous symbol.
- Run targeted market-data, genome, Feature Store, walk-forward, and strategy-search tests, then full
  `uv run pytest`.

## Docs

Record the exact join/lag semantics and the initially supported WIN/WDO mappings in the design doc.

## Definition of done

WIN and WDO strategies can consume reproducible, causally aligned context from each other with source
provenance and no additional traded instrument.

## Out of scope

CCM external fundamentals, ES/NQ, PETR4/VALE3, portfolio strategies, data acquisition, hypothesis
templates (WO161), and research orchestration (WO164).
