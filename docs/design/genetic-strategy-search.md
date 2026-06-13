# Genetic strategy synthesis — design

**Status:** design (WO34) · **Scope:** single-instrument candle strategies · **Builds on:** WO31 `CandidateProvider` seam, WO32 persistence/API, WO33 Discovery UI

This document specifies how the platform evolves from registry AutoML (WO30–WO33) to **genetic strategy synthesis**: composing indicator/rule primitives into novel strategies, evolving structure via selection/crossover/mutation, and optimizing numeric parameters per genome via the existing Optuna + walk-forward path.

**Alternative not pursued here:** reinforcement learning / neural policy generation — a separate research track requiring different data contracts, reward shaping, and execution latency guarantees.

---

## 1. Verdict on the WO31 seam

**WO31 is sufficient.** `CandidateProvider`, `evaluate_candidate`, and the per-candidate walk-forward + Optuna pipeline require **no semantic changes** for genetic search. A genetic run is still “yield candidates → evaluate each → rank on OOS `robustness_score` → report back to provider.”

| Component                  | Genetic use                                                                                                                            | Change needed                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `SearchCandidate`          | One per genome; `strategy` = fixed registry name (`CompositeStrategy`); genome JSON in `fixed_params`; numeric knobs in `search_space` | None                                  |
| `evaluate_candidate`       | Unchanged — walk-forward gates, OOS metrics, gates, `robustness_score`                                                                 | None                                  |
| `CandidateProvider.report` | Consumes generation results; runs selection/crossover/mutation; advances internal population                                           | New impl: `GeneticCandidateProvider`  |
| `StrategySearchRunner`     | Evaluates **one batch** of candidates per `run()` call                                                                                 | **No change to existing class**       |
| Job / API / UI             | Same job lifecycle, progress shape, leaderboard contract                                                                               | Additive config fields + columns only |

### Single smallest additive change

`StrategySearchRunner.run()` today performs one `candidates()` → evaluate → `report()` cycle. Genetic search needs **G generations**. Rather than mutating the runner, add a thin **`GeneticStrategySearchOrchestrator`** (~40 lines) that reuses the runner’s inner evaluation loop (or calls `evaluate_candidate` directly with the same progress callback wiring):

```text
for generation in 0..G-1:
    candidates = list(provider.candidates())
    results = [evaluate_candidate(c, ...) for c in candidates]
    provider.report(results)          # evolves population for next generation
    persist_generation(generation, results)
champion = provider.champion()        # or rank final generation
run_lockbox(champion)                 # post-evolution, see §5
```

The WO32 job module selects `GeneticStrategySearchOrchestrator` when `StrategySearchConfig.provider == "genetic"` (or a nested `GeneticSearchConfig`); otherwise it keeps using `StrategySearchRunner` unchanged.

**Why not loop inside the provider?** The provider must not duplicate `evaluate_candidate` — that would fork walk-forward semantics, progress reporting, and gate logic. **Why not multi-generation mode inside `StrategySearchRunner`?** Possible, but a separate orchestrator keeps the registry sweep path frozen and test-stable.

**Progress:** extend `SearchProgress` additively with optional `generation: int | None` and `total_generations: int | None`. Existing clients ignore unknown fields; Discover progress shows “Generation 2 / 5 — Candidate 7 / 40”.

---

## 2. Rule DSL — the genome

### 2.1 Design principles

1. **Structure evolves, parameters optimize** — tree topology and operator choices are fixed per genome; bounded numeric/categorical knobs become Optuna dimensions (same as WO30 registry params).
2. **Causal by construction** — the grammar only permits backward-looking indicators and `shift(1)`-style event detection; no future bars, no centered windows, no whole-series normalization.
3. **JSON serialization** — genomes flow through config, Postgres JSON columns, and lake artifacts unchanged.
4. **Sanity bar** — every registered candle strategy (MA cross, RSI, Bollinger, Donchian, MACD, TRB, FMA, TSMOM) must be expressible as a genome special case.

### 2.2 Top-level genome schema (version 1)

```json
{
  "version": 1,
  "genome_id": "gen3-ind7",
  "nodes": [
    /* typed DAG, see below */
  ],
  "entry_long": { "ref": "n12" },
  "entry_short": { "ref": "n13" },
  "exit_long": { "ref": "n14" },
  "exit_short": { "ref": "n15" },
  "metadata": { "generation": 3, "parent_ids": ["gen2-ind2", "gen2-ind9"] }
}
```

Each `nodes[]` entry:

```json
{
  "id": "n3",
  "kind": "<primitive>",
  "params": {
    /* fixed literals OR param references */
  },
  "inputs": ["n1", "n2"]
}
```

Output type tags (`price_series`, `oscillator`, `bool_series`) enforce valid wiring at parse time.

### 2.3 Primitive set

#### Price / series sources (leaves)

| Kind            | Inputs | Output         | Notes |
| --------------- | ------ | -------------- | ----- |
| `source.close`  | —      | `price_series` |       |
| `source.high`   | —      | `price_series` |       |
| `source.low`    | —      | `price_series` |       |
| `source.open`   | —      | `price_series` |       |
| `source.volume` | —      | `price_series` |       |

#### Indicators (causal; reuse `technical_indicators` / `moving_averages`)

| Kind               | Params (optimizable when `*_param` set)                | Output                                                    |
| ------------------ | ------------------------------------------------------ | --------------------------------------------------------- |
| `ind.ma`           | `period` (int 2–400), `ma_type` (sma/ema/wma/smma/hma) | `price_series`                                            |
| `ind.ema`          | `period`                                               | `price_series`                                            |
| `ind.rsi`          | `period` (2–200)                                       | `oscillator`                                              |
| `ind.macd`         | `fast`, `slow`, `signal`                               | `oscillator` (line); companion nodes for signal/histogram |
| `ind.bollinger`    | `period`, `num_std`                                    | tuple → `bb_upper`, `bb_middle`, `bb_lower` nodes         |
| `ind.donchian`     | `period`                                               | `donchian_upper`, `donchian_lower`                        |
| `ind.momentum`     | `lookback_bars`                                        | `oscillator` (TSMOM-style return)                         |
| `ind.realized_vol` | `window`, `estimator` (yang_zhang \| close_to_close)   | `oscillator`                                              |
| `ind.diff`         | —                                                      | `price_series` (A − B)                                    |
| `ind.ratio`        | —                                                      | `oscillator` (A / B − 1)                                  |

All indicators implemented as **rolling/prefix-only** functions identical to existing strategy code paths.

#### Transforms (still causal)

| Kind              | Params                               | Output        |
| ----------------- | ------------------------------------ | ------------- |
| `transform.shift` | `bars` (fixed 1 for cross detection) | same as input |
| `transform.abs`   | —                                    | same          |
| `transform.scale` | `factor` (optimizable)               | same          |

`shift.bars` is **fixed to 1** in v1 (cross-at-close semantics). Higher shifts are excluded from the grammar to prevent accidental look-ahead in event logic.

#### Comparisons → bool series

| Kind                                     | Semantics                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `cmp.gt`, `cmp.lt`, `cmp.gte`, `cmp.lte` | element-wise on aligned series                                                                          |
| `cmp.cross_above`                        | `(prev_left <= prev_right) & (left > right)` — **requires `transform.shift(1)` on operands internally** |
| `cmp.cross_below`                        | dual of cross_above                                                                                     |
| `cmp.touch_below`                        | Bollinger-style: prev close ≥ prev band & close < band                                                  |
| `cmp.touch_above`                        | symmetric                                                                                               |

#### Logic

| Kind                                 | Inputs      |
| ------------------------------------ | ----------- |
| `logic.and`, `logic.or`, `logic.not` | bool series |

#### Special exit modes (optional genome flags)

| Kind                   | Semantics                                                   |
| ---------------------- | ----------------------------------------------------------- |
| `exit.opposite_signal` | close long on `entry_short` trigger (MA-cross pattern)      |
| `exit.middle_band`     | Bollinger exit-to-middle                                    |
| `exit.fixed_holding`   | TRB/FMA-style bar-count exit (`holding_period` optimizable) |
| `exit.rebalance`       | TSMOM-style periodic rebalance (`rebalance_bars`)           |

Each genome declares exactly one exit policy per side via `exit_long` / `exit_short` refs (default: `exit.opposite_signal`).

### 2.4 Typing and causality closure

**Parse-time validation** (before any backtest):

1. DAG acyclicity; single root per signal ref.
2. Input arity and output-type compatibility (cannot `cmp.gt` two bool series).
3. All indicator params either literal or named key in `search_space`.
4. No node kind outside the v1 allowlist.
5. Max depth (default 12) and max node count (default 24) — parsimony cap.

**Causality closure rules:**

- Indicators may only call approved causal implementations (shared with registry strategies).
- Event nodes (`cross_*`, `touch_*`) compare **current bar values** against **shift(1) prior values** — matching `MACrossoverStrategy`’s `prev_delta` pattern.
- `check_entry_conditions` / `check_exit_conditions` read **precomputed bool columns** only; no row-wise history scans.
- Registration: one static `CompositeStrategy` class registered as `"CompositeStrategy"`. Genome lives in `fixed_params["genome"]`. The causality test runs on `CompositeStrategy` with a **canonical minimal genome** plus property tests on random valid genomes (generate → parse → prefix test).

This guarantees `test_strategy_causality.py` coverage without per-genome luck.

### 2.5 Parameterization — genome → `SearchCandidate`

```python
SearchCandidate(
    candidate_id=genome["genome_id"],           # e.g. "gen3-ind7"
    strategy="CompositeStrategy",               # single registry entry
    search_space=derive_genome_search_space(genome),  # WO30-style Int/Float/Categorical
    fixed_params={"genome": genome},            # structure frozen for this candidate
)
```

`derive_genome_search_space(genome)` walks nodes; any param slot marked `"param": "short_period"` becomes an Optuna dimension with bounds from a central **`GENOME_PARAM_BOUNDS`** table (mirrors registry `StrategyParamSpec` ranges). Unmarked literals stay fixed inside the genome JSON.

Risk params: same `include_risk_search` / `default_risk_search_space()` merge as registry sweep.

**Structure vs parameters:**

| Evolves (genetic ops)               | Optimizes (Optuna per WF window)                           |
| ----------------------------------- | ---------------------------------------------------------- |
| Node kinds, wiring, topology        | MA periods, thresholds, RSI bands, BB std, holding periods |
| Exit policy choice                  | `band_pct`, `num_std`, vol windows                         |
| Indicator selection (which `ind.*`) | Categorical `ma_type`, `vol_estimator`                     |

### 2.6 Example genome — reproduces `MACrossover`

Registry strategy: short/long MA on close, delta cross with threshold, opposite-signal exit.

```json
{
  "version": 1,
  "genome_id": "example-ma-crossover",
  "nodes": [
    { "id": "n1", "kind": "source.close", "params": {}, "inputs": [] },
    {
      "id": "n2",
      "kind": "ind.ma",
      "params": { "period": { "param": "short_period" }, "ma_type": { "param": "short_ma_type" } },
      "inputs": ["n1"]
    },
    {
      "id": "n3",
      "kind": "ind.ma",
      "params": { "period": { "param": "long_period" }, "ma_type": { "param": "long_ma_type" } },
      "inputs": ["n1"]
    },
    { "id": "n4", "kind": "ind.diff", "params": {}, "inputs": ["n2", "n3"] },
    {
      "id": "n5",
      "kind": "cmp.cross_above",
      "params": { "threshold": { "param": "threshold" } },
      "inputs": ["n4"]
    },
    {
      "id": "n6",
      "kind": "cmp.cross_below",
      "params": { "threshold": { "param": "threshold", "negate": true } },
      "inputs": ["n4"]
    }
  ],
  "entry_long": { "ref": "n5" },
  "entry_short": { "ref": "n6" },
  "exit_long": { "ref": "n6" },
  "exit_short": { "ref": "n5" },
  "metadata": { "equivalent_registry": "MACrossover" }
}
```

Derived `search_space.strategy_params`: `short_period`, `long_period`, `short_ma_type`, `long_ma_type`, `threshold` — identical bounds to `ma_crossover.py` registry specs.

---

## 3. `CompositeStrategy` interpreter

### 3.1 Registry shape

**One registry entry**, not per-genome dynamic registration:

```python
register_strategy(
    name="CompositeStrategy",
    label="Evolved composite",
    description="Interpreted genome DSL (genetic search only).",
    params=[],  # all params come from genome-derived search_space
    build=_build_composite,
    strategy_class=CompositeStrategy,
    category="other",
)
```

`merge_strategy_params("CompositeStrategy", trial_params)` merges Optuna trial values into the genome copy before interpretation.

User-facing Discover rows show `genome_id` as `candidate_id` and `"CompositeStrategy"` (or a friendly `"Evolved"`) in the strategy column; genome hash/id distinguishes individuals.

### 3.2 Execution model

1. **`compile(genome, params)`** → execution plan: topologically sorted nodes, column names, bool signal columns (`entry_long_signal`, etc.).
2. **`compute_indicators(data)`** → vectorized numpy/pandas pass:
   - Allocate indicator cache keyed by `(node_id, param_hash)`.
   - Reuse `compute_ma`, `compute_rsi`, `compute_macd`, etc.
   - Write bool event columns in one pass.
3. **`check_entry_conditions(row)`** → read bool columns; emit BUY/SELL (mutually exclusive per bar, same as registry strategies).
4. **`check_exit_conditions(row, trades)`** → exit policy columns or opposite-signal columns.

Honors closed-bar / next-bar-open contract: signals at bar _i_ use only data ≤ _i_; engine fills at bar _i+1_ open.

### 3.3 Causality test satisfaction

- `CompositeStrategy` registered → auto-included in `test_strategy_causality.py` parametrized sweep with a **default trivial genome** (e.g. single MA cross).
- Supplement: `test_composite_genome_causality.py` generates N random valid genomes (seeded) and runs the prefix assertion — catches grammar holes.

### 3.4 Performance posture

Genetic runs evaluate **population × generations × n_trials × windows** — interpreter cost matters.

| Technique                            | Purpose                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Vectorized indicator eval            | One column per node per full series, not Python row loops                                                          |
| Indicator cache across Optuna trials | Same genome structure + same OHLCV → reuse compiled plan and warm columns; only re-eval nodes whose params changed |
| Column interning                     | Identical subgraphs (same kind + params) share one column                                                          |
| Lazy chart indicators                | `get_chart_indicators()` builds from genome for UI; skip in hot optimization path                                  |

Target: interpreter overhead ≪ walk-forward backtest cost for typical genomes (<24 nodes).

---

## 4. `GeneticCandidateProvider`

### 4.1 Config

```python
class GeneticSearchConfig(BaseModel):
    population_size: int = Field(default=40, ge=10, le=200)
    generations: int = Field(default=10, ge=2, le=50)
    elite_count: int = Field(default=4, ge=1)
    crossover_rate: float = Field(default=0.7, ge=0.0, le=1.0)
    mutation_rate: float = Field(default=0.15, ge=0.0, le=1.0)
    tournament_size: int = Field(default=3, ge=2)
    init_seed: int | None = None          # reproducible initial population
    max_nodes: int = Field(default=24, ge=4)
    max_depth: int = Field(default=12, ge=3)
```

Nested in `StrategySearchConfig` as `genetic: GeneticSearchConfig | None = None`. When set, job uses `GeneticStrategySearchOrchestrator`.

### 4.2 Lifecycle

```text
__init__: seed RNG; generate population_size random valid genomes (or seed from registry templates with mutations)

candidates() -> Iterable[SearchCandidate]:
    yield SearchCandidate for each member of self._population

report(results: list[CandidateResult]) -> None:
    1. Filter to status=="completed"
    2. Fitness = robustness_score (OOS only); penalize complexity (§5.3)
    3. Elitism: top elite_count genomes copy unchanged to next gen
    4. Fill remainder: tournament selection → crossover (subtree swap) → mutation
    5. Increment generation counter; assign new genome_ids
```

**Selection metric:** `robustness_score` only — never in-sample objective. Candidates that fail gates may receive fitness = −∞ (or rank below all passing) but can still donate structural diversity if configured; default: **only `passed_gates` individuals reproduce**.

**Crossover:** pick random cut points in two parent DAGs; swap compatible subtrees (matching output type). Re-validate.

**Mutation ops:** add/remove node, rewire edge, swap indicator kind within same output type, nudge param bound center, swap exit policy.

### 4.3 Generational loop ownership

| Option                                   | WO31 touch                    | Verdict                              |
| ---------------------------------------- | ----------------------------- | ------------------------------------ |
| Runner multi-gen mode                    | Modify `StrategySearchRunner` | Rejected — freezes better as-is      |
| Provider internal loop                   | Provider calls evaluator      | Rejected — duplicates WO31           |
| **Orchestrator wraps evaluate + report** | New class only                | **Recommended**                      |
| Job script loops runner                  | Job layer                     | Acceptable duplicate of orchestrator |

The orchestrator persists each generation’s leaderboard (WO32 additive columns) and emits progress with generation fields.

### 4.4 Initial population

Mixed initialization:

1. **50%** mutated copies of registry strategy genomes (known-good building blocks).
2. **50%** random valid DAGs from grammar.

Ensures generation 0 is not pure noise and sanity-checks DSL coverage.

---

## 5. Overfitting defense at scale

Registry AutoML over ~10 strategies tolerates naive “best OOS.” Evolving thousands of genomes does not.

### 5.1 Deflated Sharpe Ratio (DSR) / multiple-testing correction

After final generation ranking, apply **Bailey & López de Prado DSR** to the champion (and surface on all top-k):

```text
DSR = Φ( (SR* − E[max SR]) / σ[SR] )
```

Where `SR*` is the champion’s OOS Sharpe (or mapped surrogate from the active objective), and `E[max SR]` adjusts for the **effective number of independent trials** ≈ `population_size × generations × avg_passing_rate` (use conservative upper bound: total genomes evaluated).

**Plug-in point:** `GeneticStrategySearchOrchestrator.finalize()` after last generation — **post-rank, post-gates**, before lock-box. Does not alter per-candidate `evaluate_candidate` (keeps WO31 pure). Store `dsr`, `n_trials_effective`, and `sr_observed` on the run summary and champion row.

If objective ≠ Sharpe, compute DSR on OOS Sharpe from `oos_metrics` alongside the primary objective.

### 5.2 Held-out lock-box

Reserve the **final 10–15% of the date range** (configurable `lockbox_days` or `lockbox_pct`) **before** any walk-forward window is carved:

```text
[==== train/test WF region ====][== lockbox ==]
         ↑ all generations              ↑ one-shot champion eval
```

- Walk-forward windows for every generation use only the WF region.
- After evolution, run **one** backtest of the champion’s best_params on the lock-box segment (no re-optimization).
- Persist `lockbox_metrics`, `lockbox_passed` (optional gate: min trades, max drawdown).
- Lock-box failure → flag run summary; UI shows warning even if WF OOS looked strong.

Add `lockbox: LockboxConfig` to `StrategySearchConfig` (additive; default disabled for registry sweep backward compat).

### 5.3 Complexity penalty (parsimony)

Fitness used in `report()`:

```text
fitness = robustness_score − λ × node_count − μ × param_count
```

Defaults: `λ = 0.001`, `μ = 0.0005` (tune empirically; expose in advanced config). Prevents bloated trees from edging out simpler equal-OOS competitors.

Also enforce hard caps (`max_nodes`, `max_depth`) at generation time.

### 5.4 UI skepticism affordances

Discover results for genetic runs should show:

| Element                      | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| **“Evolved strategy” badge** | Distinguish from registry names                  |
| **Generation selector**      | Leaderboard per generation (not only final)      |
| **Genome viewer**            | Read-only tree / JSON of selected candidate      |
| **DSR + trial count**        | “Adjusted for ~1,200 genomes tried”              |
| **Lock-box panel**           | WF OOS vs lock-box side-by-side; red if diverges |
| **Complexity line**          | Node count, param count                          |
| **Gate + efficiency badges** | Existing WO33 patterns                           |

Copy guidance: “High DSR still does not guarantee live performance; lock-box is a single holdout — treat as screening, not proof.”

---

## 6. Persistence, API, and UI deltas

### 6.1 Postgres / lake (additive)

**`strategy_search_runs`** — add to `config` JSON (no migration if config is schemaless JSON):

- `genetic: GeneticSearchConfig`
- `lockbox: LockboxConfig`
- `provider: "registry" | "genetic"`

**`result_summary`** — add:

- `generations_completed`, `total_genomes_evaluated`
- `champion_dsr`, `lockbox_metrics`, `lockbox_passed`

**`strategy_search_candidates`** — add nullable columns:

| Column               | Type  | Notes                                                  |
| -------------------- | ----- | ------------------------------------------------------ |
| `generation`         | int   | 0-based                                                |
| `genome`             | JSON  | full genome document                                   |
| `genome_node_count`  | int   | for leaderboard sorting / display                      |
| `dsr`                | float | nullable; champion-focused but can store per candidate |
| `complexity_penalty` | float | nullable                                               |

Unique constraint stays `(run_id, candidate_id)` — `candidate_id` = `genome_id` (unique per run).

**Lake** — under `strategy_search/{run_id}/`:

- `generations/{g}/leaderboard.parquet` (optional; or generation column on existing leaderboard)
- `candidates/{candidate_id}/genome.json` (mirror Postgres for research exports)
- `lockbox/` — champion metrics + equity curve

Existing equity artifact paths unchanged.

### 6.2 API

- `StrategySearchConfig` body accepts optional `genetic` + `lockbox` blocks.
- Status payload: optional `generation`, `total_generations`.
- Results payload: candidates include `generation`, `genome`; summary includes DSR + lock-box.
- New optional `GET .../candidates/{id}/genome` if genome too large for list payload (otherwise inline).

Registry sweep requests omit `genetic` → identical behavior to today.

### 6.3 UI (WO33 Discover)

Minimal additions on top of existing leaderboard:

1. **Config:** “Search mode” toggle — Registry sweep (default) vs Genetic synthesis; genetic exposes population/generations/advanced GA knobs; lock-box section under advanced.
2. **Progress:** generation × candidate progress (uses extended status fields).
3. **Results:** generation dropdown filters `LeaderboardTable`; row expansion adds **Genome** tab (tree diagram or formatted JSON); run header shows DSR + lock-box callout.
4. **Promote to Backtest:** pass genome + best_params (CompositeStrategy pre-selected).

No new workspace — genetic runs **are** Discovery runs with a different provider.

---

## 7. Implementation batch outline

| WO                                         | Scope                                                                                                                                                                    | Depends on       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| **WO35** — DSL + interpreter + causality   | Genome schema, parser/validator, `CompositeStrategy`, registry entry, `derive_genome_search_space`, causality tests, registry-strategy equivalence fixtures (MA, RSI, …) | WO31 (read-only) |
| **WO36** — Genetic provider + orchestrator | `GeneticCandidateProvider`, `GeneticStrategySearchOrchestrator`, initial population, genetic ops, complexity penalty, progress generation fields                         | WO35             |
| **WO37** — DSR + lock-box + persistence    | `LockboxConfig`, DSR finalize step, DB/lake additive columns, job wiring, API payload extensions                                                                         | WO36, WO32       |
| **WO38** — Discover UI (genetic mode)      | Config toggle, generation selector, genome viewer, DSR/lock-box panels, MSW fixtures                                                                                     | WO37, WO33       |

**Suggested order:** WO35 → WO36 → WO37 → WO38 (strict chain). WO35 is the riskiest (DSL correctness); WO38 can prototype against mocked payloads in parallel only after WO37 contracts are frozen.

**Testing milestones:**

- WO35: every registry strategy has an equivalent-genome backtest parity test (same signals on synthetic data).
- WO36: seeded GA run reproduces population trajectories; elitism monotonicity.
- WO37: lock-box excluded from WF windows verified by date assertions; DSR decreases as trial count increases.
- WO38: Playwright smoke — genetic run → generation filter → genome tab → promote.

---

## Appendix A — Registry → genome mapping notes

| Registry           | Key genome features                                       |
| ------------------ | --------------------------------------------------------- |
| MACrossover        | `ind.ma` ×2, `ind.diff`, `cmp.cross_*`, opposite exit     |
| RSIMeanReversion   | `ind.rsi`, cross above oversold/overbought thresholds     |
| BollingerReversion | `ind.bollinger`, `touch_*`, `exit.middle_band`            |
| DonchianBreakout   | `ind.donchian`, close vs channel cross                    |
| MACD               | `ind.macd`, signal line cross                             |
| TRB / FMA          | `ind.ma` or TRB channel helper, `exit.fixed_holding`      |
| TSMOM              | `ind.momentum`, `exit.rebalance`, vol scaling optional v2 |

TRB channel construction may require a dedicated `ind.trb_channel` node wrapping `lai_lau_common` to avoid duplicating logic.

---

## Appendix B — RL alternative (one line)

Deep RL / neural policy search would learn latent actions from raw OHLCV without an explicit causal DSL; deferred because execution contract enforcement, sample efficiency, and interpretability requirements favor compositional grammars for this product stage.
