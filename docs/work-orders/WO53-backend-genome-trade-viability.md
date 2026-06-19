# WO53 — Backend: genome trade-viability (stop breeding strategies that don't trade)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "GA Discovery quality". A diagnosis of the Discovery history
found the single dominant failure mode is **genomes that barely trade or don't trade at all** —
this disease shows up under three different labels in the data:

- **`few_oos_trades`** gate flag on 254 completed candidates; ~250 completed genomes made
  **fewer than 5 trades** (gate requires `min_oos_trades=10`). With 1–4 trades, OOS efficiency
  is pure noise → also trips `suspicious_efficiency` (478×) → auto-fail.
- **`no_result` status on 269 / 1,152 candidates (23%; 68% for CCM\$ runs)**, and the code shows
  two causes, both = "doesn't trade":
  - **124** had `completed_windows = 0` → the in-sample Optuna step found **no valid trial**
    (`walkforward.py` ~L312) — the genome doesn't trade in-sample either.
  - **114** completed all 5 windows but hit `"zero out-of-sample trades"`
    (`strategy_search.py` ~L419).

So a large fraction of **every generation's evaluation budget is spent on genomes that can never
score**. WO52 makes the fitness _graded_ so these don't poison selection; **this WO attacks the
source** — generate/repair genomes so the vast majority actually trade enough to be measurable,
and cheaply reject the dead ones **before** they consume an expensive walk-forward.

Design: `docs/design/genetic-strategy-search.md` §4.4, §4.2 (read them).

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/genome/operators.py`
  - `build_initial_population(rng, population_size, max_nodes, max_depth)` — ~50% mutated registry
    fixtures + ~50% random DAGs from `build_random_genome` (`crossover`/`reversion`/`breakout`
    archetypes). `_build_random_crossover/_reversion/_breakout` wire `cmp.cross_above/below` heads
    with **`threshold` param refs** drawn from `GENOME_PARAM_BOUNDS`.
  - `mutate_genome` (uniform 1/6 over rewire/swap_indicator/nudge_param/swap_exit/add_node/
    remove_node), `crossover_genomes`, `draw_valid_child`, `_draw_valid` (redraw-on-invalid, 64
    attempts).
- `src/q_backend/backtesting/genome/param_bounds.py` — `GENOME_PARAM_BOUNDS` (per-key
  type/min/max/default/choices). **Threshold bounds that don't match an indicator's output range
  are why `cross_above`/`cross_below` heads never fire.**
- `src/q_backend/backtesting/genome/compile.py` (the WO38 interpreter, `compile_genome`) — turns a
  genome into entry/exit boolean series. A cheap way to count signals without a full backtest.
- `src/q_backend/optimization/strategy_search.py` — `evaluate_candidate` returns `no_result` /
  `"zero out-of-sample trades"`; `GateConfig.min_oos_trades`.
- `src/q_backend/optimization/genetic_search.py` — `GeneticCandidateProvider` (`_vary`,
  `build_initial_population` call), `GeneticStrategySearchOrchestrator.run` (the per-candidate
  evaluation loop where a pre-screen would slot in).

---

## Goal

The fraction of each generation that trades enough to be **scoreable** (≥ a configurable minimum
signal count in-sample) rises from today's minority to the large majority, by **(a)** generating
genomes that fire, **(b)** repairing genomes that don't, and **(c)** a cheap pre-screen that
rejects/repairs dead genomes before the expensive walk-forward — reclaiming most of the 23%
`no_result` budget.

## Tasks

### 1. Signal-activity probe (cheap, no walk-forward)

Add `genome_signal_activity(genome, df) -> ActivityStats` (e.g. in a new
`genome/activity.py`): `compile_genome` on a **single in-sample slice** and count entry/exit
crossings (long+short). Returns `n_entries`, `n_exits`, and `is_tradeable: bool`
(`n_entries >= min_signals`). This is **orders of magnitude cheaper** than a walk-forward and is
the shared primitive for tasks 2–4.

### 2. Threshold/param bounds aligned to indicator output ranges

Audit `GENOME_PARAM_BOUNDS` for every `threshold`-style param feeding a `cmp.*` head against an
indicator output. Where a comparison is against an **oscillator** (e.g. RSI ∈ [0,100]) vs a
**price-difference** (`ind.diff`, centered near 0) vs a **band**, the threshold bounds must match
that range, otherwise the cross can never occur. Fix the bounds (or make the generator pick the
threshold _relative to_ the indicator's observed range). This is the highest-leverage, lowest-risk
fix — many dead genomes are dead purely because a threshold sits outside the series.

### 3. Activity-aware generation + repair operators

- **Generation:** in `build_random_genome` / the `_build_random_*` archetypes, after building a
  candidate, run the task-1 probe on the run's IS slice; if `not is_tradeable`, **repair then
  redraw**. Plumb the IS `df` (or a small sample) into `build_initial_population` /
  `GeneticCandidateProvider` so generation can probe. (Keep a hard redraw cap; fall back to a
  known-tradeable registry fixture rather than emitting a dead genome.)
- **Repair operators** (new, used by generation and as a mutation option):
  - widen/recenter a threshold toward the indicator's observed range,
  - shorten an over-long lookback,
  - relax an over-restrictive `logic.and` head to the firing sub-condition.
- **Mutation bias:** when `nudge_param` hits a low-activity genome, bias the nudge toward values
  that _increase_ signal frequency (use the probe to choose direction).

### 4. Pre-screen before walk-forward (reclaim `no_result` budget)

In `GeneticStrategySearchOrchestrator.run`, before calling `evaluate_candidate` for a genome,
run the task-1 probe (reusing the already-loaded OHLCV — **no extra data load**). If
`not is_tradeable`, skip the walk-forward and synthesize a `CandidateResult(status="no_result",
error="pre-screen: no in-sample signals")` so WO52's graded fitness still ranks it (low, but
finite) **without** paying for a 5-window walk-forward. Make the pre-screen **opt-out** via a
`GeneticSearchConfig.prescreen_min_signals: int = 1` (0 disables).

### 5. Config (additive to `GeneticSearchConfig`)

```python
prescreen_min_signals: int = 1     # min in-sample entry signals to run the full walk-forward (0=off)
min_seed_signals: int = 1          # generation rejects/repairs genomes below this
repair_max_attempts: int = 8       # repair tries before falling back to a registry fixture
```

## Guardrails

> **One data load per run.** The probe and pre-screen **reuse** the injected, already-sliced
> OHLCV frame (`backtest_runner._df` / the orchestrator's `ohlcv`). A test asserts `get_ohlcv` is
> still called **once** across a multi-generation run. Never load data in the probe.

> **`evaluate_candidate` / gates stay read-only.** The pre-screen _wraps_ evaluation (decides
> whether to call it); it does not modify it. Gate thresholds are unchanged.

> **Generation always terminates.** Every redraw/repair loop has a hard cap and a guaranteed
> tradeable fallback (registry fixture). Never infinite-loop hunting for a tradeable genome.

> **Determinism.** All probe-driven choices flow through the seeded RNG. Same `init_seed` →
> identical population.

> **Cheap means cheap.** The probe is `compile_genome` + a vectorized crossing count on one
> slice — no `BacktestRunner.run`, no Optuna, no walk-forward.

## Tests — `tests/backtesting/test_genome_activity.py`, `tests/optimization/test_prescreen.py`

- **Probe correctness:** a genome whose threshold sits outside the series range reports
  `is_tradeable=False`; a registry crossover fixture reports `True` with `n_entries>0`.
- **Bounds fix:** for each `cmp.*`-against-indicator pairing, a randomly drawn threshold lands
  within the indicator's output range (property test over `GENOME_PARAM_BOUNDS`).
- **Generation viability:** gen-0 built with `min_seed_signals=1` has a **substantially higher**
  tradeable fraction than gen-0 built with the probe disabled (same seed) — quantify the lift.
- **Repair:** a hand-built dead genome (threshold out of range) is repaired to `is_tradeable=True`
  within `repair_max_attempts`.
- **Pre-screen saves work:** with a dead genome injected, `evaluate_candidate` is **not** called
  (spy), and the synthesized `no_result` flows through WO52 fitness as a finite low score.
- **One `get_ohlcv` call** across a 2-generation run including probes/pre-screen.
- **Determinism:** same seed → identical populations and identical pre-screen decisions.
- Existing genome/operator/strategy-search tests green and **unmodified**.

## Docs

`q_backend/README.md`: add a "trade-viability" note to the genetic section — generation/repair
bias toward genomes that fire, and a cheap signal pre-screen skips the walk-forward for genomes
with no in-sample signals (reclaims the bulk of `no_result` evaluations).

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Demonstrate (in the final message, with a seeded before/after number) the gen-0 tradeable-fraction
  lift and that the pre-screen avoids walk-forwards for dead genomes.
- Paste: the `genome_signal_activity` signature/`ActivityStats` shape, the added
  `GeneticSearchConfig` fields, and the list of `GENOME_PARAM_BOUNDS` keys whose ranges changed.

## Out of scope

- The graded fitness itself — **WO52** (this WO produces the `no_result` results it scores).
- Parallel evaluation / budget — **WO54**.
- Operators (subtree crossover, adaptive rates) / diversity — **WO55** / WO46.
- Feature-mining seeds — WO45/WO46.
