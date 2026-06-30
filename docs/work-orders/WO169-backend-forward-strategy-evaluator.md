# WO169 — Backend: incremental closed-bar strategy evaluator

## Shared context (read first)

Read `docs/design/paper-live-execution.md` and WO167's completion contract. This WO reuses the existing
strategy runtime for forward decisions; it must not turn the historical backtest loop into a daemon.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- WO167 completion message
- `src/q_backend/backtesting/strategy.py`
- `src/q_backend/backtesting/factory.py`
- `src/q_backend/backtesting/engine.py`
- `src/q_backend/backtesting/exit_strategy.py`
- `src/q_backend/backtesting/position_sizing.py`
- `src/q_backend/market_data/service.py`
- `src/q_backend/market_data/clients/metatrader.py`
- strategy causality and engine tests under `tests/backtesting/`

## Goal

Evaluate immutable saved strategies once per newly completed M15/H1 bar with bounded data work,
decision parity, and replay-safe recovery state.

## Tasks

1. Create `src/q_backend/execution/bar_coordinator.py` that groups active deployments by
   `(symbol, timeframe)`, fetches only new completed bars, excludes MT5's forming bar, and shares each
   fetched frame across consumers.
2. Create `src/q_backend/execution/evaluator.py` that builds through the existing strategy factory,
   maintains a bounded rolling window, computes required indicator/exit columns, and evaluates only
   the newest completed bar.
3. Reuse current entry, exit-rule, and position-sizing semantics. Convert the durable execution
   position into the minimal `Trade` view required by existing strategy/exit interfaces.
4. Compute and document the warm-up/window bound from strategy metadata and enabled exits. Reject a
   deployment whose bound cannot be determined rather than loading unbounded history.
5. Add recovery replay that reconstructs stateful exits from persisted position/decision history and
   bars without emitting orders during replay.
6. Emit one typed decision result with source bar close, signal/reason, sizing inputs, strategy/config
   hash, and per-phase timing.

## Guardrails

- Evaluate completed bars only; never use the forming bar.
- Do not call `BacktestEngine.run()` and do not fork a second strategy DSL.
- No full-history reload in steady state and no data fetch per deployment when symbol/timeframe match.
- Recovery replay cannot create decisions or orders.
- Scope is M15 and slower. Tick/sub-second execution remains explicitly unsupported.
- No broker calls, worker leases, REST, or frontend code.

## Tests

- Decision parity fixtures compare the same closed bars against the existing engine's queued signal
  semantics for representative built-in, composite, and stateful-exit strategies.
- Forming-bar mutation cannot change the decision.
- Duplicate/new-bar delivery produces one evaluation per close timestamp.
- Two deployments sharing symbol/timeframe trigger one market-data fetch.
- Rolling windows remain bounded over a long synthetic stream.
- Restart/replay restores trailing/time-stop state without emitting orders.
- Benchmark indicator/evaluator phases for CCM$ H1, WIN$ H1, and WDO$ M15 fixtures.
- Run causality/strategy tests and full `uv run pytest`.

## Docs

Paste the evaluator input/output contract, warm-up calculation, and benchmark readings for WO170.

## Definition of done

Q can produce causal, deduplicatable forward decisions from its existing strategies with bounded
steady-state work and documented parity.

## Out of scope

Fills, account ledger, risk pipeline, deployment daemon, API, frontend, and sub-second execution.
