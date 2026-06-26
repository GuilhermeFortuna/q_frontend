# WO143 — Backend: neural feature source (latents as FeatureSpecs + PIT-safe neural compute)

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/neural-features.md` (esp. §"The two hard problems"). Depends on **WO142** (Model
Registry + trained encoder). This WO makes a trained encoder's latents **first-class features** that
flow through the existing matrix/eval stack unchanged — and enforces the **OOS-only leakage contract**
that keeps them honest.

**Principle:** a latent is a named, versioned, causal bar→value series exactly like `rsi`. The smallest
possible new surface; no fork of the matrix/eval pipeline.

## How the pieces work today (read these files)

- `src/q_backend/features/registry.py` — `FeatureSpec` (dataclass), `_make_spec`, `FEATURE_SPECS`,
  `list_feature_specs`, `get_feature_spec`, `feature_id`, `resolve_params`,
  `assert_catalog_consistent` (validates `node_kind ∈ NODE_SPECS` + param_keys). **This validation must
  be bypassed for neural specs** — they have no `NODE_SPECS` node kind.
- `src/q_backend/features/compute.py` — `compute_feature(bars, spec, params) -> FeatureSeries`,
  `_compute_node_outputs` dispatch, `_apply_warmup` (NaN-trims the warm-up region). The neural dispatch
  mirrors this shape.
- `src/q_backend/features/matrix.py` — `FeatureRequest`, `build_feature_matrix` loops
  `compute_feature` per request and content-addresses `matrix_id` over each feature's
  `(feature_id, version, params)`. `feature_id` must fold in `model_hash` so a retrain invalidates.
- `src/q_backend/features/leakage.py` — `FORWARD_LOOKING_KINDS`, `assert_causal` — the leakage guard to
  extend with the neural OOS rule.
- WO142: `neural/encoder.py`, `read_neural_model`, `get_neural_model_version`.

## Goal

A trained model version registers `latent_001..latent_{n}` as neural `FeatureSpec`s; `compute_feature`
dispatches them to the encoder (one forward pass fills all latents via a model-output cache); latents
are emitted **only for bars strictly after `train_end`** and carry `leakage_status` accordingly.

```python
spec = FeatureSpec(name="latent_007", version=1, source="neural",
                   model_hash="…", node_kind=None, forward_window=0, ...)
```

## Tasks

### 1. Source discriminator on FeatureSpec — `registry.py`

- Add `source: str` to `FeatureSpec` (`"classical"` default; `"neural"`) and optional
  `model_hash: str | None`, `latent_index: int | None`. `node_kind` becomes `str | None`.
- `register_neural_model_features(version)`: given a `NeuralModelVersion`, build one neural `FeatureSpec`
  per latent name and add to the catalog (`FEATURE_SPECS`), keyed `latent_NNN@<model_hash[:8]>` so two
  models' latents never collide.
- `assert_catalog_consistent`: **skip the `NODE_SPECS` param-key check when `source == "neural"`**;
  instead assert neural specs carry a `model_hash`, `forward_window == 0`, and a known `latent_index`.
- `feature_id(spec, params)`: for neural specs include `model_hash` in the hash input (so v1 vs v2
  latents get distinct ids and matrices).

### 2. PIT-safe neural compute — `compute.py`

- `compute_feature` dispatches `source == "neural"` to `_compute_neural(spec, bars)`:
  - Load the encoder once via a **model-output cache** keyed `(model_hash, bars-range hash)` so the
    first latent computes `encoder.transform(window)` for **all** latents and the remaining
    `n−1` slice the cached frame (no `n` forward passes). An in-process LRU is sufficient; document the
    key.
  - Build the encoder's `input_features` window from `bars` using the classical compute path (reuse
    `build_feature_matrix`/`compute_feature` for the input feature list recorded on the model version) —
    the encoder consumes standardized classical features, not raw OHLCV.
  - Slice column `spec.name`'s latent, reindex to `bars["time"]`.
- **OOS trim:** NaN every bar `≤ train_end` (analogous to `_apply_warmup`). `warmup_bars` for a neural
  spec = count of bars up to and including `train_end`.

### 3. Leakage guard — `leakage.py`

- A neural feature is `clean` **iff** its non-NaN range is entirely `> train_end`; otherwise `suspect`.
- `assert_causal` gains a neural branch asserting no non-NaN latent value at a bar `≤ train_end`.
- `compute_feature` sets `FeatureSeries.leakage_status` from this rule (mirrors the existing
  `FORWARD_LOOKING_KINDS → "suspect"` logic).

## Guardrails

> **No future at fit OR transform.** Latents exist only strictly after `train_end`. Any non-NaN value
> at/inside the train window is a leak — the guard must fail the test suite, not warn.
> **One forward pass per (model, bar-range).** Never call `encoder.transform` once per latent; the
> model-output cache fans the single transform out to all latents.
> **Identity folds in `model_hash`.** A retrain ⇒ new `feature_id`/`matrix_id`; old matrices are never
> reused for new model semantics (same immutable rule as `matrix.py`).
> **Classical path untouched.** `source == "classical"` features compute exactly as today — bit-parity
> with current `compute_feature` output (assert it).
> **Determinism.** Same model + same bars ⇒ same latent series.

## Tests

- `tests/features/test_neural_feature_source.py`:
  - `register_neural_model_features` adds `n` specs; `assert_catalog_consistent` passes with them
    present; classical specs unchanged.
  - `feature_id` differs for the same `latent_index` across two `model_hash`es.
- `tests/features/test_neural_compute.py`:
  - latents are NaN for every bar `≤ train_end` and finite after (OOS contract); `leakage_status` is
    `clean` for an OOS-only request and `suspect` when the range overlaps the train window.
  - the model-output cache yields `encoder.transform` called **once** for an `n`-latent matrix (assert
    via a spy/counter), and `build_feature_matrix` produces an `n`-column frame.
  - classical `compute_feature` output is byte-identical to a pre-WO143 snapshot (regression).

## Docs

- `docs/design/neural-features.md`: tick the neural feature source + OOS leakage contract landed.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: for a real trained model, the latent matrix head showing NaN ≤ `train_end`
  and finite values after, plus the `leakage_status` for an OOS request and an overlapping request.

## Out of scope

- Scoring latents / the IC-vs-baseline gate — **WO144**.
- Walk-forward rolling refit (fixed split only) — deferred (design "Out of scope").
- Nonlinear torch encoder — **WO145**.
