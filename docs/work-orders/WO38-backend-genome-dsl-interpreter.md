# WO38 — Backend: genome DSL + `CompositeStrategy` interpreter + causality

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** this batch ("Generative Discovery") evolves the platform from
_registry AutoML_ (WO30–WO33: sweep every hand-coded strategy, optimize + walk-forward each,
rank on out-of-sample) into **genetic strategy synthesis** — composing indicator/rule
primitives into brand-new strategies, evolving their structure, and optimizing their numeric
params via the existing Optuna + walk-forward path. The full design is locked in
**`docs/design/genetic-strategy-search.md`** (read it; this WO implements its §2–§3).

**This WO is the foundation: the genome DSL and its interpreter.** It is **backend only** and
adds **no genetic loop, no API, no DB, no UI** (those are WO39–WO41). It defines the genome
schema, a parse-time validator, a `CompositeStrategy` that interprets a genome under the
existing strategy contract, a single registry entry, `derive_genome_search_space`, and the
causality guarantees. The riskiest WO in the batch (DSL correctness) — so the bar is
**every existing registry strategy must be expressible as a genome and backtest-parity-tested
against its hand-coded twin**.

**Builds on the seam, changes nothing upstream.** WO31's `SearchCandidate` /
`CandidateProvider` and WO30's `auto_search_space` are **read-only** here — a genome becomes a
`SearchCandidate` with `strategy="CompositeStrategy"` and `fixed_params={"genome": ...}`, and
`derive_genome_search_space` mirrors WO30's `SearchSpaceConfig` shape. Do not edit them.

---

## How the pieces you're composing work today (read these files)

- `src/q_backend/backtesting/strategy_registry.py` — `register_strategy(name, label,
description, params, build, strategy_class, category)`, `get_registered_strategy(name)`,
  `list_registered_strategies()`, `merge_strategy_params(name, trial_params)`. You register
  **one** entry, `"CompositeStrategy"`.
- `src/q_backend/backtesting/strategies/` — the existing strategy classes
  (`ma_crossover.py`, `rsi_mean_reversion.py`, `bollinger.py`, `donchian.py`, `macd.py`, the
  Lai–Lau `trb`/`fma`, `tsmom.py`, …). Read **`MACrossoverStrategy`** closely: its
  `compute_indicators` precompute pass, the `prev_delta`/`shift(1)` cross pattern, and the
  `check_entry_conditions(row)` / `check_exit_conditions(row, trades)` reading **precomputed
  columns only**. The interpreter must honor that exact contract.
- The indicator helpers the strategies call (e.g. `technical_indicators` / `moving_averages`
  modules — `compute_ma`, `compute_rsi`, `compute_macd`, Bollinger, Donchian; Lai–Lau channel
  helpers in `lai_lau_common`). **The interpreter reuses these implementations verbatim** —
  no new indicator math, so causality and numerics already match the registry.
- `src/q_backend/optimization/auto_search_space.py` (WO30) — `derive_strategy_search_space`,
  the `SearchSpaceConfig` shape, and the `StrategyParamSpec` bounds. `derive_genome_search_space`
  produces the same `SearchSpaceConfig` shape from a genome; bounds come from a central
  `GENOME_PARAM_BOUNDS` table that mirrors the registry specs.
- `tests/.../test_strategy_causality.py` — the parametrized causality sweep that auto-includes
  every registered strategy. `CompositeStrategy` joins it automatically; the prefix/no-look-ahead
  assertion must pass for a canonical genome **and** for random valid genomes.

---

## Goal

```python
genome = {...}                                   # JSON DSL document (design §2.2)
plan = compile_genome(genome, params)            # validated, topo-sorted execution plan
strat = CompositeStrategy(genome=genome, params=params)
#   strat.compute_indicators(df) -> df with bool signal columns
#   strat.check_entry_conditions(row) / .check_exit_conditions(row, trades)
#   identical signals to the equivalent registry strategy on the same data

space, fixed = derive_genome_search_space(genome)  # WO30-shaped SearchSpaceConfig + fixed params
```

A genome flows unchanged through config → Postgres JSON → lake (later WOs). Interpretation is
vectorized (one column per node), causal by construction, and parity-tested against the
hand-coded registry strategies.

## Tasks

### 1. New module `src/q_backend/strategies/genome/schema.py` (or `backtesting/genome/`)

Pydantic models for the genome document exactly as design §2.2:

```python
class NodeParam(BaseModel):       # a literal OR a reference to an optimizable knob
    # either {"param": "short_period"}  (+ optional "negate": bool)
    # or a bare literal (int/float/str/bool)

class GenomeNode(BaseModel):
    id: str
    kind: str                     # one of the v1 primitive allowlist (design §2.3)
    params: dict[str, Any]        # literals or {"param": <key>} refs
    inputs: list[str]             # node-id references (DAG edges)

class Genome(BaseModel):
    version: Literal[1]
    genome_id: str
    nodes: list[GenomeNode]
    entry_long: NodeRef
    entry_short: NodeRef
    exit_long: NodeRef
    exit_short: NodeRef
    metadata: dict[str, Any] = {}
```

**Primitive allowlist (v1)** — implement exactly the kinds in design §2.3, no more:
sources (`source.close/high/low/open/volume`), indicators (`ind.ma/ema/rsi/macd/bollinger/
donchian/momentum/realized_vol/diff/ratio`), transforms (`transform.shift/abs/scale`),
comparisons (`cmp.gt/lt/gte/lte/cross_above/cross_below/touch_below/touch_above`), logic
(`logic.and/or/not`), and the exit policies (`exit.opposite_signal/middle_band/
fixed_holding/rebalance`). Each kind carries an **output type tag**
(`price_series` | `oscillator` | `bool_series`, plus the named tuple outputs for
bollinger/donchian) used for wiring validation.

### 2. Parser / validator `genome/validate.py` — **parse-time, before any backtest**

Enforce design §2.4 and reject with a precise `GenomeValidationError`:

1. DAG acyclicity; every signal ref resolves to a `bool_series` node.
2. Input arity + output-type compatibility (cannot `cmp.gt` two bool series; `logic.and`
   needs bool inputs; etc.).
3. Every indicator param is **either** a literal **or** a `{"param": key}` whose `key` is a
   known `GENOME_PARAM_BOUNDS` entry.
4. No node kind outside the v1 allowlist.
5. `transform.shift.bars` is **fixed to 1** (cross-at-close; reject other values to prevent
   accidental look-ahead).
6. Parsimony caps: `max_depth` (default 12), `max_node_count` (default 24).

### 3. `derive_genome_search_space(genome) -> (SearchSpaceConfig, fixed_params)`

Walk nodes; each `{"param": key}` slot becomes one Optuna dimension (Int/Float/Categorical)
with bounds from **`GENOME_PARAM_BOUNDS`** (a single central table mirroring the registry
`StrategyParamSpec` ranges — e.g. `short_period` Int 2–400, `num_std` Float 0.5–4.0,
`*_ma_type` Categorical sma/ema/wma/smma/hma). Unmarked literals stay fixed inside the genome
JSON. Risk params reuse the **same** `include_risk_search` / `default_risk_search_space()`
merge as the registry sweep — do not reinvent it. Output must be byte-compatible with WO30's
`SearchSpaceConfig` so WO31's `evaluate_candidate` consumes it unchanged.

### 4. `CompositeStrategy` interpreter `genome/composite_strategy.py`

Implements the existing strategy interface (design §3.2):

- **`compile(genome, params)`** → execution plan: topologically sorted nodes, per-node column
  names, the four bool signal columns (`entry_long_signal`, `entry_short_signal`,
  `exit_long_signal`, `exit_short_signal`). Merge `params` (Optuna trial values) into the
  genome copy first via the registry's `merge_strategy_params` path.
- **`compute_indicators(data)`** → one vectorized pass: allocate an indicator cache keyed by
  `(node_id, param_hash)`; reuse `compute_ma/compute_rsi/compute_macd/...`; **column interning**
  so identical subgraphs (same kind+params) share one column; write the bool event columns.
- **`check_entry_conditions(row)`** → read bool columns only; emit BUY/SELL, mutually
  exclusive per bar (same as registry strategies).
- **`check_exit_conditions(row, trades)`** → exit-policy columns or opposite-signal columns
  per the genome's `exit_long`/`exit_short`.
- **`get_chart_indicators()`** → build chart series from the genome for the UI; **skip in the
  hot optimization path** (lazy).

Honor the closed-bar / next-bar-open contract: signals at bar _i_ use only data ≤ _i_; the
engine fills at bar _i+1_ open. Cross/touch events compare **current bar** vs **`shift(1)`
prior** — the `MACrossoverStrategy.prev_delta` pattern, never a row-wise history scan.

### 5. Registry entry — **one** static class

```python
register_strategy(
    name="CompositeStrategy",
    label="Evolved composite",
    description="Interpreted genome DSL (genetic search only).",
    params=[],                       # all params come from genome-derived search_space
    build=_build_composite,          # reads fixed_params["genome"] + merged trial params
    strategy_class=CompositeStrategy,
    category="other",
)
```

Genome lives in `fixed_params["genome"]`; **no per-genome dynamic registration**.

### 6. Registry → genome equivalence fixtures

Provide a canonical genome for **each** registry strategy in design Appendix A
(`MACrossover`, `RSIMeanReversion`, `BollingerReversion`, `DonchianBreakout`, `MACD`,
`TRB`, `FMA`, `TSMOM`) as JSON fixtures. The `MACrossover` genome is given verbatim in design
§2.6 — start there. If TRB needs an `ind.trb_channel` node wrapping `lai_lau_common`, add it
to the allowlist (design Appendix A note).

## Guardrails

> **Reuse indicator math; never reimplement it.** Every `ind.*` node calls the **same**
> function the registry strategy calls. This is what makes parity tests pass and causality
> free — a new EMA implementation here would be a bug, not a feature.

> **Causal by construction.** The grammar admits only backward-looking indicators and
> `shift(1)` event detection; `shift.bars` is hard-locked to 1; no centered windows, no
> whole-series normalization. Validation rejects anything else **before** a backtest runs.

> **Don't touch the seam or the runners.** WO30 `auto_search_space`, WO31 `SearchCandidate` /
> `evaluate_candidate` / `WalkForwardRunner` / `OptimizationRunner` are read-only. The genome
> path produces a `SearchCandidate`; it does not modify how candidates are evaluated.

> **One registry entry, not N.** Genetic search will evaluate thousands of genomes; each is a
> `fixed_params["genome"]` on the single `CompositeStrategy` registration, never a new
> `register_strategy` call.

## Tests — `tests/.../test_genome_*.py`

- **Validation:** acyclicity, type mismatch (`cmp.gt` on two bools), unknown kind, unknown
  param key, `shift.bars != 1`, and depth/node caps each raise `GenomeValidationError` with a
  clear message; the §2.6 MA genome validates clean.
- **Registry parity (the headline test):** for **every** Appendix-A strategy, the equivalent
  genome under `CompositeStrategy` produces **identical entry/exit signals** to the hand-coded
  strategy on the same synthetic OHLCV and same params (assert column equality, not just trade
  count). This is the proof the DSL is faithful.
- **Causality:** `CompositeStrategy` is auto-included in `test_strategy_causality.py` with a
  default trivial genome; **plus** `test_composite_genome_causality.py` generates N seeded
  random valid genomes and runs the prefix/no-look-ahead assertion (catches grammar holes).
- **`derive_genome_search_space`:** the §2.6 MA genome yields exactly `short_period`,
  `long_period`, `short_ma_type`, `long_ma_type`, `threshold` with bounds identical to
  `ma_crossover.py`'s registry specs; literal params stay out of the search space.
- **Interpreter caching:** two trials of the same genome differing only in one param re-evaluate
  only the affected node's column (assert the cache hit on unchanged subgraphs).
- Existing backtest / optimization / walk-forward / causality tests green and **unmodified**.

## Docs

`q_backend/README.md`: a "Genome DSL / CompositeStrategy" subsection — the grammar's purpose
(structure evolves, parameters optimize), the causal-by-construction guarantee, and that
genetic search (WO39) drives it via `fixed_params["genome"]`. Keep `docs/design/
genetic-strategy-search.md` as the source of truth; link to it.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- WO30/WO31 modules unchanged; existing tests untouched and green.
- In your final message, paste: the **`Genome` / `GenomeNode` / `NodeParam` field lists**, the
  **full v1 primitive allowlist with output-type tags**, the **`GENOME_PARAM_BOUNDS` table**,
  and the **exact `derive_genome_search_space` return shape**. WO39 evolves these genomes and
  WO41 renders them — they build against this message.

## Out of scope

- The genetic loop, population, selection/crossover/mutation, complexity penalty (WO39).
- DSR, lock-box, persistence, API, job wiring (WO40).
- Any UI (WO41).
- Tick-engine genomes; multi-objective. v2 grammar extras (vol-scaled TSMOM sizing, shifts > 1).
