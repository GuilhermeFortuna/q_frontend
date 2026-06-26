# WO134 — Backend: Redundancy clustering + global feature score + recommended sets

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/feature-intelligence.md`. Depends on **WO133** (per-feature metrics) + **WO129**
(matrix, for the feature×feature correlation). WO135 persists these outputs; WO136 consumes the score

- clusters.

**Principle:** raw IC isn't enough — five copies of the same momentum feature all IC well but add no
information. Cluster redundant features, collapse each cluster to its best representative, and roll
the metrics into one comparable **global score** so discovery can pick a diverse, high-signal pool.

## How the pieces work today (read these files)

- `src/q_backend/features/evaluation.py` (WO133) — `FeatureEvaluation` (`ic`, `rank_ic`,
  `mutual_info`, `stability`, `regime_ics`, `leakage_status`).
- `src/q_backend/features/matrix.py` (WO129) — `FeatureMatrix.frame` (feature×time) for the
  feature-to-feature correlation matrix.

## Goal

```python
# src/q_backend/features/scoring.py
@dataclass(frozen=True)
class RedundancyCluster:
    cluster_id: int
    feature_ids: list[str]
    representative: str          # highest global_score in the cluster

@dataclass(frozen=True)
class FeatureScore:
    feature_id: str
    global_score: float          # 0..1 composite (see Task 2)
    cluster_id: int
    is_representative: bool

def cluster_redundant(matrix: FeatureMatrix, *, threshold: float = 0.9) -> list[RedundancyCluster]: ...
def score_features(
    evaluations: list[FeatureEvaluation], clusters: list[RedundancyCluster]
) -> list[FeatureScore]: ...
def recommended_feature_set(scores: list[FeatureScore], *, top_k: int = 20) -> list[str]: ...
```

## Tasks

### 1. Redundancy clustering

- Compute the absolute Spearman correlation matrix across feature columns of `matrix.frame` (drop the
  warm-up head via `valid_from`).
- Single-linkage agglomerate: features with `|corr| >= threshold` land in the same cluster
  (connected-components over the thresholded graph is sufficient — no sklearn needed). Deterministic
  cluster ids by sorted member order.

### 2. Global score

- `global_score = w1*|rank_ic| + w2*stability + w3*regime_consistency + w4*uniqueness`, weights summing
  to 1 (default `0.4/0.3/0.15/0.15`, named constants).
  - `regime_consistency` = `1 - normalized spread of regime_ics`.
  - `uniqueness` = `1 / cluster_size` (a feature in a 1-member cluster is fully unique).
- A `leakage_status != "clean"` feature gets `global_score` multiplied by a penalty (`0.5`) and is
  flagged — never silently top-ranked.
- Clamp to `[0, 1]`.

### 3. Representative + recommended set

- Per cluster, `representative` = highest `global_score`; mark `is_representative`.
- `recommended_feature_set(top_k)` = the `top_k` highest-scoring **representatives** (one per cluster,
  so the set is diverse), score-sorted desc.

## Guardrails

> **Diversity over raw IC.** The recommended set takes one feature per redundancy cluster — never two
> members of the same cluster, however high their individual IC.
> **Leakage penalized, not hidden.** A suspect feature can still appear but with the penalty applied
> and the flag preserved.
> **Deterministic.** Same evaluations + matrix → identical clusters, scores, and recommended set
> (stable tie-breaking by `feature_id`).
> **Pure compute.** Dataclasses out; no DB/HTTP. Persistence is WO135.

## Tests

- `tests/features/test_scoring.py`:
  - two perfectly-correlated synthetic features land in one cluster with one representative; an
    uncorrelated third is its own cluster.
  - `recommended_feature_set` never returns two members of the same cluster.
  - a `leakage_status="suspect"` feature with high IC ranks below an equivalent clean feature (penalty
    applied).
  - determinism across two runs.

## Docs

- `docs/design/feature-intelligence.md`: tick clustering + global score; record the weight defaults.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the cluster list + top-10 recommended set for a real matrix, showing the
  redundant momentum features collapsed to one representative.

## Out of scope

- Storing scores / leaderboard endpoint — **WO135**.
- Feeding the score into discovery — **WO136**.
