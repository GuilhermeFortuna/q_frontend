# Neural Features — design (roadmap Phase 3, autoencoder slice)

Source roadmap: `Q_Neural_Representation_Learning.md`. This doc designs the **autoencoder latent**
slice only. The Transformer encoder (Phase 4), Latent Space Explorer, Market Similarity Search, and
the Research **Neural Features** frontend tab remain deferred (see "Out of scope").

This is the work that `feature-intelligence.md` §"Go/no-go gate" gated. **The gate is cleared:** the
Phase-2 evaluation on CCM\$ H1 (`fwd_return`, h=5) shows the classical engine near a low ceiling — best
feature `rsi` IC ≈ 0.091, every other feature < 0.06 and most of the trend/MA family ≈ −0.02 (noise),
literal redundant duplicates (`bollinger_middle == ma`, `tsmom == momentum`,
`trend_blend_volatility == realized_vol`), and half the catalog at stability 0.00. There is exploitable
headroom. The bar this slice must clear is therefore concrete: **a latent must beat RSI's 0.091 IC in
the same evaluation pipeline** (`feature_score_rows`) to earn its place.

## Principle: latents are just more FeatureSpecs

Neural representation learning produces _features_, not signals. The Feature Store, matrix cache,
target/label module, evaluation metrics, and scoring/redundancy clustering already exist (WO127–136)
and are encoder-agnostic. A latent is a named, versioned, causal bar→value series exactly like `rsi`.
So the design adds the **smallest** new surface that lets a trained encoder register `latent_001 …
latent_NNN` as `FeatureRequest`s that flow through `build_feature_matrix` → `evaluate_matrix` →
`feature_score_rows` **unchanged**.

## Encoder strategy: linear control + nonlinear primary

Dependencies are unrestricted on this project — we always pick the best tool for the job. The encoder
sits behind a `NeuralEncoder` protocol, and two implementations ship:

- **PCA / IncrementalPCA** (sklearn) — the **linear control**, landed first (WO142). A linear
  autoencoder is a legitimate unsupervised compressor of rolling market windows, and because it is
  cheap and deterministic it both proves the plumbing (Model Registry, neural feature source, leakage
  contract, eval wiring) and gives a baseline that **quantifies what nonlinearity actually buys**. It is
  here as scientific control, _not_ as dependency-avoidance.
- **Nonlinear autoencoder** (torch) — the **primary encoder** (WO145, landed). Built regardless of the PCA
  result; representation learning over temporal market windows is what a real autoencoder is for. The
  protocol means it reuses the entire downstream stack verbatim, and the eval (WO144) reports it
  side-by-side with the PCA control so we can see whether the added capacity earns IC.
  - Dependency: **PyTorch** (`torch>=2.6.0`, CPU training in CI; deterministic seeded fits).
  - Architecture: GRU encoder→bottleneck(`n_latents`)→GRU decoder over `[lookback × n_features]`
    windows; masked reconstruction training; `transform` = encoder forward on each bar's trailing window.
  - Factory kind `autoencoder`; CLI `q-train-encoder --kind autoencoder`.

## The two hard problems (same rigor the Feature Store demanded)

### 1. PIT / training-leakage contract — the thing that makes or breaks validity

A classical feature leaks only via `.shift(negative)`. A neural encoder leaks far more easily: if the
model is **fit** on bars it later **encodes**, every latent has seen its own future. The v1 contract is
the honest, buildable one:

- A model version owns an explicit **train window** `[train_start, train_end]`.
- `transform` may emit latent values **only for bars strictly after `train_end`** (out-of-sample). The
  in-sample region is NaN — the same shape as classical warm-up trimming.
- `leakage_status` is `clean` **only** for an emitted range entirely after `train_end`; any overlap
  with the train window is `suspect`. The leakage guard enforces this.
- Walk-forward refit (rolling retrain, stitched OOS segments) is **deferred** — a fixed single split is
  correct and sufficient to prove the hypothesis; rolling refit is a later WO, not this slice.

### 2. Identity & cache invalidation

`latent_007` from model v1 and from v2 are different features. Every neural `FeatureSpec` carries
`model_id` + `model_version`; `feature_id` and `matrix_id` fold them in, so a retrain yields new ids —
old matrices are never silently reused (same immutable-artifact rule as `matrix.py`). Latent _names_
are stable within a model version and never compared across versions.

## Architecture (this slice)

**Landed (WO142):** Model Registry (`neural_models` / `neural_model_versions`), `NeuralEncoder`
protocol, and PCA reference encoder (`PCAEncoder` via sklearn). Operator training entry point:
`q-train-encoder`. Lake artifacts under `neural_models/<model_hash>/`. Registry sync on API startup
(`sync_neural_models_to_db`, idempotent; never downgrades a human-promoted status).

```
read_ohlcv (bars) ─► classical feature window ─► NeuralEncoder.fit (train window only)
                                                       │ artifact (lake) + metadata (DB)
                                                       ▼
                                              Model Registry (neural_models / _versions)
                                                       │ registers latent_001..NNN as neural FeatureSpecs
                                                       ▼
   build_feature_matrix ◄─ compute_feature (neural dispatch, OOS-only, model-output cache) **landed (WO143)**
        │
        ▼
   evaluate_matrix ─► feature_score_rows  ─►  latent IC vs rsi=0.091 baseline (the gate)
```

The Feature Store manages **features**; the Model Registry manages the **models that generate them**.

**Landed (WO143):** neural `FeatureSpec` registration (`register_neural_model_features`),
`compute_feature` neural dispatch with model-output cache, and the OOS-only leakage contract
(non-NaN latents strictly after `train_end`; `leakage_status` `clean` only for OOS-only requests).

**Landed (WO144):** latent IC gate (`neural/gate.py`). Latents are evaluated through the existing
`run_evaluation` pipeline and compared to the classical baseline — the best `|IC|` among classical
features on the same `(symbol, timeframe, target, horizon, OOS window)`. A model passes when
`best_latent_ic > baseline_ic * (1 + GATE_MARGIN)` with default `GATE_MARGIN = 0.0` (strict beat).
Passing models are promoted to `CANDIDATE` only; production promotion stays human. Operator entry:
`q-train-encoder --evaluate fwd_return 5`.

**Landed (WO145):** `TorchAutoencoder` (`neural/torch_autoencoder.py`) behind the same `NeuralEncoder`
protocol. Shared contract tests parametrize over PCA and autoencoder; WO143 compute and WO144 gate
required zero downstream changes.

## Out of scope (deferred, consistent with the existing deferral)

- **Transformer encoder** (roadmap Phase 4) — gated on this slice's evidence.
- **Latent Space Explorer** + **Market Similarity Search** — need a vector index (not present) and net-
  new frontend; pure scope risk until latents earn their keep.
- **Research "Neural Features" frontend tab** — stays deferred (WO137–141 omitted it deliberately);
  latents surface in the existing Feature Store/Scoring tables via the shared `feature_score_rows`.
- **Walk-forward rolling refit** — fixed train split first.
