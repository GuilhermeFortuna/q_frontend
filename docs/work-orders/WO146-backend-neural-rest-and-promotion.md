# WO146 — Backend: neural REST surface + promotion endpoint (closes the gap)

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/neural-features.md`. Depends on **WO142–WO145** (Model Registry, neural feature
source, gate, torch autoencoder all landed).

This WO closes the **promotion gap**: after WO144, the gate sets a model version to `CANDIDATE` at
most, and promoting `CANDIDATE → PRODUCTION` was documented as "a human decision" with **no operator
surface** — today it would require a direct DB write. This WO gives promotion a real endpoint + CLI,
and exposes the read surface the Neural Features tab (WO148) needs. It does **not** add training or
any frontend.

## How the pieces work today (read these files)

- `src/q_backend/storage/db/repositories.py` —
  - `list_neural_model_versions(session, *, status=None)` → versions newest-first, with `.model` eager-loaded.
  - `get_neural_model_version(session, model_hash)` → one version or `None`.
  - `set_neural_model_status(session, *, model_hash, status)` — **sets any status with no transition
    validation** (this is the gap; wrap it, don't loosen it).
- `src/q_backend/storage/db/models.py` — `NeuralModelStatus` (`TRAINED`/`CANDIDATE`/`PRODUCTION`/`ARCHIVED`),
  `NeuralModelVersion` (`model_hash`, `version`, `status`, `val_metrics`, `artifact_path`, `train_start/end`,
  `latent_names`, `.model` → symbol/timeframe).
- `src/q_backend/neural/gate.py` — `evaluate_latents` already persists an `EvaluationRun` + `feature_score_rows`;
  `LatentGateResult` carries `baseline_ic`/`best_latent_ic`/`passed`/`evaluation_run_id`.
- `src/q_backend/api/routers/features.py` — **the precedent to mirror**: `update_feature_status` (POST status
  transition), `get_features_leaderboard`, schema-backed responses via `api/schemas/`.
- `src/q_backend/api/routers/__init__.py` / `api/main.py` — where routers are registered.
- `src/q_backend/cli/q_train_encoder.py` + `pyproject.toml [project.scripts]` — CLI registration precedent
  (`q-train-encoder`).

## Goal

A `routers/neural.py` REST surface to **list** neural models/versions, **read** one version's detail
(status, `val_metrics`, latest gate result), and **transition** its status with guardrails — plus a
`q-promote-encoder` CLI for parity. This endpoint/CLI **is** the production-promotion trigger.

## Tasks

### 1. Status-transition guardrails — `neural/promotion.py`

- `ALLOWED_TRANSITIONS: dict[str, frozenset[str]]` encoding the legal graph:
  `TRAINED → {CANDIDATE, ARCHIVED}`, `CANDIDATE → {PRODUCTION, ARCHIVED, TRAINED}`,
  `PRODUCTION → {ARCHIVED, CANDIDATE}`, `ARCHIVED → {}` (terminal; re-train to revive).
- `promote_neural_model(session, *, model_hash, target_status) -> NeuralModelVersion`: load the version,
  reject an illegal transition with a clear `ValueError`, then call `set_neural_model_status`. Keep
  `set_neural_model_status` as the low-level setter; this is the validated entry point everything else uses.
- Optional but recommended: when promoting to `PRODUCTION`, demote any other `PRODUCTION` version of the
  **same `(symbol, timeframe)`** to `CANDIDATE` so production is single-occupancy per instrument. Document
  the choice either way.

### 2. REST surface — `api/routers/neural.py` + `api/schemas/neural.py`

- `GET /api/v1/neural/models` → list of versions (newest-first), optional `?status=` filter. Each item:
  `model_hash`, `model_key`/name, `symbol`, `timeframe`, `version`, `status`, `n_latents`, `created_at`,
  `val_metrics` summary.
- `GET /api/v1/neural/models/{model_hash}` → full version detail: the above **plus** `train_start/end`,
  `latent_names`, full `val_metrics`, and the **latest gate result** for the version (join the most recent
  `EvaluationRun` produced for its latents; reuse `gate.py` helpers / `feature_score_rows`, do not recompute).
  404 when the hash is unknown.
- `POST /api/v1/neural/models/{model_hash}/status` body `{ "status": "production" }` → calls
  `promote_neural_model`; 409 on an illegal transition, 404 on unknown hash, 200 with the updated detail.
- Register the router in `api/routers/__init__.py` / wherever `features.py` is wired. Mirror `features.py`
  dependency-injection (`Depends(get_session)`) and response_model conventions exactly.

### 3. CLI parity — `cli/q_promote_encoder.py`

- `q-promote-encoder --model-hash <hash> --to production` (choices = the four statuses) calling
  `promote_neural_model` in a `session_scope()`; print the resulting `{model_hash, status}`.
- Register under `[project.scripts]` in `pyproject.toml` next to `q-train-encoder`.

## Guardrails

> **Wrap, don't loosen.** Keep `set_neural_model_status` as the unvalidated setter; all callers that
> represent a human/operator decision go through `promote_neural_model`. Illegal transitions raise, never
> silently no-op.
> **No auto-promotion.** Nothing in this WO sets `PRODUCTION` on its own — only an explicit human request
> via the endpoint or CLI. The gate (WO144) still tops out at `CANDIDATE`.
> **Read endpoints don't recompute.** Version detail reads the persisted latest gate result; it must not
> kick off an evaluation as a side effect of a GET.
> **Single production per instrument** (if implemented) is the only status this WO mutates beyond the target
> version — document it and cover it with a test.

## Tests

- `tests/neural/test_promotion.py`:
  - legal transition (`CANDIDATE → PRODUCTION`) succeeds and persists; illegal (`TRAINED → PRODUCTION`,
    `ARCHIVED → *`) raises `ValueError`.
  - promoting to `PRODUCTION` demotes a prior `PRODUCTION` of the same `(symbol, timeframe)` (if implemented)
    and leaves a different instrument's production untouched.
- `tests/api/test_neural_router.py` (mirror the features-router test style):
  - list returns trained versions, honors `?status=`; detail returns `val_metrics` + latest gate result and
    404s on an unknown hash; `POST .../status` returns 200 on a legal transition and 409 on an illegal one.

## Docs

- `docs/design/neural-features.md`: record the transition graph + the production-promotion trigger (endpoint
  - `q-promote-encoder`), closing the "no operator surface for promotion" gap noted after WO144.
- Cross-link [[neural-features-batch]].

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the `curl`/CLI for promoting a real (or seeded) `CANDIDATE` model to `PRODUCTION`
  and the JSON response, plus the 409 body for one rejected illegal transition.

## Out of scope

- Training on the worker pool / launching training from a request — **WO147**.
- Any frontend — **WO148** (read + promote tab) / **WO149** (training launch).
- Biasing GA discovery with `PRODUCTION` latent scores — follow-up beyond this batch (cf. WO136).
