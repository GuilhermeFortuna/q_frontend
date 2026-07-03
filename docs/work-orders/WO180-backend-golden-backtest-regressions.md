# WO180 — Backend: golden backtest regressions and backtest↔live parity lock-down

## Shared context (read first)

Part of the WO177–WO182 hardening batch (no new features). The backtest engine's numbers are the
foundation every other system (optimization, discovery, research acceptance, paper trading) builds
on. Today a subtle change to indicator warm-up, exit evaluation order, sizing, or cost handling
would pass the unit suite while shifting every result. This WO pins current behavior down so drift
becomes a loud diff instead of silent corruption.

Backend repo: `q_backend`, Python managed with `uv` (`uv run pytest`).

## Files to read

- `src/q_backend/backtesting/` (engine, `models.py`, `strategy.py`, exit-rule registry,
  `genome/composite_strategy.py`)
- `tests/backtesting/test_genome_parity.py` (existing pattern: fixed-seed `_synthetic_ohlcv`,
  registry fixtures — reuse this synthetic-data approach)
- `src/q_backend/execution/parity.py`, `src/q_backend/execution/evaluator.py`, and
  `tests/execution/test_evaluator.py` (existing backtest↔live parity reference)
- `src/q_backend/optimization/tick_backtest_runner.py` and `tests/backtesting/tick/`

## Goal

```
tests/backtesting/goldens/
  ma_crossover_h1_atr_exit.json      # full expected output, committed
  composite_genome_mixed_exits.json
  ...
```

A parametrized golden suite: canonical strategy configs run on committed deterministic synthetic
data, and the _complete_ output — every trade's entry/exit time, price, direction, size, pnl, and
the summary metrics — is compared field-for-field against a committed golden file.

## Tasks

1. Build the golden harness in `tests/backtesting/test_goldens.py`: deterministic synthetic OHLCV
   (fixed seed, generated in-test like `test_genome_parity.py` does — do not commit large data
   files), run config → normalized JSON (sorted keys, ISO timestamps, floats rounded to 10 decimal
   places), compare to `tests/backtesting/goldens/<case>.json` with a full structural diff on
   failure.
2. Choose 8–12 canonical cases spanning the surface: at least one classic strategy
   (MACrossover-style), one CompositeStrategy genome with context features, multi-entry
   composition (OR/AND/Majority via the signal manager), each _category_ of exit rule (stop
   family, target family, time/session family, indicator family), long+short, and one
   position-sizing variant. One tick-engine case through `tick_backtest_runner`.
3. Add a regeneration path: `uv run pytest tests/backtesting/test_goldens.py --regen-goldens`
   (pytest flag via `conftest.py`) rewrites the files. Regeneration is a deliberate act — the diff
   shows up in git and must be justified in the commit/WO message that regenerates.
4. Extend backtest↔live parity from its current hand-picked cases to the full registry: for every
   registered entry strategy and enabled exit rule combination in the golden cases, feed the same
   synthetic frame bar-by-bar through `execution.evaluator.StrategyEvaluator` and assert the queued
   signals match the backtest engine's trades (same timestamps, directions, prices), using
   `execution/parity.py` as the reference extractor.
5. Verify determinism explicitly: run each golden case twice in-process and assert identical
   output; any nondeterminism found (dict ordering, uncontrolled RNG, wall-clock leakage) is a bug
   to fix in this WO.

## Guardrails

> This WO must not change engine behavior. If writing a golden exposes a bug, fix the bug only if
> it is unambiguous and small; otherwise commit the golden documenting current behavior and record
> the finding in the final message for a follow-up WO. Pinning wrong-but-known beats unpinned.
> Golden files are committed and reviewed like code; no golden is regenerated without a stated
> reason.
> One data load per case; synthetic data only — no network, no market data service.

## Tests

The golden suite itself, plus: tamper test (mutate one trade field in memory → suite fails with a
readable diff), determinism double-run test, and the registry-wide parity assertions from Task 4.
Full `uv run pytest` stays green.

## Docs

Short section in `q_backend/README.md`: what the goldens cover, how to regenerate, and the rule
that regeneration requires justification.

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must list the golden
cases with one line each on what surface it pins, and any behavior discrepancies found while
writing them (especially backtest↔live parity mismatches).

## Out of scope

Discovery/optimization pipeline smoke (WO182). Performance benchmarking. Adding new engine
capabilities. Cost/slippage model changes.
