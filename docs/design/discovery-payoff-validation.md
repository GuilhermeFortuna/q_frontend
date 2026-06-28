# Discovery Payoff Validation + Encoder Ablation (WO153–157)

## Why this batch exists

Phases 1–3 (Feature Store → evaluation → neural latents) and the latents→discovery bridge
(WO150–152) all **built capability**. Nothing has measured whether any of it makes _discovered
strategies better_. The entire neural slice is currently justified by a single number — a latent's
IC (0.1695) beating RSI's (0.091) on CCM\$ H1 — not by improved strategy quality out of discovery.
Two facts make "just keep going down the roadmap" the wrong move:

1. **Zero evidence of discovery payoff.** Latents can now enter genomes and bias seeding, but no one
   has run discovery _with vs. without_ latents and compared out-of-sample strategy quality.
2. **Linear PCA already beat the nonlinear AE** (CCM\$ H1: latent IC 0.1695 vs 0.1254; the AE
   _failed_ the gate). Building Phase 4 (a transformer — even heavier nonlinearity) before
   understanding why nonlinearity isn't paying off would repeat the build-without-evidence trap.

This batch builds the **measuring instruments**: a Discovery A/B harness (does turning latents on
improve discovery?) and an Encoder Ablation (which encoder config is actually best on the gate?),
both surfaced in a new Research tab. **Walk-forward refit** and an **automated hyperparameter
sweep** are explicitly out of scope (future batches).

## The non-obvious problem: the control arm

WO150–152 deliberately made latents **automatic with no flag** — "promoting a model IS enabling its
latents for discovery." But an honest A/B needs _both arms on an instrument where a PRODUCTION model
exists_, so the control arm must force latents **OFF despite a production model**. That override seam
does not exist today and is the crux of the backend work (WO153). Decision (user, 2026-06-28):
**internal harness-only param**, never surfaced on the normal discovery request or UI — normal runs
stay automatic.

## How discovery runs today (the seam map)

- `optimization/genetic_search.py::create_genetic_candidate_provider(genetic_config, search_config,
probe_df=None)` — **the single chokepoint**. Opens a `session_scope()`, calls
  `resolve_latent_universe(session, symbol, timeframe)` + `build_kind_weights(...)`, then constructs
  `GeneticCandidateProvider(... latent_universe=, kind_weights=)`. Four call sites, all in
  `api/strategy_search_jobs.py` (≈517, 879, 1064, 1106), invoke it as
  `create_genetic_candidate_provider(request.genetic, request)`.
- `backtesting/genome/latent_universe.py::resolve_latent_universe(...) -> LatentUniverse(
indicator_kinds, latent_model_hash, n_latents)` and `default_latent_universe()` (no latents:
  `indicator_kinds=INDICATOR_KINDS`, `latent_model_hash=None`, `n_latents=0`).
- A **single discovery run is a multi-actor fan-out**, not one synchronous call:
  `api/strategy_search_jobs.py::dispatch_candidates` → barrier generations → `run_genetic_candidate`
  actors drain the worker pool. So an A/B harness orchestrates **child discovery runs** (it does not
  re-implement the generation loop). Closest precedent for parent-orchestrates-children:
  `api/walkforward_jobs.py`.
- Per-run config is `optimization/strategy_search.py::StrategySearchConfig` (`backtest`, `objective`,
  `walkforward`, `gates`, `genetic`, `lockbox`, …). Results carry `GeneticFinalizeSummary.lockbox_metrics`
  / `lockbox_passed` (the held-out lockbox is the most honest headline metric).
- Encoder training + gate: `neural/training.py::run_train_encoder_pipeline` (commits the model, then
  runs the gate, keeps the model TRAINED on gate failure) producing a `LatentGateResult`
  (`recon_r2`, `best_latent_ic`, baseline IC, `passed`). Job/actor/route patterns to mirror:
  `api/neural_jobs.py`, `tasks/actors.py::run_neural_training`, `api/routers/neural.py`.
- Research frontend shell: `q_frontend/src/workspaces/research/ResearchWorkspace.tsx`
  (`TAB_OPTIONS`, `ResearchTab` in `src/types/features.ts`, `?tab=` route allow-list). Live-poll +
  chart precedents: `components/optimize/OptimizationAnalyticsTab.tsx`,
  `components/research/FeatureScoringDashboard.tsx`.

## Design (5 WOs, DAG: 153→154; 153/existing→155; {154,155}→156→157)

### WO153 — Control-arm seam (backend, prerequisite) ✅ implemented

Add an internal `latents_enabled: bool = True` field to `StrategySearchConfig` (NOT surfaced in the
frontend request form). Add a `latents_enabled: bool = True` parameter to
`create_genetic_candidate_provider`; when `False`, skip `resolve_latent_universe`/`build_kind_weights`
and use `empty_latent_universe()` + empty `kind_weights`. The four call sites pass
`request.latents_enabled`. **Guarantee (regression-locked): `latents_enabled=False` yields a population
byte-identical to the no-production-model path for the same `init_seed`, even when a PRODUCTION model
exists.** This is the only behavioural change discovery itself receives; default `True` keeps every
normal run unchanged. See `tests/optimization/test_latents_enabled_seam.py`. Next: **WO154**
(Discovery A/B job consumes this seam).

### WO154 — Discovery A/B job + endpoint (backend)

`api/discovery_ab_jobs.py` + `tasks/actors.py::run_discovery_ab` + `routers/experiments.py`
(`POST /api/v1/experiments/discovery-ab`, `GET .../discovery-ab/{job_id}`), mirroring
`neural_jobs`/`routers/neural.py`. Input: one `StrategySearchConfig` + a list of `seeds` (N). The
parent actor submits **2×N child discovery runs** through the existing strategy-search job manager —
per seed, a control run (`latents_enabled=False`) and a treatment run (`latents_enabled=True`) with
the same `init_seed` (paired design: identical base population, latents the only difference). It
tracks child run_ids, polls their terminal status (reuse the orphan-reconcile discipline), then reads
each run's **best-candidate lockbox OOS objective** (fall back to best OOS objective when lockbox is
disabled) from the persisted results. Verdict: paired deltas (treatment − control) per seed → mean
delta, Cohen's d, and a simple paired significance check (paired t-test / sign test via `scipy.stats`,
already a dependency — no new deps). Output payload: per-arm distribution, paired deltas, effect size,
significance, and a `verdict ∈ {helps, no_effect, hurts}`. Persisted as a report (JSON; reuse the lake
artifact pattern) keyed by job_id.

### WO155 — Encoder ablation job + endpoint (backend)

`api/encoder_ablation_jobs.py` + `tasks/actors.py::run_encoder_ablation` + endpoints on
`routers/experiments.py` (`POST .../encoder-ablation`, `GET .../encoder-ablation/{job_id}`). Input:
instrument (`symbol`, `timeframe`), target/horizon, train window, and a **list of encoder configs**
(e.g. `pca`, `ae:default`, `ae:variantA`). For each config the actor runs the existing
`run_train_encoder_pipeline` + gate, collecting `recon_r2`, `best_latent_ic`, baseline IC, `passed`,
and the model hash. **No promotion side effects** (every model lands TRAINED, never auto-PRODUCTION).
Output: one comparison table (one row per config) + the per-config gate verdict, persisted as a report.
Reuses the "gate failure keeps the model + returns `gate_error`" behaviour already in the pipeline.

### WO156 — Research tab foundation + A/B panel (frontend)

Register `'experiments'` in `ResearchTab` (`src/types/features.ts`) + `TAB_OPTIONS`
(`ResearchWorkspace.tsx`) + the `?tab=` route allow-list. `src/api/queries/experiments.ts` hooks +
`src/types/experiments.ts` + MSW fixtures in `src/mocks/experiments.ts` (mocks for tests only — no
`@/mocks` import in production component state, per the cutover guardrail). A/B panel: a launch form
(reuses the backtests symbol/timeframe/date pickers + a seed-count field), a distribution plot of the
two arms (our recharts/visx stack, mirroring `OptimizationAnalyticsTab`), and a verdict badge
(_helps / no effect / hurts_ with mean delta + d + p). Live-poll while the job runs; distinguish
loading vs errored vs genuinely-empty (the bug class flagged in prior frontend WOs).

### WO157 — Encoder ablation panel (frontend)

Second sub-panel in the Experiments tab: an ablation launch form (config list builder) + the
comparison table (config × `recon_r2` × `best_latent_ic` vs baseline × pass/fail badge), live-polling.
Reuses the WO156 query/poll plumbing and result-schema types.

## Guardrails (batch-wide)

> **`latents_enabled` is internal.** It exists on `StrategySearchConfig` and the provider factory only;
> it is never added to the frontend discovery request form. Normal discovery stays automatic.
> **Paired determinism.** Control and treatment for a given seed share `init_seed`; control must be
> byte-identical to the no-model path (regression-locked in WO153).
> **No new heavy deps.** Significance uses `scipy.stats` (already present). No promotion side effects in
> the ablation job. No automated hyperparameter search.
> **Cutover trigger named per WO.** Each backend WO names its production trigger (actor + route);
> frontend WOs forbid `@/mocks` outside tests and forbid mock values in component initial state.

## Out of scope (future batches)

- Walk-forward / rolling encoder refit (v1 encoders remain fixed-window).
- Automated AE hyperparameter sweep (Optuna over encoder configs).
- Mutation/crossover latent weighting (only seeding is biased today).
- Optuna optimization-path feature-score biasing (the other derivation path — see
  `search-space-derivation-paths` memory).
- Phase 4 transformer encoder (gated on the ablation evidence this batch produces).
