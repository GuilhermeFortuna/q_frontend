# WO159 — Backend: B3 session, regime, and multi-timeframe context features

## Shared context (read first)

Read `docs/design/instrument-specific-alpha-research.md`. Depends on WO158's current-code primitive
registration/generation contract. This WO supersedes WO43 and adds the multi-timeframe context needed
by the three approved research profiles.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- WO158 completion message and changed files
- `src/q_backend/backtesting/genome/node_specs.py`
- `src/q_backend/backtesting/genome/composite_strategy.py`
- `src/q_backend/backtesting/genome/param_bounds.py`
- `src/q_backend/backtesting/genome/operators.py`
- `src/q_backend/features/registry.py`
- `src/q_backend/features/compute.py`
- `src/q_backend/market_data/api_service.py`
- `src/q_backend/market_data/timezone.py`
- `src/q_backend/optimization/backtest_runner.py`
- `tests/market_data/test_timezone.py`

## Goal

Expose causal context that lets strategies distinguish market state instead of applying one technical
rule indiscriminately across every bar.

Required feature families:

1. Session/calendar: minutes from session open, normalized time of day, day of week, month of year,
   and a configurable session-window boolean gate.
2. Regime: trailing volatility percentile, normalized trend strength/slope, and range-compression
   percentile.
3. Prior-session context: previous session high/low/close, distance from those levels normalized by
   ATR, overnight/session gap, and opening-range high/low after a configurable completed range.
4. Higher-timeframe context: completed D1 trend, D1 volatility, and previous D1 levels aligned onto
   H1/M15 bars without reading an incomplete future daily bar.

## Tasks

1. Add a shared B3 session-context module that derives session IDs and completed-session aggregates
   from timezone-normalized timestamps. Session parameters remain explicit in run configuration.
2. Add the context primitives to the genome registry/evaluator/parameter bounds and Feature Store.
3. Extend the backtest/discovery frame preparation seam to attach context columns once per run, before
   candidate evaluation. Reuse the resulting frame across Optuna trials and GA candidates.
4. Make the primitives reachable through WO158's generation metadata without hardcoded additions to
   individual mutation functions.
5. Add profile-neutral metadata describing availability delay and required source columns.

## Guardrails

- Previous-session values become visible only after that session closes.
- A D1 feature on an intraday bar uses the last fully completed D1 bar, never the current incomplete
  daily aggregate.
- Opening-range levels are unavailable until the configured range has completed.
- Calendar features describe time; they must not embed a learned performance lookup table.
- Do not hardcode CCM/WIN/WDO strategy rules here; WO161 owns hypotheses.
- No duplicated OHLCV loads per candidate or per Optuna trial.

## Tests

- Prefix-causality tests for every context family.
- Boundary tests at B3 session open/close, day transitions, holidays/missing sessions, and timezone
  normalization.
- Explicit regression proving an H1/M15 bar cannot see its current D1 close/high/low.
- Frame-load call-count test proving context is computed once per run.
- Random-genome reachability and Feature Store parity tests.
- Run targeted genome, feature, market-timezone, walk-forward, and strategy-search suites, then full
  `uv run pytest`.

## Docs

Update the design doc with the final context-node IDs, parameters, and availability-delay table.

## Definition of done

All required context is causal, cached per run, visible to both feature evaluation and strategy
genomes, and exercised by seeded generation.

## Out of scope

Cross-symbol data (WO160), instrument hypotheses (WO161), feature evidence thresholds (WO162), and
external crop/fundamental datasets.
