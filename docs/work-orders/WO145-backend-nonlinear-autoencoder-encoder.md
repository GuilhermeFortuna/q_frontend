# WO145 — Backend: nonlinear autoencoder encoder (torch) behind NeuralEncoder — PRIMARY

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/neural-features.md`. Depends on **WO142–144** (registry, neural feature source, eval).

This WO delivers the **primary encoder of the slice**: a **nonlinear autoencoder** (torch) behind the
**same** `NeuralEncoder` interface, so everything downstream (Model Registry, neural feature source,
OOS leakage contract, evaluation gate) is reused verbatim. It is built **regardless** of the PCA
control's result — representation learning over temporal market windows is what a real autoencoder is
for, and the eval (WO144) reports it side-by-side with the PCA baseline to show whether the added
capacity earns IC. Dependencies are unrestricted on this project; add whatever is the best tool.

## How the pieces work today (read these files)

- `src/q_backend/neural/encoder.py` (WO142) — the `NeuralEncoder` protocol + `EncoderConfig`. The torch
  encoder implements this exactly; **no downstream module changes.**
- `src/q_backend/neural/pca_encoder.py` (WO142) — the reference impl to mirror for fit/transform/
  determinism/artifact shape.
- `src/q_backend/neural/training.py` + `cli/q_train_encoder.py` — training entry point; add a
  `--kind autoencoder` branch.
- `src/q_backend/storage/lake/artifacts.py` — `write_neural_model`/`read_neural_model`: extend to
  serialize torch weights (`state_dict`) alongside the scaler/config.
- `pyproject.toml` — dependency declaration (the new framework + a CPU build pin).

## Goal

A `TorchAutoencoder(NeuralEncoder)`: an MLP encoder→bottleneck(`n_latents`)→decoder trained with masked
reconstruction (roadmap's objective), exposing the bottleneck as `latent_001..latent_{n}`. Same
`model_id`/artifact/DB/feature/eval flow as the PCA encoder — the gate (WO144) now compares **nonlinear**
latents to the same classical baseline.

## Tasks

### 1. Dependency

- Add the DL framework to `pyproject.toml` (pin a version). Pick the genuinely best fit (PyTorch is the
  default assumption); GPU is fine if it's the better tool, but training must also run on CPU in CI.
  Record the chosen framework + version in the completion note. (Splitting train-only deps into a
  dependency group is reasonable ops hygiene if it falls out naturally — but never as dep-avoidance.)

### 2. `TorchAutoencoder` — `neural/torch_autoencoder.py`

- **Architecture: sequence-aware over the rolling window** — input is the standardized classical feature
  window `[lookback × n_features]` (same `input_features` contract as PCA), encoded by a temporal model
  (1D-CNN or GRU/temporal-conv stack) to an `n_latents` bottleneck and decoded back. **Do not flatten to
  a plain MLP** — that discards the temporal structure the whole exercise is meant to capture.
  Depth/width/`n_latents`/`lookback` configurable via `EncoderConfig.hyperparams`.
- Self-supervised objective: **masked reconstruction** (randomly mask input timesteps/features and
  reconstruct them) — the roadmap's "masked candle/feature" objective. After training, retain only the
  encoder; `transform` = encoder forward to the bottleneck at each bar's trailing window.
- `val_metrics`: reconstruction MSE/R² on a held-out tail of the train window (so it's comparable to the
  PCA encoder's metrics).
- **Determinism:** seed everything (`torch.manual_seed`, deterministic algorithms, no nondeterministic
  cudnn); CPU training; assert two fits on the same data give latents equal within a tight tolerance.

### 3. Wiring

- Register `kind="autoencoder"` in the encoder factory; `--kind autoencoder` in the training CLI. Model
  Registry `kind` column already supports it (WO142). **No changes** to WO143 compute or WO144 gate.

## Guardrails

> **Same interface, zero downstream churn.** If WO143/WO144 need any change to accommodate the torch
> encoder, that is a design smell — the abstraction (WO142) failed; fix the interface, don't special-case
> the consumers.
> **OOS leakage contract is unchanged and still enforced** — the torch model only ever fits on
> `[train_start, train_end]`; latents exist only after `train_end`.
> **Determinism is non-negotiable** even with a neural net — seeded, CPU, deterministic ops; the
> `model_hash`/artifact reproducibility tests from WO142 must pass for this encoder too.
> **CI runs on CPU.** Tests/CI must not require a GPU; real operator training may use one if it's the
> better tool. No GPU assumption baked into the API image.

## Tests

- `tests/neural/test_torch_autoencoder.py`:
  - `fit`+`transform` returns `n_latents` columns; reconstruction `val_metrics` populated.
  - determinism: two seeded fits → latents equal within tolerance; `model_id` stable.
  - the encoder satisfies the same `NeuralEncoder` protocol tests WO142 runs against `PCAEncoder`
    (parametrize the shared contract test over both encoders).
  - OOS contract via the WO143 path: latents NaN ≤ `train_end`, finite after (reuse the WO143 assertion
    helper — proves no downstream change was needed).

## Docs

- `docs/design/neural-features.md`: record the torch encoder landed, the dependency added, and the
  WO144 evidence that justified it.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the `LatentGateResult` for the **torch** encoder vs the same baseline, side by
  side with the PCA result from WO144 (did nonlinearity buy IC over the linear latents?), and the added
  dependency + its install size.

## Out of scope

- Transformer encoder (roadmap Phase 4) — separate future batch, gated on this encoder's evidence.
- Latent Space Explorer / Market Similarity Search / vector index / Neural Features frontend tab —
  deferred (design "Out of scope").
- Walk-forward rolling refit — deferred.
