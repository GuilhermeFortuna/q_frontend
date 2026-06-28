# WO155 — Backend: Encoder ablation job + endpoint

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry/npm.
Read `docs/design/discovery-payoff-validation.md` first. Independent of WO154 (shares the new
`routers/experiments.py` + `api/schemas/experiments.py`, so coordinate file ownership — additive only).

On CCM\$ H1, **linear PCA beat the nonlinear AE** (latent IC 0.1695 vs 0.1254; the AE failed the gate).
Before anyone builds Phase 4 (a transformer), we need a repeatable head-to-head: train a **specified
list** of encoder configs on the same instrument/target and compare them on the existing gate. This is
a **comparison, not a search** — no hyperparameter sweep, no auto-promotion.

## How the pieces work today (read these files)

- `src/q_backend/neural/training.py::run_train_encoder_pipeline(...)` — trains an encoder, **commits the
  model before the gate**, runs the gate in try/except (keeps the TRAINED model + returns `gate_error`
  on failure). Produces a model version + a `LatentGateResult`.
- `src/q_backend/neural/gate.py` — runs latents through `run_evaluation`/`evaluate_matrix`/
  `feature_score_rows`; `LatentGateResult` carries `recon_r2`, `best_latent_ic`, the classical baseline
  IC, and `passed` (best latent IC > best classical IC on the same symbol/tf/target/horizon).
- Encoder configs: `src/q_backend/neural/{pca_encoder,torch_autoencoder}.py` behind the
  `NeuralEncoder` protocol; the training config selects encoder kind + hyperparams.
- **Job/actor/route pattern:** `api/neural_jobs.py`, `tasks/actors.py::run_neural_training`,
  `api/routers/neural.py` (see WO154 for the same references).
- **Live training prerequisite:** API + a Dramatiq **worker** must both be up, DB migrated to head
  (encoder training enqueues to an actor; no worker ⇒ stuck `queued`).

## Goal

`POST /api/v1/experiments/encoder-ablation` with an instrument + a list of encoder configs returns a
`job_id`; polling returns one comparison row per config (recon_r2, best latent IC vs baseline, pass).

```python
class EncoderConfigSpec(BaseModel):
    label: str                    # e.g. "pca", "ae:default", "ae:variantA"
    encoder_kind: Literal["pca", "ae"]
    hyperparams: dict[str, Any] = {}

class EncoderAblationRequest(BaseModel):
    symbol: str
    timeframe: str
    target: str = "fwd_return"
    horizon: int = 5
    train_start: datetime
    train_end: datetime
    configs: list[EncoderConfigSpec]   # >= 1
```

## Tasks

### 1. Schemas — `api/schemas/experiments.py`

- `EncoderConfigSpec`, `EncoderAblationRequest` (above; validate `1 <= len(configs) <= MAX_ABLATION_CONFIGS`,
  e.g. 8, labels unique). `EncoderAblationStatusResponse` mirroring the neural-train status response, with
  `result: Optional[EncoderAblationResult]`.
- `EncoderAblationRow` (`label`, `encoder_kind`, `model_hash`, `recon_r2`, `best_latent_ic`,
  `baseline_ic`, `ic_delta_vs_baseline`, `passed`, `gate_error: Optional[str]`) and
  `EncoderAblationResult` (`rows: list[EncoderAblationRow]`, `best_label`, `instrument`/`target` echo).

### 2. Job manager — `api/encoder_ablation_jobs.py` (new)

- `start_encoder_ablation_job(*, request) -> {job_id, status}`: validate, persist `queued` progress
  (Redis namespace `encoder_ablation`), enqueue `actors.run_encoder_ablation.send(job_id, json)`.
- `run_encoder_ablation_job(job_id, request_json)`:
  1. For each `EncoderConfigSpec`, build the training config (encoder kind + hyperparams + shared
     instrument/target/window) and call `run_train_encoder_pipeline`. Update `progress` = configs done /
     total after each.
  2. Collect a row from each result: `recon_r2`, `best_latent_ic`, `baseline_ic`,
     `ic_delta_vs_baseline = best_latent_ic - baseline_ic`, `passed`, `gate_error`, `model_hash`. A
     `gate_error` config still produces a row (TRAINED model kept, `passed=None/False`,
     `best_latent_ic` may be null) — never abort the whole ablation.
  3. `best_label` = the config with the highest `best_latent_ic` among those with a finite value (ties
     broken by `recon_r2`). Persist `EncoderAblationResult` as a lake report artifact keyed by `job_id`;
     mark `completed`.
- `get_encoder_ablation_status_payload(job_id)`.

### 3. Actor — `tasks/actors.py`

- `@dramatiq.actor(**_ACTOR_OPTS) def run_encoder_ablation(job_id, request_json):` lazy-import the job
  module, delegate. Thin actor; trains configs **sequentially** within the actor (no nested process
  pool), like the other neural actors.

### 4. Router — `api/routers/experiments.py`

- `POST /api/v1/experiments/encoder-ablation` → start; `GET /api/v1/experiments/encoder-ablation/{job_id}`
  → status (404 unknown). Same router file as WO154 (additive).

### 5. Orphan reconcile

- Add encoder-ablation runs to the startup reconcile sweep (RUNNING → CANCELLED on crash).

## Guardrails

> **Comparison, not search.** A fixed, operator-supplied list of configs. No hyperparameter sweep / no
> Optuna over encoders (a future batch).
> **No promotion side effects.** Every trained model lands TRAINED, never auto-PRODUCTION. The ablation
> only measures; promotion stays a separate explicit action (WO146 path).
> **Gate failure ⇒ keep the row.** Reuse the "commit model before gate, keep on failure" behaviour;
> a `gate_error` config is reported, not dropped, and never aborts the batch.
> **Reuse the real pipeline.** Train + gate go through `run_train_encoder_pipeline`; do not fork a
> parallel training path.
> **Production trigger:** actor `run_encoder_ablation` + `POST /api/v1/experiments/encoder-ablation`
> (API + Dramatiq worker + DB at head required).

## Tests

- `tests/api/test_encoder_ablation_jobs.py` (mirror `tests/neural/test_pipeline_integration.py`; stub
  only `read_ohlcv`, seed `sync_registry_to_db`):
  - `configs=[pca, ae:default]` over synthetic bars: job reaches `completed`, result has 2 rows with
    finite `recon_r2`, a `best_label`, and `ic_delta_vs_baseline` computed; no model is left PRODUCTION.
  - A config whose gate errors (e.g. `train_end` past data ⇒ too few OOS bars) still yields a row with
    `gate_error` set and the TRAINED model retained; the other config's row is unaffected.
  - Route smoke test: `POST` ⇒ `{job_id, status:"queued"}`; unknown `job_id` ⇒ 404.

## Docs

- `docs/design/discovery-payoff-validation.md`: mark WO155 implemented; note `EncoderAblationResult`.
- Cross-link `neural-features-batch` memory (the PCA>AE result this operationalizes) + WO157 (panel).

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the `EncoderAblationRequest`/`EncoderAblationRow` schemas + a sample completed
  result with at least a PCA and an AE row (recon_r2, best_latent_ic, baseline_ic, passed).

## Out of scope

- The A/B harness — **WO154**.
- Frontend — **WO157** consumes this endpoint.
- Automated hyperparameter sweep / Optuna over encoders.
- Walk-forward refit. Phase 4 transformer (gated on this ablation's evidence).
