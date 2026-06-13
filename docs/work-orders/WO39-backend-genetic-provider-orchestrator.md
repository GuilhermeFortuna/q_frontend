# WO39 — Backend: `GeneticCandidateProvider` + evolution orchestrator

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "Generative Discovery" turns registry AutoML into **genetic
strategy synthesis**. WO38 shipped the genome DSL + `CompositeStrategy` interpreter +
`derive_genome_search_space`. **This WO adds the evolution engine**: a `GeneticCandidateProvider`
that owns a population and runs selection/crossover/mutation, and a thin
`GeneticStrategySearchOrchestrator` that evolves G generations by reusing WO31's
`evaluate_candidate` unchanged. It is **backend only** — no DSR, no lock-box, no DB, no API,
no UI (DSR/lock-box/persistence are WO40; UI is WO41). Full design: **`docs/design/
genetic-strategy-search.md` §4 and §5.3** (read them).

**The seam is already sufficient — this is the proof.** WO31's design intent was that genetic
search drops in as a new `CandidateProvider` with **no semantic change** to `evaluate_candidate`,
`WalkForwardRunner`, or `StrategySearchRunner`. WO34 confirmed it (design §1). Honor that:
the new code is a provider + a ~40-line orchestrator, nothing more.

---

## How the pieces you're composing work today (read these files)

- `src/q_backend/optimization/strategy_search.py` (WO31) — `SearchCandidate`,
  `CandidateProvider` protocol (`candidates()` + `report(results)`), `CandidateResult`,
  `evaluate_candidate(candidate, config, backtest_runner, progress_callback, should_stop)`,
  `StrategySearchRunner`, `SearchProgress`, `StrategySearchConfig`. **Reuse `evaluate_candidate`
  verbatim** — it already runs the per-candidate walk-forward, OOS gating, and `robustness_score`.
- WO38's genome module — `Genome`/`GenomeNode` models, `compile_genome`, validator
  (`GenomeValidationError`), `derive_genome_search_space`, `GENOME_PARAM_BOUNDS`, the v1
  primitive allowlist + output-type tags, and the registry-strategy genome fixtures (the
  "known-good building blocks" for seeding the initial population).
- `src/q_backend/optimization/objectives.py` — `resolve_objective`; fitness ranks on
  `robustness_score` (OOS, higher = better), never in-sample.
- The registry strategy genome fixtures from WO38 — used for the 50% "mutated registry seed"
  half of generation 0 (design §4.4).

---

## Goal

```python
provider = GeneticCandidateProvider(genetic_cfg, search_cfg)   # owns the population
orchestrator = GeneticStrategySearchOrchestrator(search_cfg, provider, backtest_runner)
result = orchestrator.run(progress_callback, should_stop)
#   evolves G generations; each generation evaluates `population_size` genomes via
#   evaluate_candidate, then provider.report() advances the population.
#   Returns the same StrategySearchResult shape WO31 produces (full leaderboard, ranked OOS),
#   plus per-generation results carried for WO40 to persist.
```

Deterministic given `init_seed`. Reuses WO31's evaluator and WO38's interpreter wholesale.

## Tasks

### 1. `GeneticSearchConfig` (design §4.1) — nested in `StrategySearchConfig`

```python
class GeneticSearchConfig(BaseModel):
    population_size: int = Field(default=40, ge=10, le=200)
    generations: int = Field(default=10, ge=2, le=50)
    elite_count: int = Field(default=4, ge=1)
    crossover_rate: float = Field(default=0.7, ge=0.0, le=1.0)
    mutation_rate: float = Field(default=0.15, ge=0.0, le=1.0)
    tournament_size: int = Field(default=3, ge=2)
    init_seed: int | None = None
    max_nodes: int = Field(default=24, ge=4)
    max_depth: int = Field(default=12, ge=3)
    complexity_lambda: float = 0.001     # node-count penalty (design §5.3)
    complexity_mu: float = 0.0005        # param-count penalty
```

Add to `StrategySearchConfig` as **`genetic: GeneticSearchConfig | None = None`** (additive;
`None` → registry sweep, unchanged). Validate `elite_count < population_size`. **Keep this the
only change to `StrategySearchConfig` in this WO** (lock-box config is WO40).

### 2. `GeneticCandidateProvider` (design §4.2) — implements WO31's `CandidateProvider`

```python
__init__: seed RNG from init_seed; build initial population (task 3).
candidates() -> Iterable[SearchCandidate]:
    one SearchCandidate per genome: strategy="CompositeStrategy",
    search_space=derive_genome_search_space(genome), fixed_params={"genome": genome}.
report(results: list[CandidateResult]) -> None:
    advance the population to the next generation (task 4).
champion() -> Genome | None:   # best genome seen across all generations by fitness
```

### 3. Initial population (design §4.4) — mixed init, **no pure noise**

- **~50%** = registry-strategy genome fixtures (WO38) with light mutation applied — known-good
  building blocks that also sanity-check DSL coverage.
- **~50%** = random valid DAGs drawn from the grammar (respect `max_nodes`/`max_depth`;
  every generated genome passes WO38 validation before entering the population — reject + redraw).

### 4. Genetic operators (design §4.2) inside `report()`

1. **Fitness** = `robustness_score` (OOS only) **minus** the complexity penalty
   `λ·node_count + μ·param_count` (design §5.3). Candidates with `passed_gates=False` do **not
   reproduce** by default (rank below all passing; optionally donate diversity if a flag says so).
2. **Elitism:** top `elite_count` genomes copy **unchanged** into the next generation.
3. **Fill remainder:** tournament selection (size `tournament_size`) → **crossover** (subtree
   swap at compatible cut points — matching output types — then **re-validate**) at
   `crossover_rate`, else clone → **mutation** at `mutation_rate` (add/remove node, rewire edge,
   swap indicator kind within same output type, nudge a param-bound center, swap exit policy);
   re-validate every child, redraw on invalid.
4. Increment the generation counter; assign new `genome_id`s; record `parent_ids` +
   `generation` in each genome's `metadata`.

### 5. `GeneticStrategySearchOrchestrator` (design §1, §4.3) — ~40 lines, **new class only**

```python
for generation in range(genetic.generations):
    candidates = list(provider.candidates())
    results = [evaluate_candidate(c, search_cfg, backtest_runner,
                                  _wrap_progress(generation, i, ...), should_stop)
               for i, c in enumerate(candidates)]
    provider.report(results)                 # evolves population for next gen
    self._generations.append(results)        # WO40 persists these
    if should_stop and should_stop(): break
return self._assemble_result()               # StrategySearchResult over the final population,
                                             # ranked on OOS robustness_score (WO31 ranking reused)
```

Do **not** add a multi-generation mode to `StrategySearchRunner` and do **not** loop inside the
provider (design §4.3 rejects both — they fork walk-forward/progress/gate semantics). The
orchestrator owns the generational loop; `evaluate_candidate` stays pure.

### 6. Progress (design §1) — additive generation fields

Extend `SearchProgress` additively with optional `generation: int | None` and
`total_generations: int | None`. Existing clients ignore unknown fields. The orchestrator
emits "Generation 2/5 — Candidate 7/40" by setting these alongside the WO31 fields and
forwarding the inner walk-forward window progress.

### 7. Job selection seam (no API yet)

Expose a single resolver the WO40 job layer will call:
`select_search_orchestrator(config)` → returns `GeneticStrategySearchOrchestrator` when
`config.genetic is not None`, else the existing `StrategySearchRunner`. This keeps the registry
sweep path **frozen** and gives WO40 one clean switch point.

## Guardrails

> **`evaluate_candidate` is read-only.** If you edit it, `WalkForwardRunner`, or
> `OptimizationRunner`, stop — the design's whole premise (and WO34's verdict) is that genetic
> search needs **zero** semantic change to them. The sanctioned new code is the provider +
> orchestrator + config field.

> **One data load per run.** Same guarantee as WO31: the injected `backtest_runner`
> (`from_market_data_sliced`) is reused across **every** genome of **every** generation. A test
> asserts `get_ohlcv` is called **once** across a multi-generation run.

> **Selection is OOS-only.** Fitness derives from `robustness_score` (OOS), never the in-sample
> objective. Orient `MINIMIZE_DRAWDOWN` so higher fitness = more robust. Multi-objective is
> already rejected upstream (WO31) — keep it rejected.

> **Determinism.** Same `init_seed` → identical population trajectory. All randomness flows
> through the seeded RNG (init, tournament, crossover cut points, mutation choices).

## Tests — `tests/.../test_genetic_search.py`

- **Seam proof:** a genetic run completes end-to-end over synthetic data through
  `evaluate_candidate` with `WalkForwardRunner`/`OptimizationRunner`/`StrategySearchRunner`
  **unmodified** (import-and-assert-unchanged or behavioral parity on the registry path).
- **Determinism:** two runs with the same `init_seed` produce identical per-generation
  `genome_id`/population sequences.
- **Elitism monotonicity:** best fitness is non-decreasing across generations (elites carried
  unchanged), on a seeded synthetic objective.
- **Initial population:** ~50% seed from registry fixtures / ~50% random; **every** genome in
  generation 0 passes WO38 validation; none exceeds `max_nodes`/`max_depth`.
- **Complexity penalty:** between two equal-`robustness_score` genomes, the lower node/param
  count wins selection.
- **Operators preserve validity:** crossover + mutation children always re-validate (property
  test over seeded random parents); invalid children are redrawn, never emitted.
- **One `get_ohlcv` call** across a 2-generation × small-population run (call-count spy).
- **`should_stop`** between generations ends the run cleanly with a partial-but-ranked result.
- Existing strategy-search / optimization / walk-forward tests green and **unmodified**.

## Docs

`q_backend/README.md`: extend the strategy-search section with a "Genetic synthesis" note —
population → evaluate (reusing the registry-sweep evaluator) → select/crossover/mutate →
repeat; selection on OOS robustness with a parsimony penalty; point to the design doc.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- WO31 evaluator/runner and WO30 search-space modules unchanged; existing tests untouched.
- In your final message, paste: the **`GeneticSearchConfig` field list**, the **extended
  `SearchProgress`** (with `generation`/`total_generations`), the **`select_search_orchestrator`
  signature**, and the **per-generation results shape** the orchestrator carries (`self._generations`).
  WO40 persists these and wires the job layer against this message.

## Out of scope

- Deflated Sharpe Ratio, the held-out lock-box, the parsimony **caps as a gate** beyond
  generation-time enforcement (WO40 finalize step).
- Postgres columns, lake artifacts, Redis progress forwarding, API routes, job module (WO40).
- Any UI (WO41).
- v2 grammar/operators (vol-scaled TSMOM, island models, multi-objective NSGA-II).
