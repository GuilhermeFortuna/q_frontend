# WO35 — Backend: parallel optimization core (ask/tell process pool)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this batch ("Parallel Optimization"):** the Optimize tab runs a single Optuna
study, and today every trial runs **strictly one at a time** on one core. The inner backtest
is a pure-Python bar-by-bar loop (`src/q_backend/backtesting/engine.py`, the
`for i in range(len(chunk))` loop) — CPU-bound and **GIL-bound**, so Optuna's thread-based
`n_jobs` gives no speedup. A 50–200-trial study leaves a 16-core/32-thread machine ~97% idle.
This batch parallelizes trials across **processes**.

**Proven precedent — read it before designing anything.** Walk-forward analysis was just
parallelized at the window level using exactly the pattern this WO reuses: a
`ProcessPoolExecutor` whose workers receive the OHLCV frame **once** via a pool initializer,
and a shared `resolve_worker_count(max_workers, units)` helper. See
`src/q_backend/optimization/walkforward.py` (the `_run_parallel`, `_init_worker`,
`_run_window_worker`, `resolve_worker_count` symbols) and
`src/q_backend/optimization/backtest_runner.py`
(`DefaultBacktestRunner.load_sliced_frame` / `from_frame_sliced`). Mirror that style.

This work order builds the **compute core** only — no API route, no DB, no Redis (WO36 wires
those). It is backend-only.

---

## How optimization works today (read these files)

- `src/q_backend/optimization/runner.py` — `OptimizationRunner(config, backtest_runner)`.
  `run()` calls `study.optimize(self._objective, n_trials=...)`. `_objective(trial)` does the
  whole unit of work: `suggest_params(trial, search_space)` → `validate_trial_params` →
  `_build_backtest_config` → `backtest_runner.run(...)` → `set_user_attr` of
  `status`/`metrics`/`strategy_params`/`risk_params` (+ `result.trial_user_attrs`) →
  `resolve_objective`. **Preserve this user_attr contract exactly** — walk-forward
  (`walkforward.py` reads `best_trial.user_attrs["strategy_params"|"risk_params"|"metrics"]`)
  and results serialization both depend on it.
- `src/q_backend/optimization/storage.py` — `load_or_create_study` (sampler/pruner/storage).
- `src/q_backend/optimization/sampler_factory.py` — `create_sampler` builds `TPESampler`,
  `RandomSampler`, or `NSGAIISampler` (multi-objective default). **You will need to pass
  `constant_liar=True` to `TPESampler` in the parallel path** (see guardrail below).
- `src/q_backend/optimization/backtest_runner.py` — `DefaultBacktestRunner`. The optimizer
  currently builds it via `from_market_data` (returns the **full** frame, ignores slice —
  single-range study). `from_frame_sliced(df)` already exists (WO23) and, for a single-range
  study where every trial's `start`/`end` equal the backtest range, returns the full frame —
  reuse it in workers.
- `src/q_backend/optimization/exceptions.py` — `ExpectedTrialFailure` (→ pruned).
- `src/q_backend/optimization/objectives.py` — `resolve_objective`, `worst_objective_value`.

---

## Goal

`OptimizationRunner` gains a **parallel execution path** that fans trials out across worker
processes via Optuna **ask/tell**, while the sequential path stays the default and unchanged.
The main process keeps ownership of the study, sampler, and the per-trial callback (so WO36's
progress/persistence keep working); workers only run backtests.

## Design (ask/tell + process pool)

Optuna's supported multiprocessing model is _not_ `study.optimize(n_jobs=N)` (threads).
Use **ask/tell** with the study owned by the main process:

```
workers = resolve_worker_count(max_workers, n_trials)
loop until n_trials dispatched or should_stop():
    batch = [study.ask() for _ in range(min(workers, remaining))]
    for trial in batch:
        params = suggest_params(trial, search_space)   # cheap, in main
        validate_trial_params(...)
        cfg    = _build_backtest_config(params)         # picklable dataclass
        submit _run_backtest_worker(cfg) to the pool    # expensive, in worker
    as each future returns (metrics, trades, trial_user_attrs) OR a failure tag:
        set trial user_attrs (status/metrics/strategy_params/risk_params + extras)
        study.tell(trial, objective_value | state=PRUNED/FAIL)
        fire callback(study, frozen_trial)              # WO36 hooks progress/DB here
```

- **Workers run only the backtest.** Ship the picklable `BacktestRunConfig` to the worker;
  the worker builds a `DefaultBacktestRunner.from_frame_sliced(_WORKER_OHLCV)` over the
  pool-initializer frame and returns `(metrics, trades, trial_user_attrs)` or a failure tag
  (`pruned`/`error` + reason). Param suggestion stays in the main process (it advances the
  sampler — it must not happen in workers).
- **Pool initializer ships the frame once per worker** (`initargs=(df,)`), exactly like
  `walkforward._init_worker`. Module-level worker fn + module-global frame (Windows uses
  `spawn`, so no closures/lambolas across the boundary).
- **Force inner `parallel_mode=SEQUENTIAL`** in the worker's config copy — a trial is already
  in its own process; the engine's DAY_TRADE `ProcessPoolExecutor` would oversubscribe.
  (Same reasoning as `walkforward._run_window_worker`.)
- **Translate failures to `tell`:** `ExpectedTrialFailure` / zero-trades →
  `study.tell(trial, state=optuna.trial.TrialState.PRUNED)`; unexpected error with
  `continue_on_trial_error` → record failure + `tell` the worst objective (mirror
  `_objective`'s existing except-blocks); without it, re-raise.
- **Cancellation:** accept `should_stop: Callable[[], bool] | None`. Check it at each batch
  boundary; stop asking, let the in-flight batch finish, cancel not-yet-started futures.
  (Mirrors the walk-forward cancel hook.)

## Tasks

### 1. Shared worker-count helper

`resolve_worker_count` currently lives in `walkforward.py`. Promote it to a neutral home
both modules import — e.g. `src/q_backend/optimization/parallel.py` — and re-export from
`walkforward.py` so WO23/WO24 callers and tests stay green. (Single source of truth: auto =
`os.cpu_count()` capped by the unit count, never < 1.)

### 2. Parallel runner path

Add the ask/tell parallel executor. Keep it cohesive — either a private
`OptimizationRunner._run_parallel(...)` mirroring `walkforward`'s structure, or a sibling
`ParallelTrialExecutor` the runner delegates to. `OptimizationRunner.__init__` gains an
optional `ohlcv: pd.DataFrame | None = None`; `run()` chooses parallel when a frame is
present and the resolved worker count > 1, else the existing sequential
`study.optimize(...)` path **unchanged**. Return the same `OptimizationResult`
(study, best_params, best_trial, pareto_trials, failures).

> **GUARDRAIL — TPE quality under parallelism.** Batched ask() samples trials that can't see
> each other's results, which makes plain TPE propose near-duplicates. In the parallel path,
> build the TPE sampler with `constant_liar=True`. Keep batch size == worker count. State
> clearly in a docstring that **parallel results are NOT byte-identical to sequential**
> (sampler sees results in a different order) — so tests assert _comparable best objective_,
> not equality. This is the key difference from walk-forward (whose windows were exactly
> equivalent).

> **GUARDRAIL — preserve the user_attr contract.** After each `tell`, the resulting
> `FrozenTrial` must carry the same `user_attrs` keys the sequential path sets
> (`status`, `metrics`, `strategy_params`, `risk_params`, plus `result.trial_user_attrs`).
> Set them on the trial **before** `study.tell`. A test must assert a parallel best trial's
> `user_attrs` matches the sequential contract (walk-forward's `_run_single_window` reads
> them).

### 3. Pruning + tick scope

- **Pruning:** intermediate-value pruning (median/hyperband) needs in-trial reporting, which
  this batch-parallel model does not provide. If `pruner != "none"` **and** the parallel path
  is selected, log a warning and run the parallel path with pruning disabled (the
  prune-by-exception path — zero trades / `ExpectedTrialFailure` — still works via `tell`).
  Document it; full parallel pruning is out of scope.
- **Tick engine:** `TickBacktestRunner` loads 1–4M-tick arrays; sharing those across
  processes is a separate problem. The parallel path is **candle-only**. The runner must not
  attempt to parallelize a tick study — leave that to the sequential path (WO36 decides which
  runner/frame it hands in; here, simply: no frame ⇒ sequential).

### 4. Tests

- `resolve_worker_count` still imports from `walkforward` (no break) and from its new home.
- Parallel vs sequential over synthetic deterministic data (small search space, ~12 trials,
  `max_workers=2`): both complete all trials; both find a **comparable** best objective
  (assert parallel best ≥ sequential best − ε for maximize, mutatis mutandis); parallel best
  trial's `user_attrs` carry `strategy_params`/`risk_params`/`metrics`.
- Failure handling: a worker that raises with `continue_on_trial_error=True` is recorded in
  `failures` and does not abort; without it, the run raises.
- Cancellation: `should_stop` flips true after the first batch → no further trials asked.
- Multi-objective (NSGA-II) parallel run returns a non-empty `pareto_trials`.
- Determinism note proven: do **not** assert byte-identical trial order (would be a false
  contract).
- Existing optimization + walk-forward tests green and unmodified.

### 5. Docs

Update `q_backend/README.md`: a short "Parallel optimization" note under the optimization
section (process-based ask/tell, `constant_liar`, candle-only, the quality/speed tradeoff).

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Sequential path is byte-for-byte the default when no frame is supplied.
- In your final message, paste: the new/changed `OptimizationRunner` signature, the worker
  return contract `(metrics, trades, trial_user_attrs | failure-tag)`, and where
  `resolve_worker_count` now lives — **WO36 wires the job layer against this.**

## Out of scope

- API routes, Redis progress, Postgres persistence, `max_workers` config field, `workers`
  status payload (all WO36).
- Any frontend change (WO37).
- Tick-engine parallelism; full parallel pruning; distributed / multi-machine Optuna storage.
