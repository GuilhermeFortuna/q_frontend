# WO154 — Backend: Discovery A/B job + endpoint (latents on vs off)

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry/npm.
Read `docs/design/discovery-payoff-validation.md` first. Depends on **WO153** (`latents_enabled` seam).

This WO builds the **Discovery A/B harness**: does turning production latents ON actually improve
discovered strategies vs OFF, on the same instrument? Discovery is stochastic (genetic search), so the
verdict is established over **N seeds** with a **paired** design — for each seed, a control run
(`latents_enabled=False`) and a treatment run (`latents_enabled=True`) share the same `init_seed`, so
the base population is identical and latents are the only difference.

## How the pieces work today (read these files)

- A single discovery run is a **multi-actor fan-out**, not one synchronous call:
  `src/q_backend/api/strategy_search_jobs.py::dispatch_candidates` → barrier generations →
  `run_genetic_candidate` actors drain the worker pool. So this job orchestrates **child discovery
  runs**; it does not re-implement the generation loop.
- **Parent-orchestrates-children precedent:** `src/q_backend/api/walkforward_jobs.py` (window
  submission, status polling, aggregation, `reconcile_orphaned_runs`).
- **Job/actor/route pattern to mirror:** `src/q_backend/api/neural_jobs.py`
  (`start_training_job`/`run_training_job`/`get_training_status_payload`/`_persist_progress`),
  `src/q_backend/tasks/actors.py::run_neural_training` (`@dramatiq.actor(**_ACTOR_OPTS)`, lazy import of
  the job module inside the actor), `src/q_backend/api/routers/neural.py` (`POST .../train`,
  `GET .../train/{job_id}`).
- **Strategy-search job manager:** `strategy_search_jobs.py` exposes the submit path + `get_job`,
  persists run status and results (per-candidate `lockbox_metrics` / `oos_metrics`) to DB. A child run
  is one `StrategySearchConfig` with `init_seed` set and `latents_enabled` toggled.
- **Headline metric source:** `optimization/strategy_search.py::GeneticFinalizeSummary.lockbox_metrics` /
  `lockbox_passed` (held-out lockbox, the most honest metric); `CandidateResult.oos_metrics` is the
  fallback when `lockbox.enabled is False`. `resolve_objective(metrics, mode)` maps metrics → the
  scalar objective.
- `scipy.stats` is already a dependency (paired t-test / sign test — no new deps).

## Goal

`POST /api/v1/experiments/discovery-ab` with one `StrategySearchConfig` + a seed list returns a
`job_id`; polling `GET /api/v1/experiments/discovery-ab/{job_id}` returns progress and, on completion, a
verdict comparing the latents-ON vs latents-OFF distribution of best-candidate lockbox objective.

```python
class DiscoveryAbRequest(BaseModel):
    config: StrategySearchConfig       # latents_enabled is overridden per-arm; ignore any incoming value
    seeds: list[int]                   # N seeds; each runs one control + one treatment

# result payload (abridged)
{
  "verdict": "helps" | "no_effect" | "hurts",
  "n_seeds": 8,
  "metric": "lockbox_objective",       # or "oos_objective" fallback
  "control": {"values": [...], "mean": ...},
  "treatment": {"values": [...], "mean": ...},
  "paired_delta": {"values": [...], "mean": ..., "cohens_d": ..., "p_value": ...},
}
```

## Tasks

### 1. Schemas — `api/schemas/experiments.py` (new)

- `DiscoveryAbRequest` (above). Validate `1 <= len(seeds) <= MAX_AB_SEEDS` (e.g. 32) and seeds unique.
- `DiscoveryAbStatusResponse` (`job_id`, `status ∈ {queued,running,completed,failed}`, `progress`
  float, `detail`, `result: Optional[...]`, `error: Optional[str]`) mirroring
  `NeuralTrainStatusResponse`.

### 2. Job manager — `api/discovery_ab_jobs.py` (new)

- `start_discovery_ab_job(*, request) -> {job_id, status}`: validate, persist a `queued` progress
  record (`_persist_progress`, Redis namespace `discovery_ab`, mirroring `neural_jobs`), enqueue
  `actors.run_discovery_ab.send(job_id, request.model_dump_json())`.
- `run_discovery_ab_job(job_id, request_json)`: the orchestration body.
  1. For each seed: build a control `StrategySearchConfig` (`genetic.init_seed=seed`,
     `latents_enabled=False`) and a treatment one (`init_seed=seed`, `latents_enabled=True`). Submit
     both as child strategy-search runs via the existing job manager; record child run_ids.
  2. Poll child runs to terminal status (reuse the orphan-reconcile discipline; bounded wait + cancel
     propagation). Update `progress` = children completed / (2·N).
  3. For each completed child, read **best-candidate lockbox objective** (`resolve_objective(
best.lockbox_metrics, mode)`); fall back to best `oos_metrics` objective when `lockbox.enabled is
False`. A failed/empty child seed is dropped from the pair (and noted in `detail`).
  4. Compute paired deltas (treatment − control) over surviving seeds → `mean`, `cohens_d`, `p_value`
     (`scipy.stats.ttest_rel`, or sign test when N small). `verdict`: `helps` if mean delta > 0 and
     `p_value < ALPHA` (e.g. 0.05); `hurts` if mean delta < 0 and `p_value < ALPHA`; else `no_effect`.
  5. Persist the result payload as a lake report artifact keyed by `job_id` (reuse the artifact-write
     helpers used by the other job types) and mark the job `completed`.
- `get_discovery_ab_status_payload(job_id)` mirroring `get_training_status_payload`.

### 3. Actor — `tasks/actors.py`

- `@dramatiq.actor(**_ACTOR_OPTS) def run_discovery_ab(job_id, request_json):` lazy-import
  `discovery_ab_jobs` and delegate to `run_discovery_ab_job`. The actor stays thin; it does **not**
  spawn its own process pool (child discovery runs use the existing worker pool).

### 4. Router — `api/routers/experiments.py` (new) + register in `api/main.py`

- `POST /api/v1/experiments/discovery-ab` → `start_discovery_ab_job`.
- `GET /api/v1/experiments/discovery-ab/{job_id}` → `get_discovery_ab_status_payload` (404 when
  unknown). Register the router where the other routers are wired.

### 5. Orphan reconcile

- Add discovery-A/B runs to the startup `reconcile_orphaned_*` sweep (bg/worker crash ⇒ RUNNING →
  CANCELLED), mirroring the existing job types.

## Guardrails

> **Per-arm override, ignore incoming.** The job sets `latents_enabled` itself per arm; any value on
> the incoming `request.config` is overwritten. Control = `False`, treatment = `True`, same `init_seed`.
> **Paired design.** Control and treatment for a seed share `init_seed` so the base population is
> identical (relies on the WO153 byte-identical guarantee). Never compare unpaired arms.
> **Reuse, don't reimplement discovery.** Child runs go through the existing strategy-search job
> manager. Do not duplicate `dispatch_candidates`/the generation loop.
> **Honest verdict.** Report effect size **and** significance; `no_effect` is a valid, expected
> outcome. Dropped/failed seeds are surfaced in `detail`, never silently treated as ties.
> **No new heavy deps.** Significance via `scipy.stats` only.
> **Production trigger:** the actor `run_discovery_ab` + `POST /api/v1/experiments/discovery-ab` route
> (needs the API **and** a Dramatiq worker up — no worker ⇒ stuck `queued`).

## Tests

- `tests/api/test_discovery_ab_jobs.py` (mirror `tests/neural/test_pipeline_integration.py` — drive the
  real path, stub only `read_ohlcv`; seed `sync_registry_to_db` + a tiny PCA PRODUCTION model):
  - Small config, `seeds=[1,2]`, tiny population/generations: the job reaches `completed`, the payload
    has both arms' value lists of equal length, a finite `mean`, `cohens_d`, `p_value`, and a `verdict`
    in the allowed set.
  - Control arm best-candidate genomes carry **no** `ind.latent`; treatment arm may (proves the override
    actually flipped — leans on WO153).
  - A child seed that yields no completed candidate is dropped from the pair and noted in `detail`,
    without failing the whole job.
  - Route smoke test: `POST` returns `{job_id, status:"queued"}`; unknown `job_id` ⇒ 404.

## Docs

- `docs/design/discovery-payoff-validation.md`: mark WO154 implemented; note the result schema.
- Cross-link WO153 (seam) + WO156 (A/B panel consumes this).

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the `DiscoveryAbRequest` schema + a sample completed `result` payload from the
  test run (both arms' values, mean delta, d, p, verdict).

## Out of scope

- Encoder ablation — **WO155**.
- Any frontend — **WO156** consumes this endpoint.
- Multi-instrument aggregation (single instrument per A/B run; a future batch may aggregate).
- Walk-forward refit / hyperparameter sweep.
