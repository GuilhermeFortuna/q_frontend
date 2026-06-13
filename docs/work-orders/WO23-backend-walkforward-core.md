# WO23 — Backend: walk-forward analysis core (rolling optimize → out-of-sample test)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** this batch ("Research Validation") adds walk-forward analysis —
the platform's first defense against overfitting. Today the Optuna optimizer
(`src/q_backend/optimization/`) searches parameters over a single date range and reports
in-sample results; nothing measures how those parameters perform on data they never saw.
Walk-forward fixes that: split the history into consecutive windows, optimize on each
**train** window, run the best parameters on the following **test** window, and stitch the
test segments into one out-of-sample equity curve — the only curve that deserves trust.
This work order builds the pure compute core (config, splitter, orchestrator). WO24 adds
the API/persistence, WO25 the frontend. It is **backend only** and must not touch any API
route or DB code.

---

## How optimization works today (read these files)

- `src/q_backend/optimization/models.py` — `OptimizationConfig` (study/objective/backtest/
  search_space). `BacktestConfig` carries `start`/`end`; note the `_to_naive_local`
  normalization validator.
- `src/q_backend/optimization/runner.py` — `OptimizationRunner(config, backtest_runner)`:
  per trial, `_build_backtest_config` (~line 43) copies `backtest.start/end` into a
  `BacktestRunConfig` and calls `backtest_runner.run(...)`. Reuse this class **as-is**, one
  instance per train window — do not fork it.
- `src/q_backend/optimization/backtest_runner.py` — the key file:
  - `BacktestRunConfig` (~line 19) has `start`/`end` fields.
  - `DefaultBacktestRunner.from_market_data` (~line 59) fetches OHLCV **once** and closes
    over the DataFrame in a `data_provider` that **ignores `config.start/end`** (single-range
    studies never needed slicing). Walk-forward does: see the guardrail below.
  - `run()` (~line 111) computes metrics via `build_equity_curve` /
    `compute_extended_metrics` (`optimization/metrics.py`).
- `src/q_backend/optimization/objectives.py` — `resolve_objective`; the walk-forward
  per-window "best" is whatever the study's objective says it is.

---

## Goal

A `WalkForwardRunner` that, given an `OptimizationConfig` plus a `WalkForwardConfig`,
produces per-window results and a stitched out-of-sample summary — pure compute, in-memory,
no API/DB.

## Tasks

### 1. Config + window splitter — new `src/q_backend/optimization/walkforward.py`

```python
class WalkForwardConfig(BaseModel):
    train_days: int = Field(ge=1)          # length of each in-sample window
    test_days: int = Field(ge=1)           # length of each out-of-sample window
    mode: Literal["rolling", "anchored"] = "rolling"  # anchored: train always starts at backtest.start
    min_windows: int = Field(default=2, ge=1)

def split_windows(start: datetime, end: datetime, cfg: WalkForwardConfig) -> list[WalkForwardWindow]:
    ...  # WalkForwardWindow: index, train_start, train_end, test_start, test_end
```

- Windows step by `test_days` (test segments tile the history with no gaps/overlaps —
  required for honest stitching). The first train window starts at `start`; a final
  partial test window shorter than `test_days` is kept if ≥ 1 day.
- Raise `ValueError` (clear message) if the range yields fewer than `min_windows` windows.
- Pure function, exhaustively unit-testable: no I/O.

### 2. Range-slicing data provider

`DefaultBacktestRunner.from_market_data`'s closure returns the **full** DataFrame regardless
of `config.start/end`. For walk-forward, add a sibling classmethod
`DefaultBacktestRunner.from_market_data_sliced(...)` (same signature) whose `data_provider`
returns `df.loc[config.start : config.end]` — so one up-front fetch serves every window.

> **GUARDRAIL — load once, slice N times.** Exactly one `get_ohlcv` call per walk-forward
> run, on the caller thread (MT5 is thread-bound — same reasoning as
> `from_market_data`'s docstring). Windows slice the in-memory frame. A test must assert
> call count == 1 across a multi-window run. Do NOT modify the existing
> `from_market_data` — single-range studies keep their current behavior byte-for-byte.

### 3. `WalkForwardRunner`

```python
class WalkForwardRunner:
    def __init__(self, config: OptimizationConfig, wf_config: WalkForwardConfig,
                 backtest_runner: BacktestRunner): ...
    def run(self, progress_callback: Callable[[WalkForwardProgress], None] | None = None
            ) -> WalkForwardResult: ...
```

Per window `i`:

1. **Optimize in-sample:** deep-copy the `OptimizationConfig`, set `backtest.start/end` to
   the train window, suffix the study name (`f"{name}__w{i}"`), force
   `storage.type="memory"`, and run `OptimizationRunner(window_config, backtest_runner)`.
2. **Test out-of-sample:** take `best_trial`'s `strategy_params`/`risk_params` (they're in
   `trial.user_attrs` — see `runner.py` ~line 103), build a `BacktestRunConfig` for the
   **test** window via the same field mapping as `_build_backtest_config`, and call
   `backtest_runner.run(...)` once.
3. Record a `WalkForwardWindowResult`: window dates, `best_params`, `is_metrics`
   (best trial's metrics), `oos_metrics`, `oos_trades` (closed-trade list — extend
   `BacktestRunResult` additively with `trades: list | None = None`, populated by
   `DefaultBacktestRunner.run`; `None` default keeps every existing caller unchanged).
4. A window whose optimization finds no valid trial (all pruned / zero trades) is recorded
   with `status="no_result"` and skipped in aggregation — it must not abort the run.

After all windows, build the `WalkForwardResult`:

- `windows: list[WalkForwardWindowResult]`
- `oos_equity_curve`: `build_equity_curve` over the **concatenated OOS trades** from all
  windows, with the full `start`/`end` range and the original `initial_capital` (capital
  compounds across windows in date order).
- `oos_metrics`: `compute_extended_metrics` over the same concatenation.
- `efficiency`: aggregate OOS objective value ÷ mean in-sample objective value (the classic
  walk-forward efficiency ratio; guard division by zero → `None`).

`progress_callback` fires per phase (`window i/N optimizing` / `testing`) — WO24 forwards
it to Redis.

### 4. Tests

- `split_windows`: rolling vs anchored geometry, tiling (no OOS gap/overlap), partial last
  window, `min_windows` violation.
- `from_market_data_sliced`: one fetch, correct sub-frames per window (call-count spy).
- `WalkForwardRunner` end-to-end over synthetic data (deterministic strategy, 2–3 windows,
  2–3 trials each): per-window best params recorded; OOS trades all fall inside their test
  windows (**no train-window trade may leak into the OOS curve** — assert every OOS trade
  timestamp ∈ its window's test range); stitched curve starts at `initial_capital`.
- A `no_result` window is skipped without aborting.
- Existing optimization tests green and unmodified.

### 5. Docs

Update `q_backend/README.md`: a short "Walk-forward analysis" subsection under the
backtesting section (concept, rolling vs anchored, efficiency ratio).

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- In your final message, paste the `WalkForwardConfig`, `WalkForwardWindowResult`, and
  `WalkForwardResult` field lists — WO24 serializes them to the API and WO25 renders them.

## Out of scope

- API routes, Redis progress, Postgres persistence, lake writes (all WO24).
- Tick-engine walk-forward (`engine="tick"` may be rejected with a clear `ValueError` for
  now; candle only).
- Monte Carlo / deflated Sharpe / parameter-stability surfaces (later WOs in this phase).
- Parallelizing windows (sequential is fine; each window's trials already use the engine's
  own parallelism).
