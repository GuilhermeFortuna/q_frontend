# WO142 — Backend: Model Registry + NeuralEncoder interface (PCA reference encoder + training service)

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/neural-features.md` first (this batch's design) and `docs/design/feature-intelligence.md`
(the platform this extends). This is the **first** WO of the autoencoder slice: it stands up the
**Model Registry** (the store of record for models that generate features) and the **encoder
interface**, with a **PCA reference encoder** (sklearn — no new dependency; see design "PCA-first
decision"). No feature/eval wiring here — that is WO143/WO144.

**Principle:** the Feature Store manages features; the Model Registry manages the _models that generate
them_. A trained encoder is a tracked, versioned, queryable asset with an explicit train window,
hyperparameters, validation metrics, and a lake artifact.

## How the pieces work today (read these files)

- `src/q_backend/storage/db/models.py` — `Base`, `UUIDPrimaryKeyMixin`, `TimestampMixin`,
  `PortableJSON`, and the `FeatureDefinition`/`FeatureVersion`/`EvaluationRun` table style. **Mirror
  these mixins + `__table_args__`/`Index` exactly.**
- `src/q_backend/storage/db/repositories.py` — function-style repos (`create_*`/`get_*`/`list_*`).
  **Add neural-model repo functions in the same style — no new session abstraction.**
- `src/q_backend/storage/lake/artifacts.py` — `lake_root()`, `_run_dir`, content-addressed write/read
  (e.g. `write_feature_matrix`). **Add a neural-model artifact path under `lake_root()/"neural_models"`
  in the same style.**
- `src/q_backend/features/matrix.py` — `read_ohlcv` → bars frame, `build_feature_matrix` (the classical
  feature window the encoder will be fit on; WO143 supplies it). `ENGINE_VERSION` invalidation pattern.
- `src/q_backend/cli/q_optimize.py` + `pyproject.toml [project.scripts]` — the CLI entry-point pattern.
- `src/q_backend/api/lifespan.py` — startup hooks (`sync_registry_to_db`, `reconcile_orphaned_eval_runs`):
  where a model→DB sync gets its production trigger.
- `alembic/` — migrations; **add one new revision, do not edit existing ones.**

## Goal

A `NeuralEncoder` protocol with a deterministic sklearn (PCA) reference implementation, persisted as a
lake artifact + DB rows, trained by a CLI/service over a fixed in-sample window.

```python
# src/q_backend/neural/encoder.py
class NeuralEncoder(Protocol):
    model_id: str          # content hash of (kind, symbol, timeframe, train window, hyperparams)
    latent_names: list[str]  # ["latent_001", ..., "latent_032"]
    def fit(self, window: pd.DataFrame) -> None: ...
    def transform(self, window: pd.DataFrame) -> pd.DataFrame: ...  # index=time, cols=latent_names
```

## Tasks

### 1. Encoder interface + PCA reference — `src/q_backend/neural/`

- `encoder.py`: the `NeuralEncoder` protocol + `EncoderConfig` (kind, `n_latents`, input feature list,
  `train_start`/`train_end`, hyperparams). `model_id` = SHA-256 of the canonicalized config (mirror
  `matrix.compute_matrix_id`).
- `pca_encoder.py`: `PCAEncoder` using `sklearn.decomposition.IncrementalPCA` (or `PCA`). `fit` consumes
  a feature window (rows=bars, cols=standardized classical features); standardize with a `StandardScaler`
  fit on the **train window only** (store its stats in the artifact). `transform` returns
  `latent_001..latent_{n}`. Deterministic (fixed `svd_solver`/seed).
- Validation metric: reconstruction R² / explained-variance ratio on a held-out tail of the train window.

### 2. Model Registry DB — `storage/db/models.py` + repositories + migration

```python
class NeuralModelStatus(str, Enum):
    TRAINED = "trained"; CANDIDATE = "candidate"; PRODUCTION = "production"; ARCHIVED = "archived"

class NeuralModel(UUIDPrimaryKeyMixin, TimestampMixin, Base):   # the model lineage
    __tablename__ = "neural_models"
    model_key: Mapped[str]   # unique stable name, e.g. "ae_ccm_h1"
    kind: Mapped[str]        # "pca" | (later) "autoencoder"
    symbol: Mapped[str]; timeframe: Mapped[str]

class NeuralModelVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "neural_model_versions"
    model_id: Mapped[uuid.UUID]    # FK -> neural_models, ondelete CASCADE
    model_hash: Mapped[str]        # == NeuralEncoder.model_id (unique)
    version: Mapped[int]
    status: Mapped[str]            # NeuralModelStatus, default TRAINED
    train_start: Mapped[datetime]; train_end: Mapped[datetime]
    n_latents: Mapped[int]
    input_features: Mapped[list]   # PortableJSON: classical feature names fed in
    hyperparams: Mapped[dict]      # PortableJSON
    val_metrics: Mapped[dict]      # PortableJSON: {reconstruction_r2, explained_variance, ...}
    latent_names: Mapped[list]     # PortableJSON
    artifact_path: Mapped[str]     # lake-relative
```

- Repos: `create_neural_model` (upsert by `model_key`), `create_neural_model_version`,
  `get_neural_model_version(model_hash)`, `list_neural_model_versions(status=...)`,
  `set_neural_model_status(model_hash, status)`.
- One new Alembic revision (down-revision = current head).

### 3. Artifact persistence — `storage/lake/artifacts.py`

`write_neural_model(model_hash, encoder)` / `read_neural_model(model_hash) -> NeuralEncoder` under
`lake_root()/"neural_models"/<model_hash>/` (joblib-pickle the fitted estimator + scaler + config).
Immutable; a retrain is a new `model_hash`, never an in-place mutation.

### 4. Training service + CLI — `neural/training.py` + `cli/q_train_encoder.py`

- `train_encoder(config) -> NeuralModelVersion`: read bars over `[train_start, train_end]`, build the
  input feature window (WO143 owns the window builder; for this WO accept a builder callback / raw
  frame), `fit`, compute `val_metrics`, write artifact, persist DB rows (status `TRAINED`).
- `cli/q_train_encoder.py:main` (register in `pyproject.toml [project.scripts]` as
  `q-train-encoder`): args `--symbol --timeframe --train-start --train-end --n-latents`. **This is the
  production trigger** (per the cutover guardrail — training is operator-run, not on a request path).
- `neural/sync.py::sync_neural_models_to_db(session)` is idempotent and called from
  `api/lifespan.py` startup (reconciles lake artifacts ↔ DB), mirroring `sync_registry_to_db`.

## Guardrails

> **PCA is the linear control, not dep-avoidance.** This WO's encoder is sklearn PCA because it's the
> cheap deterministic baseline that proves the plumbing and quantifies what nonlinearity buys — _not_
> because dependencies are costly (they aren't; the nonlinear torch encoder is the primary deliverable
> in WO145). `joblib` ships with scikit-learn; torch lands in WO145.
> **Determinism.** Same config + same bars ⇒ same `model_hash`, same fitted estimator, same latents.
> Fix `svd_solver`/`random_state`; assert two fits are bit-identical in a test.
> **Train window is the only data the encoder ever sees at fit time.** Scaler stats and PCA basis are
> fit on `[train_start, train_end]` exclusively — no peeking past `train_end` (the leakage contract is
> enforced at transform time in WO143, but fit must not consume future bars either).
> **Immutable artifacts.** A retrain is a new `model_hash`; never overwrite an artifact in place.
> **Registry sync is one-way + idempotent** (lake/DB → DB), never downgrades a human-set status.

## Tests

- `tests/neural/test_pca_encoder.py`: `fit`+`transform` returns `n_latents` columns named
  `latent_001..`; transform of the train tail is finite; two independent fits on the same frame produce
  identical latents (determinism); `model_id` is stable across fits and changes when a hyperparam changes.
- `tests/neural/test_model_registry_db.py`: create model + version, `get_neural_model_version(hash)`
  round-trips; `set_neural_model_status` sticks across a re-sync; `sync_neural_models_to_db` twice is a
  no-op. Migration `upgrade head`/`downgrade -1` clean (mirror existing migration test).
- `tests/neural/test_training.py`: `train_encoder` over a synthetic window writes an artifact readable
  by `read_neural_model` and a DB version row with populated `val_metrics`.

## Docs

- `docs/design/neural-features.md`: tick Model Registry + encoder interface landed; note PCA reference.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: a trained `model_hash`, its `val_metrics` (reconstruction_r2 /
  explained_variance), and confirmation `sync_neural_models_to_db` run twice is a no-op.

## Out of scope

- Registering latents as features / neural compute dispatch — **WO143**.
- Wiring latents through evaluation + the IC-vs-baseline gate — **WO144**.
- Nonlinear (torch) autoencoder — **WO145**, gated on WO144 evidence.
