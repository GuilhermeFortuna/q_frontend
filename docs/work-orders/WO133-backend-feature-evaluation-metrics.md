# WO133 — Backend: Feature evaluation metrics service (IC / Rank IC / MI / stability)

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/feature-intelligence.md`. Depends on **WO129** (feature matrix) + **WO132**
(targets). WO134 (redundancy/score) + WO135 (persistence) consume these metrics.

**Principle:** score each feature against a defined target with leakage-safe, time-aware statistics.
The metric set directly feeds GA discovery (WO136), so it must be cheap, deterministic, and honest
about stability — a feature that ICs well only in one regime is not a good feature.

## How the pieces work today (read these files)

- `src/q_backend/features/matrix.py` (WO129) — `build_feature_matrix(...) -> FeatureMatrix`
  (`.frame` columns = `feature_id`s, time index; `.manifest["valid_from"]`).
- `src/q_backend/features/targets.py` (WO132) — `compute_target`, `align_feature_target`,
  `purge_embargo`, `embargo_bars`.
- `src/q_backend/features/compute.py` (WO128) — `assert_causal` (call it on a sampled feature as a
  belt-and-suspenders leakage guard in the evaluation path).
- `src/q_backend/optimization/analytics.py` (WO113) — house pattern for a pure compute service that
  returns plain dicts (no Plotly/sklearn-heavy deps unless already vendored — check `pyproject.toml`
  before importing `sklearn`; if MI needs it and it's absent, implement a binned MI estimator instead).

## Goal

```python
# src/q_backend/features/evaluation.py
@dataclass(frozen=True)
class FeatureEvaluation:
    feature_id: str
    target: str
    ic: float            # Pearson(feature, target)
    rank_ic: float       # Spearman
    mutual_info: float
    stability: float     # 1 - normalized std of per-window rank_ic (see Task 2)
    regime_ics: dict[str, float]   # rank_ic per volatility regime bucket
    n_obs: int
    leakage_status: str

def evaluate_feature(
    feature: pd.Series, target: pd.Series, *, n_windows: int = 6, regimes: int = 3
) -> FeatureEvaluation: ...

def evaluate_matrix(
    matrix: FeatureMatrix, target: pd.Series
) -> list[FeatureEvaluation]: ...
```

## Tasks

### 1. Core metrics

- Align with `align_feature_target` first (drops warm-up head + horizon tail).
- `ic` = Pearson corr; `rank_ic` = Spearman corr; both on the aligned pair.
- `mutual_info`: prefer `sklearn.feature_selection.mutual_info_regression` **iff sklearn is already a
  dependency**; otherwise a deterministic binned-histogram MI estimator (document the fallback). Use a
  fixed `random_state` if the sklearn path has one — determinism is required.

### 2. Stability across time

- Split the aligned series into `n_windows` contiguous time windows. Compute `rank_ic` per window.
- `stability = 1 - (std(window_rank_ics) / (|mean(window_rank_ics)| + eps))`, clamped to `[0, 1]`. A
  feature with consistent sign/magnitude across windows scores high; a regime-only feature scores low.

### 3. Regime robustness

- Bucket bars into `regimes` quantile buckets of **causal** realized vol (reuse
  `compute_realized_vol`; the bucket boundary at `t` uses vol up to `t`, no future). Report `rank_ic`
  within each bucket as `regime_ics={"low":…,"mid":…,"high":…}`.

### 4. `evaluate_matrix`

- For each `feature_id` column, build its series, sample-check `assert_causal` on the underlying spec
  (skip if it raises → mark `leakage_status="suspect"` and still report metrics, flagged), and produce
  a `FeatureEvaluation`. One target per call (callers loop targets).

## Guardrails

> **Leakage-safe throughout.** Alignment uses the WO132 join; any train/test style split uses
> `purge_embargo`. Regime buckets are causal. A feature that fails `assert_causal` is flagged, never
> silently scored as clean.
> **Deterministic.** Same matrix + target → identical metrics. Fix any RNG seed; no wall-clock.
> **Pure compute.** Returns dataclasses/dicts; no DB, no HTTP, no file writes. Persistence is WO135.
> **NaN honesty.** If `n_obs` after alignment is below a floor (`MIN_OBS = 100`), return metrics as
> `nan` with `n_obs` set, not a fabricated number.

## Tests

- `tests/features/test_evaluation.py`:
  - a feature constructed as `target + small noise` scores high `ic`/`rank_ic`; pure-noise feature
    scores ≈ 0.
  - `stability` is higher for a uniformly-correlated feature than for one correlated only in the first
    window.
  - `regime_ics` has the configured bucket keys; buckets are causal (changing future bars doesn't move
    an earlier bar's bucket).
  - below `MIN_OBS`, metrics are `nan` with correct `n_obs`.
  - determinism: two runs on the same inputs are equal.

## Docs

- `docs/design/feature-intelligence.md`: tick the metric set; note the MI dependency decision
  (sklearn vs. binned fallback).

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: a `FeatureEvaluation` for one real feature vs. `fwd_return(h)` on a sample
  symbol, and confirmation the pure-noise control scores ≈ 0 IC.

## Out of scope

- Redundancy clustering, global score, recommended sets — **WO134**.
- Storing results / leaderboard endpoint — **WO135**.
