# WO177 — Both repos: restore green test baselines

## Shared context (read first)

This opens the WO177–WO182 hardening batch: no new features, only closing correctness and safety
gaps in paths that already exist. Nothing else in the batch can be trusted until both suites are
green, so this WO runs first.

Two repos: backend `q_backend` (Python, `uv` — run tests with `uv run pytest`, never pip/poetry);
frontend `q_frontend` (React/TS, `pnpm` — never npm/yarn).

## Baseline as measured on 2026-07-02

`uv run pytest`: **1 failed, 1268 passed.**

- `tests/storage/test_execution_repositories.py::test_execution_migration_revision_chain` — the
  test asserts `down_revision == "20260628_0013"` for head `20260630_0015`, but a migration
  `20260630_0014` now sits between them. The assertion is stale, not the chain.

`pnpm test:run`: **4 failed, 691 passed** (typecheck clean).

- `src/components/charts/__tests__/LiveStrategyChart.test.tsx` — "renders precomputed price
  overlays, skipping null warm-up points": the rendered SVG path contains `NaN` (WO176 surface).
- `tests/unit/components/CinematicScene.test.tsx` — "renders for the launcher workspace" and
  "pauses the canvas frameloop when the document is hidden".
- `tests/unit/lib/cinematic/cinematicQuality.test.ts` — "returns launcher profile with particles on
  the launcher workspace" (pure function, so this is a code/test drift, not an environment issue).

## Goal

Both suites pass, and each fix is a root-cause fix: diagnose whether the code or the test is wrong
before touching either.

## Tasks

1. Fix the migration-chain test: verify with `uv run alembic history` that the real chain
   `…0013 → …0014 → …0015` is linear and intentional, then update the test to assert the full
   current chain rather than a single hardcoded pair, so inserting the next migration updates one
   list instead of silently going stale.
2. Diagnose the `LiveStrategyChart` NaN: find which input (null warm-up point, empty domain, zero
   range) produces `NaN` in the path and fix the scale/guard in the component — a `NaN` that
   reaches an SVG path in a test will also reach it in the live execution chart.
3. Diagnose the cinematic failures: `resolveCinematicQuality` changed behavior for the launcher
   workspace at some point after the tests were written. Determine which behavior is intended (git
   history of `src/lib/cinematic/` vs the WO96–98 contracts), then align code or tests — do not
   blind-edit assertions to match current output.
4. Fix any additional failures encountered when running the full suites during this WO.

## Guardrails

> A test may only be changed when you can state why its expectation is wrong; paste that reasoning
> in the final message per test.
> No skipping, no `.todo`, no loosened tolerances.
> Do not refactor beyond what each fix requires — this WO is a stabilization pass.

## Tests

The suites themselves: `uv run pytest` in `q_backend`; `pnpm test:run` and `pnpm typecheck` in
`q_frontend`. Each fixed test must fail before the fix and pass after (state this explicitly).

## Docs

None.

## Definition of done

`uv run pytest` passes and `pnpm test:run` passes — do not report completion until both do. Final
message must state, per failure: root cause, whether code or test was wrong, and the fix.

## Out of scope

Everything else in the hardening batch: reconciliation (WO178), exception policy (WO179), golden
regressions (WO180), leakage invariants (WO181), discovery smoke (WO182). Warning cleanup (880
pytest warnings) except where a warning is the root cause of a failure — the parquet
`DataFrame.attrs` warning is handled in WO179.
