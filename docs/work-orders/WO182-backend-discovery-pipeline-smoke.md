# WO182 — Backend: deterministic discovery-pipeline smoke and job-lifecycle hardening

## Shared context (read first)

Closes the WO177–WO182 hardening batch (no new features). Unit tests cover discovery's pieces;
nothing exercises the full production path — API job start → GA search → persistence → results
payload — as one deterministic artifact. That path is where cross-cutting bugs live (wiring, run
records, latents seam, cancellation), and it is also the path the WO153–157 A/B validation work
depends on being trustworthy.

Backend repo: `q_backend`, Python managed with `uv` (`uv run pytest`).

## Files to read

- `src/q_backend/api/strategy_search_jobs.py` (job layer, `reconcile_orphaned_runs`)
- `src/q_backend/optimization/strategy_search.py`, `genetic_search.py`, `genetic_parallel.py`
- `src/q_backend/backtesting/genome/score_bias.py` and `latent_universe.py` (WO150–152 seam)
- `tests/optimization/test_genetic_search.py` (`test_genetic_search_end_to_end`,
  `test_provider_deterministic_initial_population` — the building blocks to compose)
- `tests/api/test_strategy_search_persistence.py`
- `src/q_backend/api/lifespan.py` (orphan reconciliation wiring)

## Goal

One pytest module any agent can run to answer "is discovery healthy end-to-end?":

```
tests/integration_smoke/test_discovery_smoke.py
  test_discovery_job_completes_and_is_deterministic
  test_discovery_with_latents_enabled_uses_latent_nodes
  test_cancellation_mid_run_leaves_consistent_state
  test_orphaned_run_reconciled_on_startup
  test_failed_candidates_are_accounted_for
```

## Tasks

1. Build the smoke fixture: tiny synthetic OHLCV (fixed seed, in-test generation as in
   `test_genome_parity.py`), a small but real GA config (e.g. population 8, 3 generations), data
   provider faked at the same seam production uses — the job layer, persistence, and search code
   run unmodified.
2. `test_discovery_job_completes_and_is_deterministic`: start through the job layer, run to
   completion, assert run record status/results are persisted and sane (leaderboard non-empty,
   every genome validates, metrics finite); run twice with the same seed and assert identical
   leaderboards. Any nondeterminism found is a bug to fix here (thread scheduling in
   `genetic_parallel` counts — the deterministic path may need the serial executor; if so, assert
   the parallel path is deterministic at least in _set_ of evaluated candidates and document why).
3. Latents seam: with a PRODUCTION PCA model registered (no torch), assert the same smoke run seeds
   latent genome nodes and completes; with `latents_enabled=False` (WO153 seam), assert it doesn't.
   This is the regression net under the WO153–157 A/B harness.
4. Cancellation and crash lifecycle: cancel mid-generation → run record ends cancelled, no zombie
   threads/processes, partial results consistent; simulate a dead worker (run record left
   `running`, process gone) → `reconcile_orphaned_runs` marks it cancelled, and assert every job
   family wired in `lifespan.py` shares the reconciliation behavior (parametrize over the seven
   `*_jobs` modules rather than testing one).
5. Failed-candidate accounting: inject a data-provider failure for some candidates and assert the
   run completes with the failure count/reasons in its result payload (this consumes the contract
   WO179 establishes for `genetic_search.py:208` — if WO179 hasn't landed, implement the minimal
   counting here and note it).
6. Keep it fast: the whole module under ~60s so it stays in the default suite; mark it
   `integration` only if it genuinely needs Postgres (prefer the same test-DB approach
   `tests/api/test_strategy_search_persistence.py` already uses).

## Guardrails

> Production code paths only — no test-only orchestration shortcuts; the point is to exercise the
> real wiring. Faking is allowed only at data-provider and clock seams.
> Fixed seeds everywhere; a flaky smoke test is worse than none. If a source of flake can't be
> removed, fail the WO rather than adding retries.
> No network, no MT5, no live market data.

## Tests

This WO is tests, plus whatever determinism/lifecycle bugs they expose (fix in-WO if small; report
for follow-up if not — same rule as WO180).

## Docs

`q_backend/README.md`: one paragraph — "Discovery smoke suite: what it proves, how to run it."

## Definition of done

`uv run pytest` passes including the new module — do not report completion until it does. Final
message must state: smoke runtime, whether the parallel path is fully deterministic (and the
documented contract if not), and any lifecycle bugs found.

## Out of scope

The A/B payoff experiments themselves (WO154–157). Walkforward/optimization-specific smoke beyond
the shared orphan-reconciliation parametrization. Golden numeric pinning (WO180). Performance
tuning of the GA.
