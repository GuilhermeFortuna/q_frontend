# WO136 — Backend: wire feature scores into GA discovery's primitive pool

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/feature-intelligence.md`. Depends on **WO135** (persisted feature scores). This is
the **payoff** of the Feature Intelligence batch: the GA discovery from
[[ga-discovery-diagnosis]] currently samples indicator primitives uniformly; here it samples them
**weighted by evaluated signal**, so search spends its budget on features that actually carry signal
and avoids redundant ones. Closes Phase 2.

## How the pieces work today (read these files)

- `src/q_backend/backtesting/genome/operators.py`
  - line ~40: `INDICATOR_KINDS = [kind for kind in NODE_SPECS if kind.startswith("ind.") and kind not
in {…}]` — **the uniform primitive pool** GA mutation samples from.
  - line ~784: `kind = rng.choice(["ind.ma", "ind.ema", "ind.rsi"])` and other `rng.choice` over
    `INDICATOR_KINDS` — the sampling sites to make weight-aware.
- `src/q_backend/backtesting/genome/search_space.py::derive_genome_search_space` — the existing
  param-bound derivation (WO87). The feature-score bias is the **node-kind** analogue: scores
  influence _which primitives_ enter genomes, bounds still come from `GENOME_PARAM_BOUNDS`.
- `src/q_backend/storage/db/repositories.py` (WO135) — `FeatureScoreRow` access; add a
  `latest_scores_by_node_kind(session)` reader.
- `src/q_backend/features/scoring.py` (WO134) — `global_score`, `cluster_id`, `is_representative`.

## Goal

A weighting layer maps each `ind.*` node kind to a sampling weight from the latest evaluation, and the
GA samples primitives proportionally — defaulting to uniform when no scores exist (so discovery never
_depends_ on having run an evaluation).

```python
# src/q_backend/backtesting/genome/primitive_weights.py
def primitive_weights(
    session, *, symbol: str | None = None, timeframe: str | None = None
) -> dict[str, float]:
    """node_kind -> weight in (0, 1]. Uniform fallback when no scores."""
```

## Tasks

### 1. Map feature scores → node-kind weights

- A `FeatureSpec` carries `node_kind` (WO127). Aggregate the latest `FeatureScoreRow.global_score`
  per `node_kind` (max across that kind's feature_ids, or mean — pick one, document it).
- `weight = clamp(global_score, MIN_WEIGHT=0.05, 1.0)` so no primitive is fully starved (keeps the
  search ergodic). Redundant primitives (`is_representative == False`) get an extra `0.5` factor so the
  pool favors cluster representatives.
- No scores for a kind (or no evaluation run at all) → weight `1.0` (uniform). The function must return
  a full map over `INDICATOR_KINDS` regardless.

### 2. Make the sampling sites weight-aware — `operators.py`

- Replace the uniform `rng.choice(INDICATOR_KINDS)` / `rng.choice([...])` indicator picks with a
  weighted choice using `primitive_weights`. Thread the weight map in via the operators' existing
  config/rng plumbing — **do not** call the DB from inside a hot mutation loop; resolve the map **once
  per search run** and pass it down (mirror how other run-scoped config reaches operators).
- Keep the curated small-set choices (e.g. `["ind.ma","ind.ema","ind.rsi"]`) but weight them by the
  same map restricted to those kinds.

### 3. Wiring + flag

- Resolve `primitive_weights(session, symbol, timeframe)` where a search run is set up (the discovery
  orchestrator that builds operator config) and pass it into operators.
- Gate behind a config flag `use_feature_weighted_primitives` (default **True**); `False` →
  all-uniform, preserving exact current behavior for A/B comparison.

## Guardrails

> **Uniform fallback is mandatory.** Discovery must run identically to today when no evaluation exists
> or the flag is off. Feature scores _bias_ search; they are never a hard dependency.
> **No DB in the hot loop.** Weights are resolved once per run and passed down; operators stay pure
> functions of `(rng, config, weights)`.
> **Ergodicity preserved.** `MIN_WEIGHT` floor means every primitive keeps a non-zero chance — scores
> tilt the search, they don't prune the space (that would risk missing a regime-specific feature).
> **Determinism.** Given the same `rng` seed + weight map, mutation output is reproducible.

## Tests

- `tests/genome/test_primitive_weights.py`:
  - `primitive_weights` returns a full map over `INDICATOR_KINDS`; uniform (all `1.0`) when the score
    table is empty.
  - a high-scoring kind gets a higher weight than a low-scoring one; a non-representative kind is
    down-weighted; all weights ≥ `MIN_WEIGHT`.
- `tests/genome/test_weighted_sampling.py`:
  - over many seeded draws, a high-weight kind is chosen more often than a low-weight kind (statistical
    assertion with a fixed seed).
  - `use_feature_weighted_primitives=False` reproduces the current uniform distribution exactly.

## Docs

- `docs/design/feature-intelligence.md`: tick Phase 2 complete; document the weighting formula + the
  flag.
- Cross-link [[ga-discovery-diagnosis]] / `docs/design/search-space*` if a discovery design doc exists:
  note that node-kind selection is now score-biased (param bounds unchanged).

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the `primitive_weights` map for a real evaluated symbol, and the seeded-draw
  histogram showing a high-scoring primitive sampled more often than a low-scoring one (and that the
  flag-off path is unchanged).

## Out of scope

- Optimization param-search changes — discovery only; bounds still come from WO87/`GENOME_PARAM_BOUNDS`.
- Neural feature phases (roadmap Phase 3/4) — gated on this batch's evaluation evidence (design doc
  "Go/no-go gate").
