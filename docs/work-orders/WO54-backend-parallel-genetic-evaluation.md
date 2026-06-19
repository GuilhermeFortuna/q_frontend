# WO54 — Backend: parallel candidate evaluation in the genetic orchestrator

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "GA Discovery quality". A diagnosis of Discovery history showed
each run evaluates only ~144 genomes (`population_size=24 × generations=6`) in ~7 minutes, with
**no upward fitness trend** — the GA needs a **bigger evaluation budget** to explore, but the
operator chose to **buy budget with parallelism, not wall-clock**. Today
`GeneticStrategySearchOrchestrator.run` (`src/q_backend/optimization/genetic_search.py`)
evaluates a generation's candidates **strictly serially** (`for candidate_index, candidate in
enumerate(candidates): ... evaluate_candidate(...)`), leaving a many-core machine idle.

**Proven precedent — read it before designing anything.** Two layers of this codebase are already
process-parallel with the exact pattern to reuse:

- **WO35** parallelized Optuna _trials_ across processes via a `ProcessPoolExecutor` whose workers
  receive the OHLCV frame **once** through a pool initializer, plus a shared
  `resolve_worker_count(max_workers, units)` helper.
- **Walk-forward** parallelized _windows_: see `src/q_backend/optimization/walkforward.py`
  (`_run_parallel`, `_init_worker`, `_run_window_worker`, `resolve_worker_count`) and
  `src/q_backend/optimization/backtest_runner.py` (`from_frame_sliced` / `load_sliced_frame`).

This WO adds a **third** parallel layer at the **candidate** level inside one generation, mirroring
that style. Evolution itself (`provider.report`) stays single-threaded and deterministic — only the
embarrassingly-parallel evaluation of a generation's genomes fans out. Backend only; no API/UI.

Design: `docs/design/genetic-strategy-search.md` §4.3 + the WO35 parallel design doc.

---

## How the pieces work today (read these files)

- `src/q_backend/optimization/genetic_search.py`
  - `GeneticStrategySearchOrchestrator.run(progress_callback, should_stop)` — outer
    `for _ in range(genetic.generations)`; inner **serial** loop over `provider.candidates()`
    calling `evaluate_candidate(candidate, self._eval_config, self.backtest_runner, ohlcv=...,
progress_callback=..., should_stop=...)`; then `self._generations.append(...)` +
    `provider.report(results)`.
  - The injected `backtest_runner` carries the full OHLCV as `_df` (one load per run).
  - There is **already** a distributed per-generation path (`src/q_backend/tasks/
genetic_staging.py` with `provider.export_state()`/`load_state()` round-tripping through
    Redis). **Do not break it** — see guardrail.
- `src/q_backend/optimization/walkforward.py` — the canonical `ProcessPoolExecutor` +
  `_init_worker` (pool initializer ships the frame once) + `resolve_worker_count` pattern to copy.
- `src/q_backend/optimization/backtest_runner.py` — `from_frame_sliced(df)` to rebuild a runner
  inside a worker from the frame the initializer placed in module globals.
- `evaluate_candidate` (`strategy_search.py`) — the pure unit of work to run per candidate; **a
  walk-forward per candidate, itself window-parallelizable** (oversubscription risk — task 3).

---

## Goal

```python
# One generation's genomes evaluated concurrently across processes, OHLCV shipped once per worker.
results = evaluate_generation_parallel(
    candidates, eval_config, ohlcv,
    max_workers=genetic.max_workers, should_stop=..., progress_callback=...,
)
provider.report(results)     # evolution stays single-threaded + deterministic
```

Identical ranked output to the serial path (determinism), meaningfully lower wall-clock, and a
larger default budget that the parallelism now affords.

## Tasks

### 1. Parallel generation evaluator

Add `evaluate_generation_parallel(...)` (mirror `walkforward._run_parallel`):
`ProcessPoolExecutor` with a pool **initializer** that stashes the OHLCV frame in a module global
(ship the frame **once per worker**, never per task); each task rebuilds a `BacktestRunner` via
`from_frame_sliced` and calls `evaluate_candidate` **unchanged**. Submit one task per candidate;
collect results and **reassemble in candidate order** (results carry `candidate_id`).

### 2. Wire it into the orchestrator behind a flag

In `run`, replace the inner serial loop with `evaluate_generation_parallel` when
`genetic.max_workers != 1`; keep the serial loop as the `max_workers == 1` default-safe path
(used by deterministic tests and the distributed staging worker). `provider.report` and
`self._generations.append` stay exactly where they are — **evolution does not move into workers.**

### 3. Worker-count coordination (avoid oversubscription)

Each candidate's `evaluate_candidate` runs a walk-forward that **can itself** go window-parallel.
Running both layers at full width oversubscribes cores. Use `resolve_worker_count` to **split the
budget**: default to candidate-level parallelism with **window-level parallelism forced to 1**
inside workers (genomes-per-generation ≫ windows, so candidate fan-out wins). Make the split
explicit and configurable; document the chosen policy.

### 4. Progress + cancellation across the pool

Aggregate `SearchProgress` from workers back to `progress_callback` (reuse the Redis
log-forwarding convention from WO40/walk-forward — workers push, the parent forwards). Honor
`should_stop` between submitted candidates and **between generations**; on stop, cancel pending
futures and return a partial-but-ranked result (same contract as the serial path).

### 5. Config + budget bump (additive to `GeneticSearchConfig`)

```python
max_workers: int | None = None   # None -> resolve_worker_count(cpu, population_size); 1 -> serial
```

Now that wall-clock is amortized, raise the **defaults** for a real exploration budget — propose
`population_size` ~40–60 and `generations` ~12–15 (keep within existing `Field` bounds; justify
the numbers from a measured per-candidate cost × worker count ≈ prior wall-clock). Keep them
configurable; do not exceed the validated bounds.

## Guardrails

> **`evaluate_candidate` is read-only.** Workers call it verbatim. If you need to change it to
> parallelize, stop — the WO31/WO35 premise is zero semantic change to the evaluator.

> **OHLCV loads once per worker, never per task.** Ship the frame via the pool initializer (module
> global), exactly like `walkforward._init_worker`. A test asserts the frame is materialized once
> per worker, not once per candidate.

> **Determinism is non-negotiable.** Evolution (`provider.report`: RNG, tournament, crossover,
> mutation, `genome_id` assignment) runs **only in the parent, single-threaded**, after the whole
> generation's results are collected and **reordered by candidate_id**. Parallel and serial runs
> with the same `init_seed` must produce **identical** population trajectories and identical ranked
> results. Add a test that asserts byte-for-byte parity.

> **Don't break the distributed staging path.** `genetic_staging.py` evaluates a generation in a
> worker via `export_state`/`load_state`. Keep that path working (it can run with `max_workers=1`
> per staged generation, or adopt the same evaluator — your call, but its tests must stay green).

## Tests — `tests/optimization/test_parallel_genetic.py`

- **Serial/parallel parity:** same `init_seed`, `max_workers=1` vs `>1` → identical per-generation
  `genome_id` sequences and identical `_rank_results` output (determinism regression).
- **One frame per worker:** pool initializer materializes OHLCV once per worker (spy on the
  loader), not once per candidate.
- **No oversubscription:** with candidate-level parallelism on, window-level worker count resolves
  to 1 inside workers (assert via `resolve_worker_count` inputs).
- **Cancellation:** `should_stop` mid-generation cancels pending futures and returns a partial,
  ranked result.
- **Speedup smoke (non-flaky):** parallel path completes a small multi-gen run; assert correctness,
  not a hard timing threshold.
- **Staging path green:** existing `genetic_staging` tests unmodified and passing.
- Existing genetic-search / walk-forward / WO35 parallel tests green and **unmodified**.

## Docs

`q_backend/README.md`: extend the genetic section + the parallelism note — candidate-level
process parallelism evaluates a generation concurrently (OHLCV shipped once per worker), evolution
stays single-threaded/deterministic, and the worker budget is split with walk-forward to avoid
oversubscription. Note the raised default population/generations.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Serial/parallel determinism parity test passes; staging path untouched and green.
- Paste in the final message: the `evaluate_generation_parallel` signature, the worker-count split
  policy, the new `max_workers` field + chosen default `population_size`/`generations`, and a
  measured wall-clock before/after on a sample run.

## Out of scope

- Graded fitness — **WO52**. Trade-viability/pre-screen — **WO53** (the pre-screen runs in the
  parent before fan-out, or in-worker; coordinate, don't reimplement).
- Operators / diversity — **WO55** / WO46.
- API route, Redis schema changes beyond reusing the existing progress convention, UI — separate WOs.
- GPU / distributed-across-machines execution.
