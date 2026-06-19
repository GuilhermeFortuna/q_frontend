# WO46 — Backend: seed discovered features into the GA + diversity-aware selection

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "Feature Engine". WO42–WO44 widened the grammar; WO45 mined and
validated a ranked set of `FeatureDefinition`s on a leakage-free discovery segment. **This WO closes
the loop**: it (1) **seeds** those validated features into the genetic algorithm's initial
population so the GA composes strategies _from real edge_, and (2) adds **diversity-aware selection**
so the run yields a **book of low-correlation single-symbol strategies** instead of 50 variants of
one — exactly what a single-instrument trader needs for regime coverage. Design:
**`docs/design/feature-engine.md` §6, §8** (read them).

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/genome/operators.py` — `build_initial_population(rng, population_size,
max_nodes, max_depth)` builds gen-0 as **~50% mutated registry fixtures + ~50% random DAGs**.
  `clone_genome`, `crossover_genomes`, `mutate_genome`, `draw_valid_child`. **You add a third
  source: feature-seeded genomes.**
- `src/q_backend/optimization/genetic_search.py` — `GeneticCandidateProvider` (owns the population;
  `report(results)` runs fitness → elitism → tournament → crossover/mutation), and
  `GeneticStrategySearchOrchestrator` (the generational loop + `finalize()` with DSR/lock-box).
  Fitness today = `robustness_score − complexity_penalty` (OOS only). `CandidateResult` carries
  `oos_equity_curve` (a `pd.Series`) — **the raw material for a correlation penalty.**
- `src/q_backend/backtesting/genome/schema.py` — `Genome`/`GenomeNode`. A `FeatureDefinition`
  (WO45) is a sub-DAG of these nodes; seeding splices it under a comparison/logic head to form a
  legal entry/exit genome.
- `src/q_backend/optimization/strategy_search.py` — `GeneticFinalizeSummary` / `result_summary`
  (where the discovered-feature usage + book correlation get persisted, additively).

---

## Goal

```python
# Gen-0 includes genomes built from WO45's validated features; selection rewards genomes whose
# OOS return stream is decorrelated from already-selected elites → a diversified book.
provider = GeneticCandidateProvider(genetic_cfg, search_cfg, seed_features=report.features)
```

## Tasks

### 1. Feature-seeded initial population (design §6.1)

- Extend `build_initial_population` with an optional `seed_features: list[FeatureDefinition]` and a
  fraction (e.g. config `feature_seed_fraction: float = 0.25`). For that fraction of gen-0:
  - Take a validated feature sub-DAG (oscillator/bool root), splice it under a small head that turns
    it into entry/exit signals: an oscillator feature → `cmp.cross_above`/`cross_below` with a
    `{"param": "threshold"}`; a bool feature → use directly (optionally `logic.and` with a session
    gate). Assign fresh node ids, validate, redraw the head on invalid.
  - Carry `metadata.seed_feature_id` for provenance.
- Keep the existing registry-seed / random halves; the feature-seed slice **replaces part of the
  random half** so `population_size` is unchanged. With `seed_features=[]` the split is **identical
  to WO39** (byte-for-byte trajectory under a fixed seed).
- Plumb `seed_features` from WO45's `FeatureDiscoveryReport` through the orchestrator/job into the
  provider. When feature discovery is disabled, `seed_features=[]`.

### 2. Diversity-aware selection (design §6.2)

In `GeneticCandidateProvider.report()`, after computing base fitness
(`robustness_score − complexity_penalty`), apply an **additive** novelty/correlation penalty:

```text
fitness_div = base_fitness − ρ · max_corr(candidate.oos_returns, selected_elite_oos_returns)
```

- Derive each candidate's OOS return stream from `oos_equity_curve` (pct-change). `max_corr` =
  the highest absolute Pearson correlation to any already-selected elite this generation.
- `ρ` = config `diversity_lambda: float = 0.0` (**default 0 → behavior identical to WO39**; opt-in).
  Elites are chosen greedily: pick the top base-fitness genome, then re-rank the rest by
  `fitness_div` against the growing elite set (fitness sharing). This spreads elites across
  uncorrelated return profiles.
- Guard missing/short equity curves (gated/`no_result` candidates) — they keep base fitness, no
  correlation term.

### 3. Persist the book (additive — design §6.3)

On `result_summary` (JSON, no migration): add `seed_feature_ids` (which discovered features seeded
the run), `champion_seed_feature_id` (nullable), and `book_correlation` — the pairwise OOS-return
correlation matrix of the final top-k leaderboard (so the UI can show how diversified the book is).
Best-effort; absent when diversity/discovery disabled.

### 4. Config wiring

Add to `GeneticSearchConfig`: `feature_seed_fraction: float = 0.25` and `diversity_lambda: float =
0.0`. Both default to a **no-op-preserving** configuration relative to WO39 (fraction only matters
when `seed_features` is non-empty; `diversity_lambda=0` disables the penalty).

## Guardrails

> **Disabled = identical.** With `seed_features=[]` **and** `diversity_lambda=0`, a genetic run is
> byte-identical to WO39/WO40 (population trajectory under a fixed `init_seed`, leaderboard,
> persistence, payloads). Prove it with a seeded-trajectory snapshot both ways.

> **Selection stays OOS-only.** Both the base fitness and the diversity penalty derive from OOS
> data (`robustness_score`, `oos_equity_curve`). Never use in-sample. `MINIMIZE_DRAWDOWN` stays
> oriented so higher fitness = more robust.

> **Seeds are legal genomes.** Every feature-seeded genome passes `validate_genome` and
> `test_strategy_causality.py`. Invalid heads are redrawn, never emitted.

> **Determinism.** Same `init_seed` + same `seed_features` → identical population trajectory and
> identical elite/diversity ordering.

> **`evaluate_candidate` untouched.** As in WO39, the evaluator/runner are read-only; new code lives
> in the provider, the population builder, and additive config/persistence.

## Tests — `tests/.../test_feature_seeding.py`, extend `test_genetic_search.py`

- **Seeding:** with `seed_features` non-empty and `feature_seed_fraction=0.25`, ~25% of gen-0 carry
  `metadata.seed_feature_id`, all valid; `population_size` unchanged; the registry-seed half intact.
- **No-op parity:** `seed_features=[]` and `diversity_lambda=0` reproduce the exact WO39 seeded
  trajectory (snapshot).
- **Diversity penalty:** given two equal-base-fitness candidates, the one less correlated to the
  chosen elite is preferred when `diversity_lambda>0`; with `=0`, order is unchanged.
- **Book correlation persisted:** a run with `diversity_lambda>0` writes `book_correlation` and
  `seed_feature_ids` on `result_summary`; absent otherwise.
- **Causality + determinism:** feature-seeded genomes pass causality; same seed → identical run.
- Existing genetic-search / DSR / lock-box / genome tests green and unmodified.

## Docs

`q_backend/README.md`: extend the genetic-synthesis note — gen-0 seeded from discovered features,
diversity-aware selection producing a **book** of decorrelated single-symbol strategies, persisted
book correlation. Link the design doc.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- No-op-preserving defaults; WO39/WO40 paths byte-identical; existing tests untouched and green.
- In your final message, paste: the extended `build_initial_population` signature (with
  `seed_features`), the `GeneticSearchConfig` additions (`feature_seed_fraction`,
  `diversity_lambda`), the diversity-penalty formula as implemented, and the additive
  `result_summary` keys (`seed_feature_ids`, `champion_seed_feature_id`, `book_correlation`).
  **WO47 (frontend) renders these.**

## Out of scope

- Frontend rendering of features / book correlation (WO47).
- New primitives (WO42–44) or the discovery harness itself (WO45).
- Multi-objective (NSGA-II) selection — diversity here is a scalar fitness-sharing penalty, not a
  Pareto front (stays consistent with the single-objective ranking the platform mandates).
