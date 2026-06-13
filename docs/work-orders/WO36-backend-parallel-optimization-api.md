# WO36 — Backend: parallel optimization API wiring, config, and progress

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this batch ("Parallel Optimization"):** WO35 shipped the compute core — an
ask/tell `ProcessPoolExecutor` path inside `OptimizationRunner` that runs candle-engine trials
across worker processes when handed an in-memory OHLCV frame, sharing it via a pool
initializer. This work order **wires that into the existing study job lifecycle**: load the
frame once on the request thread (MT5 is thread-bound), hand it to the runner, surface a
`max_workers` config knob and a `workers` count in the status payload, and keep per-trial
progress + Postgres persistence firing correctly under parallel `tell`. It is **backend
only** (WO37 builds the frontend against the contract you paste).

**Prerequisite shipped:** WO35 (parallel optimization core + the worker-count helper home).

---

## How the optimization job lifecycle works today (read these files)

- `src/q_backend/api/optimization_jobs.py` — the job manager. `OptimizationJob` registry,
  module-level `ThreadPoolExecutor` (~line 114), `start_job` (~line 376) builds the runner
  via `DefaultBacktestRunner.from_market_data` (candle) or `TickBacktestRunner.from_market_data`
  (tick), `_make_progress_cb` (~line 431) fires per trial (updates `completed_trials`/
  `best_value`/`best_params`, persists the trial, calls `study.stop()` on cancel),
  `_run_job` (~line 463) runs the study and `_persist_study_finish` writes the snapshot.
- `src/q_backend/optimization/models.py` — `StudyConfig` (this is where `max_workers` goes,
  mirroring `WalkForwardConfig.max_workers` from the walk-forward batch).
- `src/q_backend/api/walkforward_jobs.py` — **the proven mirror.** Its `start_job` loads the
  frame once via `DefaultBacktestRunner.load_sliced_frame`, builds the runner with
  `from_frame_sliced`, computes `job.workers = resolve_worker_count(...)` only when it owns the
  frame, passes the frame into `_run_job` → `WalkForwardRunner(..., ohlcv=...)`, and exposes
  `workers` in `status_payload`. Copy this shape.

---

## Goal

The Optimize tab automatically uses all cores for candle studies, with the same endpoints and
the same status/results JSON plus two additive fields (`workers` in status; optional
`max_workers` in the request's study config). Tick studies and externally-injected runners
keep the sequential path.

## Tasks

### 1. Config — `max_workers` on `StudyConfig`

Add `max_workers: int | None = Field(default=None, ge=1)` to `StudyConfig` (mirror
`WalkForwardConfig.max_workers`: `None` = auto = one worker per CPU, capped by `n_trials`;
`1` = force sequential). Additive and backward-compatible — existing configs omit it.

### 2. Wire the frame + worker count into `start_job`

When `start_job` builds the runner itself (no injected `backtest_runner`) **and** the engine
is candle:

- Load the frame once on the request thread via
  `DefaultBacktestRunner.load_sliced_frame(market_data_service, symbol, timeframe, start, end)`
  (MT5 thread constraint — same reason walk-forward loads here).
- Build the runner with `DefaultBacktestRunner.from_frame_sliced(frame)`.
- Set `job.workers = resolve_worker_count(config.study.max_workers, config.study.n_trials)`.
- Pass the frame through to `_run_job` → `OptimizationRunner(config, runner, ohlcv=frame)`.

For the **tick** engine: keep `TickBacktestRunner.from_market_data`, no frame, `job.workers = 1`
(sequential — WO35 scoped tick parallelism out). For an **injected** `backtest_runner`
(tests): no frame, `job.workers = 1`.

> **GUARDRAIL — one fetch.** Exactly one `get_ohlcv` per study (call-count test), on the
> request thread. Do not refetch in `run()`. Mirror walk-forward's guarantee.

### 3. Progress + persistence under parallel `tell`

The per-trial callback (`_make_progress_cb`) must keep working when invoked from the main
process after each `study.tell`:

- `completed_trials`, `best_value`, `best_params` update as before.
- Each finished trial still persists via `_persist_trial` (best-effort).
- Cancellation: WO35's parallel path takes a `should_stop` callback — pass
  `lambda: job.cancel_requested`. (The callback's existing `study.stop()` is a no-op under
  ask/tell, so the `should_stop` hook is what actually stops the batch loop.) Verify cancel
  ends the run as `cancelled` with no further trials.

> **GUARDRAIL — fix the finish race while you're here.** `_run_job`'s `finally` sets
> `job.status` **before** `_persist_study_finish` writes the DB, so a watcher that reads the
> in-memory status after a restart-and-clear can see a stale `running` row. The walk-forward
> batch already fixed the identical bug in `walkforward_jobs._run_job` (persist with the
> terminal status first, then flip `job.status`). Apply the same ordering here:
> `_persist_study_finish(job, terminal_status)` → then `job.status = terminal_status` →
> then `_persist_progress(job)`. Add/extend a restart-rebuild test that would catch the race.

### 4. Status payload

Add `"workers": job.workers` to `status_payload` (and default it sensibly in
`status_payload_from_db` / the Redis-rebuilt payload — a finished run can report `1` or omit;
keep the key present for the frontend). `OptimizationJob` gains a `workers: int = 1` field.

### 5. Tests

- Candle study via a faked market data service runs in parallel (`max_workers=2`,
  small trials): completes, `status` reaches `done`, `workers == 2` in the status payload,
  `completed_trials == n_trials`, best params present; **one** `get_ohlcv` call.
- `max_workers=1` (or tick engine) → `workers == 1`, sequential path, results unchanged.
- Cancel mid-run → `cancelled`, fewer than `n_trials` completed, no crash.
- **Postgres stopped** (monkeypatch `session_scope` to raise): the parallel study still
  completes and live results serve from memory (global checklist item 1).
- Restart rebuild: clear the in-memory registry, status served from DB shows the terminal
  status (proves the race fix — run it several times for stability).
- Existing optimization endpoint/job tests green and unmodified.

### 6. Docs

Update `q_backend/README.md`: note `study.max_workers` in the optimize request and the
`workers` field in the status payload.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Existing `/api/v1/optimize*` endpoints and tests untouched and green.
- In your final message, paste the exact JSON: the optimize **request body** showing the new
  optional `study.max_workers`, and the **status payload** showing the new `workers` field —
  **WO37 builds the frontend against this message.**

## Out of scope

- Any frontend change (WO37).
- Tick-engine parallelism (sequential fallback only).
- New endpoints — reuse the existing optimize routes; this is additive plumbing.
