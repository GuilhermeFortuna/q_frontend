# WO147 — Backend: neural encoder training as a worker-pool job

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/neural-features.md`. Depends on **WO142–WO145** (registry/source/gate/torch AE) and
**WO146** (the neural REST router exists to hang these endpoints on).

Today `train_encoder` runs **synchronously in-process** and is reachable only through the
`q-train-encoder` CLI. A torch autoencoder train + gate takes minutes — far too long for a request
thread. This WO moves training onto the existing **Dramatiq worker pool** (the same pattern
optimization/walk-forward/feature-eval already use) and exposes start + status endpoints, so the
Neural Features tab (WO149) can launch and monitor a run. It does **not** change the model math,
the gate, or the encoder — only how training is dispatched and tracked.

## How the pieces work today (read these files)

- `src/q_backend/neural/training.py` — `train_encoder(session, config, *, window_builder|feature_window)`,
  `default_train_encoder_config(...)`, `TrainEncoderConfig`. This is the unit of work to wrap; **do not
  fork it.**
- `src/q_backend/neural/gate.py` — `evaluate_latents(session, version, *, target_name, horizon)` for the
  optional post-train gate (reuse exactly as the CLI's `--evaluate` does).
- `src/q_backend/cli/q_train_encoder.py` — the synchronous reference: how the config + `window_builder`
  (via `build_feature_matrix`) + optional gate are assembled. The job manager runs the **same** sequence.
- `src/q_backend/api/optimization_jobs.py` — **the pattern to mirror**: `start_job(...)` persists state and
  enqueues an actor; `_persist_progress` / `_persist_*_status` mirror progress to Redis + DB;
  `get_status_payload(study_id)`; `dispatch_study` / `run_trials_chunk` are the actor bodies;
  `results_payload(job)`.
- `src/q_backend/tasks/actors.py` — actor registry (`run_backtest`, `optimization_coordinator`, …); add the
  neural actor(s) here so the test harness can rewire `.send` synchronously.
- `src/q_backend/api/routers/optimization.py` — `POST /api/v1/optimize` (start) + `GET .../status`
  endpoints: the REST shape to mirror for neural training.
- `tests/conftest.py` — `run_jobs_sync` rewires actors to run in-process against `fakeredis`; extend it so a
  neural training job runs end-to-end in tests without a broker.

## Goal

`POST /api/v1/neural/models/train` enqueues a training job that runs `train_encoder` (+ optional gate) on
the worker pool, persisting progress/status; `GET /api/v1/neural/models/train/{job_id}` returns
status/progress and, on success, the resulting `model_hash` (so the client can then read it via WO146's
detail endpoint). Production trigger: training is launchable off a request path (auth-gated), not only
from the terminal.

## Tasks

### 1. Training job manager — `api/neural_jobs.py`

- `start_training_job(*, request) -> {job_id, status}`: validate the request, persist an initial job record
  (reuse the optimization job-state store / Redis conventions in `optimization_jobs.py`), enqueue the neural
  training actor. Returns immediately.
- `get_training_status_payload(job_id) -> dict | None`: `{ job_id, status (queued|running|completed|failed),
progress, model_hash?, val_metrics?, gate? , error? }`. `None` → 404.
- Persist terminal state (model_hash, val_metrics, gate summary, or error) the way
  `_persist_study_finish` does, so status survives the worker process.

### 2. Training actor — `tasks/.../neural.py` + register in `tasks/actors.py`

- One coordinator actor that, given the job id + serialized config, opens a `session_scope()`, builds the
  input window via `build_feature_matrix` (same as the CLI's `window_builder`), runs `train_encoder`, then —
  if the request asked for it — `evaluate_latents`, mirroring progress into the job store at each phase
  (`building_window` → `training` → `evaluating` → `done`). On exception, mark the job `failed` with the
  message; never leave it stuck `running`.
- Keep training deterministic (the encoder already seeds itself); the actor adds no randomness.

### 3. REST endpoints — extend `api/routers/neural.py` + `api/schemas/neural.py`

- `POST /api/v1/neural/models/train` body: `{ kind: "pca"|"autoencoder", symbol, timeframe, train_start,
train_end, n_latents, input_features: string[], model_key?, evaluate?: { target, horizon }, hyperparams? }`.
  Validate (`train_end > train_start`, `n_latents >= 1`, non-empty features) → `start_training_job` → 202/200
  `{ job_id, status }`.
- `GET /api/v1/neural/models/train/{job_id}` → `get_training_status_payload`; 404 when unknown.
- Reuse the WO146 router/module; do not create a second neural router.

### 4. CLI stays, but converges

- Leave `q-train-encoder` working (synchronous) for ops, but factor the shared "build config + window +
  train + optional gate" sequence so the CLI and the actor call **one** function, not two copies.

## Guardrails

> **Reuse the job pattern, don't invent one.** Status/progress/Redis/DB persistence mirror
> `optimization_jobs.py`; a reviewer should recognize the shape. No bespoke threading.
> **Same math, off the request thread.** `train_encoder`/`evaluate_latents` are called unchanged; this WO
> only changes _where_ they run and _how_ progress is reported.
> **Failures are first-class.** A training exception ends as a `failed` job with a message, surfaced by the
> status endpoint — never a hung `running` or a 500 with no job record.
> **No auto-promotion.** A completed job leaves the model at `TRAINED` (or `CANDIDATE` if the gate passed,
> per WO144). Promotion remains the explicit WO146 action.

## Tests

- `tests/neural/test_neural_jobs.py` using the extended `run_jobs_sync` harness:
  - a started PCA job (fast) reaches `completed`, the status payload carries a real `model_hash`, and that
    hash is then loadable via the registry / WO146 detail path.
  - a job with `evaluate` set returns a `gate` summary in its terminal payload.
  - a job whose config is invalid (e.g. `train_end <= train_start`) is rejected at `start` (no orphan job);
    a job whose **training** raises ends `failed` with the message, not `running`.
- `tests/api/test_neural_router.py`: `POST .../train` returns a `job_id`; `GET .../train/{job_id}` reports
  progression to `completed` (under the sync harness) and 404s on an unknown id.

## Docs

- `docs/design/neural-features.md`: add the training-job lifecycle (phases, status payload shape) alongside
  the existing CLI path; note both now funnel through one shared sequence.
- Cross-link [[neural-features-batch]].

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the `POST .../train` request body + response, and the sequence of
  `GET .../train/{job_id}` payloads from `queued` → `completed` for a real PCA run, ending with the
  `model_hash` and `val_metrics`.

## Out of scope

- The launch form / progress UI — **WO149**.
- Read + promote REST and tab — **WO146** / **WO148**.
- GPU scheduling, distributed training, hyperparameter search — single-run training only; revisit if a
  model proves its keep through the gate.
