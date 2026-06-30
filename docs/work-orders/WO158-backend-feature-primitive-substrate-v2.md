# WO158 — Backend: current-code feature primitive substrate and normalization

## Shared context (read first)

Read `docs/design/instrument-specific-alpha-research.md` and `docs/design/feature-engine.md`. This WO
supersedes the implementation instructions in WO42; do not copy WO42's old assumptions about the
operator pools. The current backend already has adaptive mutation, latent-universe filtering,
score-biased seeding, exit-policy operators, and a Feature Store.

Backend repo: `q_backend`, Python managed with `uv`. This is a backend-only WO.

## Files to read

- `src/q_backend/backtesting/genome/node_specs.py`
- `src/q_backend/backtesting/genome/composite_strategy.py`
- `src/q_backend/backtesting/genome/param_bounds.py`
- `src/q_backend/backtesting/genome/operators.py`
- `src/q_backend/backtesting/genome/validate.py`
- `src/q_backend/backtesting/genome/latent_universe.py`
- `src/q_backend/backtesting/genome/score_bias.py`
- `src/q_backend/features/registry.py`
- `tests/backtesting/test_genome_operators.py`
- `tests/backtesting/test_genome_search_space.py`
- `tests/backtesting/test_strategy_causality.py`

## Goal

Add causal normalization primitives that are usable by direct genomes, the Feature Store, random
initialization, and mutation without regressing the current adaptive/latent-aware GA behavior.

Required kinds:

- `transform.zscore(window)`
- `transform.rank(window)` — percentile rank of the current value inside its trailing window
- `transform.pct_change(change_bars)`
- `transform.clip(clip_low, clip_high)`

## Tasks

1. Add explicit additive generation metadata to `NodeSpec` (category and whether a node is eligible
   for random initialization, add-node mutation, and swap mutation). Derive operator pools from the
   current registry while preserving latent-universe filtering and existing output-type/arity checks.
   `NodeSpec` is a frozen dataclass instantiated positionally throughout `NODE_SPECS`: every new field
   must have a backward-compatible default or be supplied by a separate derivation layer.
2. Register the four transforms in `NODE_SPECS`, implement their vectorized evaluation in
   `CompositeStrategy`, and add bounded parameter definitions to `GENOME_PARAM_BOUNDS`.
3. Register equivalent classical `FeatureSpec` entries so the existing Feature Store/evaluation path
   can compute the same recipes without a second implementation.
4. Make every transform reachable in seeded random populations and structural mutation. Preserve
   deterministic output for a fixed seed and feature universe.
5. Keep existing genomes byte-compatible when they contain none of the new kinds.

## Guardrails

- Rolling calculations use trailing windows with no centering or full-series normalization.
- `pct_change` uses a positive lag; no negative shift is valid.
- Do not replace current adaptive operator weighting, latent filtering, or score biasing.
- New `NodeSpec` fields are defaulted or derived. Do not rewrite the existing positional
  `NODE_SPECS` entries merely to populate generation metadata; their construction and meaning must
  remain compatible.
- One mathematical implementation per primitive; Feature Store and genome execution must agree.
- No UI, new experiment job, or instrument-specific assumptions in this WO.

## Tests

- Add `tests/backtesting/genome/test_normalization_nodes.py` for hand-computed values, warm-up NaNs,
  invalid bounds, and prefix causality.
- Extend random-genome/operator tests to prove all four kinds are reachable and deterministic.
- Add a regression that constructs representative existing `NodeSpec` entries with the current
  positional arguments and proves the new metadata defaults preserve their behavior.
- Add Feature Store parity tests: a FeatureSpec result equals the corresponding genome node series.
- Run:

```bash
uv run pytest \
  tests/backtesting/genome/test_normalization_nodes.py \
  tests/backtesting/test_genome_operators.py \
  tests/backtesting/test_genome_search_space.py \
  tests/backtesting/test_strategy_causality.py \
  tests/features/test_feature_registry.py \
  tests/features/test_compute.py
```

## Docs

Update `docs/design/instrument-specific-alpha-research.md` to mark WO158 implemented and record the
final `NodeSpec` generation fields and transform parameter bounds.

## Definition of done

- The four transforms are causal, searchable, Feature-Store-visible, and reachable by the GA.
- Existing non-transform genome trajectories remain deterministic under their prior feature universe.
- Targeted tests and full `uv run pytest` pass.

## Out of scope

Session/regime/multi-timeframe context (WO159), exogenous inputs (WO160), feature selection (WO162),
and research orchestration (WO164).
