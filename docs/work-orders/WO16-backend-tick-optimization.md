# WO16 — Backend: tick-engine optimization runner (load ticks once, reuse across trials)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** the tick-data backtest engine (WO12–WO14) is live for single runs.
This work order makes it usable by the **Optuna optimizer**, so users can search tick-strategy
parameters (periods, SL, TP, sizing) the same way they optimize candle strategies. The key
enabler is that the WO13 kernel is fast enough to run hundreds of trials — _provided we load
the (huge) tick set once and reuse it across every trial_ instead of refetching from MT5 per
trial. This is a **follow-up**: it depends on WO13 (engine) and WO14 (request plumbing) but
not WO15. It is **backend only.**

**Prerequisites shipped:**

- WO12: `MarketDataService.get_ticks_columnar(symbol, start, end, flags) -> dict[str,
np.ndarray]` + on-disk parquet tick cache.
- WO13: `TickBacktestEngine`, `build_tick_strategy`, `TickArrays`, `engine="tick"` strategy
  registry tagging.
- WO14: the API records `engine="tick"` in the backtest config; tick strategies are tagged in
  `GET /api/v1/strategies`.

---

## How optimization works today (read these files)

- `src/q_backend/optimization/backtest_runner.py`:
  - `BacktestRunner` Protocol (~line 37): `run(config: BacktestRunConfig) -> BacktestRunResult`.
  - `DefaultBacktestRunner` (~line 41): the candle runner. **`from_market_data` (~line 50)**
    is the pattern to mirror: it fetches OHLCV **once** on the caller thread, closes over the
    DataFrame in a `data_provider`, and every trial reuses it (MT5 must be used from the thread
    that initialized it; optimization runs on a worker thread — so data is loaded up front and
    cached in memory). `run()` (~line 102) builds strategy + sizer, runs `BacktestEngine`, and
    computes metrics via `build_equity_curve` / `compute_extended_metrics`.
- `src/q_backend/optimization/runner.py`:
  - `OptimizationRunner` (~line 34) takes a `BacktestRunner` and, per trial,
    `_build_backtest_config(trial_params)` (~line 43) → `backtest_runner.run(config)`. It is
    **runner-agnostic** — it only depends on the `BacktestRunner` Protocol and
    `BacktestRunConfig` fields. A tick runner that satisfies the same Protocol drops in here.
- `src/q_backend/optimization/models.py` — `OptimizationConfig` + its `backtest` sub-config
  (the source of symbol/timeframe/strategy/etc.). Note where `parallel_mode`/`day_trade`
  fields live; a tick config needs an analogous shape.
- `src/q_backend/api/optimization_jobs.py` (and/or where studies are started in
  `api/main.py`) — where `DefaultBacktestRunner` is constructed and handed to
  `OptimizationRunner`. **This is where you branch** on engine to construct the tick runner.
- `src/q_backend/optimization/metrics.py` — `build_equity_curve`, `compute_extended_metrics`.
  Reuse as-is; tick trades produce the same closed-trade shape.
- `src/q_backend/optimization/search_space.py` — `suggest_params`,
  `build_position_sizing_config`. Tick strategy params come from the same
  `StrategyParamSpec` registry, so the search space machinery is unchanged.

---

## Goal

Optimization studies can target `engine="tick"`: ticks for the study's symbol/range are
loaded **once** (via the WO12 loader + cache) and every Optuna trial reruns the WO13 kernel
against the in-memory `TickArrays` with that trial's params. Metrics, persistence, and the
study API are otherwise unchanged.

## Tasks

### 1. `TickBacktestRunner` satisfying the `BacktestRunner` Protocol

Add (in `backtest_runner.py` next to `DefaultBacktestRunner`, or a sibling
`tick_backtest_runner.py`) a runner with the same `run(config) -> BacktestRunResult` shape:

- A `from_market_data(market_data_service, *, symbol, start, end, flags) -> TickBacktestRunner`
  classmethod mirroring `DefaultBacktestRunner.from_market_data`: call
  `get_ticks_columnar(...)` **once** on the caller thread, build `TickArrays`, close over it.
  Raise `ValueError("No tick data found ...")` on empty, matching the candle runner.
- `run(config)`:
  1. `strategy = build_tick_strategy(config.strategy, config.strategy_params, config.symbol)`.
  2. `registry = TickBacktestEngine(strategy, sizing, initial_capital, point_value)
.run(self._ticks, parallel_mode=DAY_TRADE)`.
  3. `closed = registry.get_closed_trades()`; `base = registry.get_performance_metrics(...)`;
     reuse `build_equity_curve` + `compute_extended_metrics` exactly as the candle runner does
     (same args: capital, start, end, backtest_days). Return `BacktestRunResult(metrics=...,
trial_user_attrs={"total_trades": ...})`.

> **GUARDRAIL — load once, reuse N times.** The MT5 fetch (and cache read) happens **once** in
> `from_market_data`, on the request/caller thread. `run()` must never call
> `get_ticks_columnar` or touch MT5 — it only runs the kernel over the already-loaded arrays.
> A test must assert the loader is called exactly once across many `run()` calls.

### 2. Tick fields on the optimization backtest config

- Extend the optimizer's backtest sub-config (`models.py`) additively with
  `engine: Literal["candle","tick"] = "candle"`, `display_timeframe` (not needed for metrics
  but recorded for parity), and `tick_flags`. Mirror how `BacktestRunConfig` already carries
  the per-trial fields in `runner._build_backtest_config`.
- `_build_backtest_config` in `runner.py` passes these through unchanged for tick studies (the
  `BacktestRunConfig` may also gain `engine`/`tick_flags` additively, or the tick runner can
  ignore `timeframe`).

### 3. Branch runner construction on engine

Where a study is started (`api/optimization_jobs.py` / `main.py`): if the study's backtest
config has `engine == "tick"`, construct `TickBacktestRunner.from_market_data(...)` instead of
`DefaultBacktestRunner.from_market_data(...)`, then hand it to `OptimizationRunner`. Everything
downstream (trial loop, pruning, persistence, results API) is unchanged.

> **GUARDRAIL — back-compat.** A study with no `engine` (or `engine="candle"`) constructs the
> existing `DefaultBacktestRunner` and behaves identically. No existing optimization config
> field changes shape. Verify with the existing optimization tests untouched + green.

### 4. Tests

- `TickBacktestRunner.run` over synthetic in-memory `TickArrays` returns a `BacktestRunResult`
  with the expected metric keys; `from_market_data` calls `get_ticks_columnar` **once** and
  reuses the arrays across multiple `run()` calls (assert call count == 1).
- A small end-to-end optimization over a tick strategy (2–3 trials, synthetic ticks via a
  faked `market_data_service`) completes and produces a best trial — no MT5, no per-trial
  fetch.
- Candle optimization path unchanged (existing tests green, unmodified).

### 5. Docs

Update `q_backend/README.md`: note that optimization supports `engine="tick"` and that ticks
are loaded once per study and reused across trials (cache-backed).

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- The candle optimization path is provably unchanged.
- In your final message, note: the `TickBacktestRunner` construction site, the
  load-once-reuse-N guarantee (and the test that proves it), and any optimizer-UI follow-up
  for the frontend (WO15 deferred tick optimization UI).

## Out of scope

- Any frontend change (the tick optimization UI is a separate follow-up; WO15 deferred it).
- New optimization metrics, objectives, or pruning logic — reuse the existing machinery.
- New persistence tables / migrations.
- Streaming / live data. Pyramiding / trailing stops (kernel scope is fixed by WO13).
