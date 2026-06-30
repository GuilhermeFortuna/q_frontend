# WO164 — Backend: instrument alpha-research experiment job and API

## Shared context (read first)

Read `docs/design/instrument-specific-alpha-research.md`. Depends on WO161-WO163. WO166 independently
owns the shared Discovery A/B `inconclusive` verdict correction and should land before this WO so all
experiment consumers use the corrected semantics. This WO connects the feature-evidence, hypothesis,
and robustness layers into one resumable experiment. It must reuse existing jobs rather than fork
backtesting, Optuna, walk-forward, genetic, or lock-box semantics.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- WO161-WO163 completion messages
- `src/q_backend/api/discovery_ab_jobs.py`
- `src/q_backend/api/encoder_ablation_jobs.py`
- `src/q_backend/api/strategy_search_jobs.py`
- `src/q_backend/api/schemas/experiments.py`
- `src/q_backend/api/routers/experiments.py`
- `src/q_backend/tasks/actors.py`
- `src/q_backend/api/lifespan.py`
- `src/q_backend/storage/lake/artifacts.py`

## Goal

Add a background experiment for one approved profile:

```http
POST /api/v1/experiments/alpha-research
GET  /api/v1/experiments/alpha-research/{job_id}
```

The completed result reports the funnel from data preflight through feature evidence, admitted
hypotheses, repeated-seed evaluation, frozen champion, acceptance criteria, and final verdict.

## Tasks

1. Add request/status/result schemas. Request selects `profile_id`, immutable date range, optional
   catalog/profile version, and bounded compute-budget overrides. It must not accept arbitrary
   thresholds that silently weaken the profile after launch.
2. Add a data preflight stage:
   - verify requested local coverage and continuity;
   - compute one immutable split manifest;
   - fingerprint primary/exogenous inputs;
   - reject WDO M5 until its continuity requirement passes;
   - report `inconclusive` with exact missing coverage rather than launching invalid research.
3. Orchestrate stages as child jobs or focused service calls:
   `preflight -> feature evidence -> eligible hypotheses -> candidate evaluation -> repeated seeds ->
plateau -> frozen champion -> one lock-box -> verdict`.
4. Persist stage checkpoints and child IDs so a worker restart can reconcile/resume safe pre-lock-box
   work. Never repeat a consumed lock-box automatically.
5. Add bounded cancellation propagation to active child jobs and structured stage-level errors.
6. Persist a compact result plus lake artifacts: split manifest, feature evidence, hypothesis manifest,
   seed/window table, parameter-neighborhood table, DSR inputs, lock-box metrics, criteria, and final
   candidate/genome.
7. Register a thin Dramatiq actor, routes, startup reconciliation, and artifact readers.

## Guardrails

- One run evaluates one instrument profile; cross-profile aggregation is reporting only.
- Reuse existing evaluators and jobs. Do not reimplement the GA, Optuna, walk-forward, or engine.
- Result provenance includes git/backend version, profile/catalog versions, all seeds, data hashes,
  and split manifest.
- Missing evidence is explicit and cannot become a numeric zero.
- Only a frozen champion reaches the lock-box, once.
- API and worker are both required; queued-without-worker must remain visible and diagnosable.

## Tests

- End-to-end small synthetic run reaches each stage and returns `ready_for_paper` under a planted edge.
- No-edge synthetic run returns `rejected` without manufacturing a winner.
- Insufficient/gapped data returns `inconclusive` before expensive child jobs.
- Cancellation stops children and leaves a coherent checkpoint.
- Crash/reconcile resumes pre-lock-box stages but never repeats a consumed lock-box.
- Route, schema, persistence, artifact, Redis-unavailable, lake-unwritable, and Postgres-unavailable
  behavior follows existing best-effort contracts.
- Run targeted experiment/search/feature/optimization tests, then full `uv run pytest`.

## Docs

Mark WO164 implemented in the design doc and paste one complete sample result contract for WO165.

## Definition of done

An operator can launch any approved profile and receive a reproducible evidence funnel whose terminal
state honestly says ready, rejected, or inconclusive.

## Out of scope

Shared Discovery A/B verdict semantics and its existing frontend consumers (WO166), frontend alpha
research UI (WO165), automatic paper trading, live execution, cross-profile portfolio construction,
and external data acquisition.
