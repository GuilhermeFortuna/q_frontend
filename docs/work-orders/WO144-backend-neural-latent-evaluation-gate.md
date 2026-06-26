# WO144 — Backend: evaluate latents through the Feature Store + IC-vs-baseline gate (payoff)

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/neural-features.md`. Depends on **WO143** (latents are computable neural features).
This is the **payoff/gate** of the autoencoder slice — the analogue of WO136 for neural features: run
the latents through the _existing_ evaluation pipeline and answer the only question that matters, **does
a latent beat the classical baseline (RSI IC ≈ 0.091) on the same target?** If not, the slice has
proven the encoder isn't earning its keep — and that is a valid, cheap outcome.

## How the pieces work today (read these files)

- `src/q_backend/features/evaluation_service.py` — `create_pending_evaluation_run` /
  `execute_evaluation_run` / `run_evaluation` / `_evaluate_into_run` take `feature_set:
list[FeatureRequest]` → `build_feature_matrix` → `evaluate_matrix` → persists `feature_score_rows`.
  **A neural `FeatureRequest` already flows through this** once WO143 lands — this WO adds the
  latent-set assembly + the baseline comparison, it does not fork the pipeline.
- `src/q_backend/features/evaluation.py` — `evaluate_matrix` (IC/RankIC/MI/stability/regime).
- `src/q_backend/features/scoring.py` — `global_score`, `cluster_redundant`, `recommended_feature_set`.
- `src/q_backend/storage/db/repositories.py` — `feature_score_rows` access (WO135).
- WO142: `NeuralModelVersion`, `set_neural_model_status`. WO143: `register_neural_model_features`.

## Goal

Given a trained model version, build a `FeatureRequest` set of its latents (OOS range), evaluate them
against a target, and report each latent's IC/MI alongside the classical baseline. Promote/demote the
model version by whether any latent clears the baseline.

```python
# src/q_backend/neural/gate.py
@dataclass(frozen=True)
class LatentGateResult:
    model_hash: str
    baseline_ic: float          # best classical feature IC on this target (e.g. rsi ~0.091)
    best_latent_ic: float
    n_latents_beating_baseline: int
    passed: bool                # best_latent_ic > baseline_ic (configurable margin)
```

## Tasks

### 1. Latent feature-set assembly — `neural/gate.py`

- `latent_feature_set(version) -> list[FeatureRequest]`: one `FeatureRequest` per registered latent of
  the model version (params carry `model_hash`). Evaluate over a window **strictly after `train_end`**
  (OOS), so scores reflect generalization, not memorization.

### 2. Baseline + comparison

- `classical_baseline_ic(session, *, symbol, timeframe, target_name, horizon) -> float`: the best
  (max `|ic|`) classical `feature_score_rows.ic` from the latest classical evaluation on the same
  `(symbol, timeframe, target, horizon)`. If none exists, run a classical eval first (reuse
  `run_evaluation` with `list_feature_specs()` classical-only). Document the "best |IC|" choice.
- `evaluate_latents(session, version, *, target_name, horizon) -> LatentGateResult`: run the eval over
  the latent feature set (persists a normal `EvaluationRun` + `feature_score_rows`, so latents appear in
  the existing Feature Scoring leaderboard with no frontend change), then assemble the result vs the
  baseline. `passed = best_latent_ic > baseline_ic * (1 + GATE_MARGIN)` (default `GATE_MARGIN = 0.0`;
  document).

### 3. Model status from evidence

- On `passed`, `set_neural_model_status(model_hash, CANDIDATE)`; otherwise leave `TRAINED` (never
  auto-`PRODUCTION` — promotion to production stays a human decision, like classical feature status).
- CLI hook: extend `cli/q_train_encoder.py` with `--evaluate target horizon` so a single operator
  command trains → evaluates → reports the gate result. (Production trigger; not on a request path.)

## Guardrails

> **OOS only.** Latents are scored strictly after `train_end`; an in-sample score would be the leak
> WO143 forbids — assert the evaluated range starts after `train_end`.
> **Reuse, don't fork.** Latents go through `run_evaluation`/`evaluate_matrix`/`feature_score_rows`
> unchanged; this WO assembles inputs and compares outputs only.
> **Honest baseline.** Baseline = best classical IC on the **same** symbol/timeframe/target/horizon, not
> a cherry-picked feature or a different target.
> **No auto-promotion to production.** Gate sets `CANDIDATE` at most; humans promote.
> **A failing gate is a valid result** — report it plainly; do not tune the margin to force a pass.

## Tests

- `tests/neural/test_latent_gate.py`:
  - `latent_feature_set` produces one request per latent; the evaluated index starts after `train_end`.
  - with a synthetic encoder whose latent is constructed to correlate with the target, `passed is True`
    and `best_latent_ic > baseline_ic`; with a noise latent, `passed is False`.
  - `evaluate_latents` persists an `EvaluationRun` + `feature_score_rows` queryable like a classical run.
  - a passing gate sets status `CANDIDATE`; a failing gate leaves `TRAINED`.

## Docs

- `docs/design/neural-features.md`: tick the gate landed; record the baseline definition + `GATE_MARGIN`.
- Cross-link [[feature-intelligence-batch]] / `feature-intelligence.md`: latents now appear in the same
  Feature Scoring leaderboard; the Phase-2 gate's "headroom" question is now answered empirically per
  model.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: a real `LatentGateResult` for a trained model on CCM\$ H1 `fwd_return` h=5
  — `baseline_ic`, `best_latent_ic`, `n_latents_beating_baseline`, `passed` — and the resulting model
  status. This same comparison is what WO145's nonlinear autoencoder is then measured against
  (AE latents vs the classical baseline **and** vs the PCA control).

## Out of scope

- Nonlinear torch autoencoder — **WO145** (the primary encoder; built regardless, then evaluated
  through this same gate for an apples-to-apples comparison against the PCA control).
- Transformer / Latent Space Explorer / Market Similarity Search / Neural Features frontend tab —
  deferred (design "Out of scope").
- Biasing GA discovery's primitive pool with latent scores — latents are not `ind.*` node kinds; a
  follow-up beyond this slice (cf. WO136).
