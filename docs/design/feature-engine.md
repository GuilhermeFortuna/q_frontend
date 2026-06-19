# Feature engine — design

**Status:** design · **Scope:** single-instrument candle strategies (B3 focus) · **Builds on:** the genome DSL + `CompositeStrategy` interpreter (WO38), `GeneticCandidateProvider` (WO39), DSR + lock-box (WO40), the `CandidateProvider` seam (WO31)

This document specifies the **feature engine**: how the platform widens the genome grammar from a price/indicator vocabulary into a richer, economically-motivated, _causal-by-construction_ feature set — and, on top of that, a **feature-discovery layer** that mines and validates new features without turning the search into a data-mining trap.

It targets the constraint the project actually operates under: **a single traded instrument, limited capital, the Brazilian market (B3).** Portfolio / cross-sectional strategies are explicitly out of scope (deferred, see the genetic design doc). Crucially, that constraint does **not** forbid using _other_ symbols as **inputs** — you trade one instrument but may read any number of exogenous series as features. No capital is required to read WDO while trading WIN.

---

## 1. The core principle

A genetic algorithm is a **recombination engine**: it can only rearrange the primitives the grammar exposes. Today that grammar is ~8 indicators over `source.close/high/low/open/volume` plus comparisons and logic (`backtesting/genome/node_specs.py`). With a small vocabulary, a better GA just finds the same few basins faster (MA-cross / RSI-reversion variants). **The edge ceiling is set by the feature vocabulary, not the search operator.**

So the feature engine is the highest-leverage investment in discovery quality. It has two layers:

1. **Hand-authored primitive families** (WO42–WO44) — new causal node kinds added directly to the grammar. Zero mining risk; predictable, economically-motivated coverage (normalization, session/calendar, regime, cross-asset-as-feature).
2. **Feature discovery** (WO45) — a search that _mines compositions_ of primitives, scores them out-of-sample, and promotes only those that survive a strict validation gate into the pool the GA composes with (WO46).

### The danger, stated plainly

**Automated feature creation is a multiple-testing amplifier.** If code generates thousands of candidate features and keeps "the ones that work great on the symbol," it manufactures features that look predictive by pure luck. Mining features on the same data the GA then trains on **doubles the overfitting**. The whole point of the discovery layer is to be the _opposite_ of that: a feature is only promoted if it keeps working on data the miner never saw.

---

## 2. The three-way temporal split (the anti-overfit spine)

Every honest decision must be made on data strictly earlier than — or disjoint from — the data that judges it. The engine carves the date range into three contiguous, non-overlapping segments:

```text
[==== feature-discovery ====][======== walk-forward region ========][== lock-box ==]
         ↑ feature mining             ↑ GA: optimize + WF-validate         ↑ champion, once
         (WO45 only)                    (WO39 evolution, existing)          (WO40, existing)
```

- **Feature-discovery segment** (front, e.g. first 30%): the _only_ data the feature miner sees. Forward-return IC, stability folds, dedup — all computed here. The GA never optimizes here.
- **Walk-forward region** (middle): unchanged from WO39. The GA evolves genomes; Optuna + `WalkForwardRunner` optimize/validate each. Features are _applied_ here but were _selected_ earlier — no leakage.
- **Lock-box** (tail): unchanged from WO40. The champion is backtested exactly once.

This generalizes the existing lock-box split (`optimization/lockbox.py::compute_lockbox_bounds`) from two segments to three. The feature-discovery carve is **front**; the lock-box carve is **tail**; the WF region is what remains. When feature discovery is disabled, the split collapses to today's two-segment behavior **byte-identically**.

> **Leakage-free by construction:** feature selection uses only the front segment; the GA trains/validates on the middle; the champion is judged on the tail. Each stage's data strictly precedes the next decision.

---

## 3. Primitive families

All primitives are **causal**: the value at bar _i_ uses only bars ≤ _i_. They reuse the existing rolling/prefix indicator helpers (`technical_indicators.py`, `moving_averages.py`) wherever possible and slot into the existing node machinery (§4). Output-type tags (`price_series`, `oscillator`, `bool_series`) are honored so the validator wires them safely.

### 3a. Normalization transforms (WO42) — pure, no new data

Raw-price thresholds don't transfer across regimes; normalized ones do. These make every downstream comparison regime-robust.

| Kind                   | Inputs | Output     | Semantics (causal)                                   |
| ---------------------- | ------ | ---------- | ---------------------------------------------------- |
| `transform.zscore`     | 1      | oscillator | `(x − rolling_mean(x, w)) / rolling_std(x, w)`       |
| `transform.rank`       | 1      | oscillator | rolling percentile rank of `x` over window `w` (0–1) |
| `transform.pct_change` | 1      | oscillator | `x / x.shift(k) − 1`                                 |
| `transform.clip`       | 1      | same       | clamp to `[lo, hi]` (optimizable)                    |

### 3b. Session / calendar features (WO43) — B3-aware

Intraday and seasonal effects are among the most persistent retail-driven inefficiencies in a market like B3. These read the bar's `DatetimeIndex` (known at bar _i_ → causal).

| Kind                        | Output      | Semantics                                                              |
| --------------------------- | ----------- | ---------------------------------------------------------------------- |
| `feature.minutes_from_open` | oscillator  | minutes since the configured session open                              |
| `feature.time_of_day`       | oscillator  | normalized intraday position (0–1) within the session                  |
| `feature.day_of_week`       | oscillator  | 0–4 (Mon–Fri)                                                          |
| `feature.session_window`    | bool_series | `True` inside a configurable `[from, to]` intraday window (a **gate**) |

Session bounds default to B3 hours and are config-driven (not hardcoded), so the same primitive serves WIN, WDO, and equities.

### 3c. Regime features (WO43)

Let a genome say "only trade when the market looks like Y."

| Kind                   | Output     | Semantics (causal)                                                                      |
| ---------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `feature.vol_regime`   | oscillator | rolling percentile of realized vol (reuses `compute_realized_vol`/`compute_yang_zhang`) |
| `feature.trend_regime` | oscillator | normalized slope / distance-from-MA of price                                            |

### 3d. Exogenous (cross-asset) features (WO44) — single-symbol-safe

You trade one instrument; you _read_ others. For WIN, the big drivers are **WDO (USD/BRL)**, **overnight ES/NQ**, and **PETR4/VALE3** lead-lag.

| Kind                 | Output       | Semantics                                                      |
| -------------------- | ------------ | -------------------------------------------------------------- |
| `source.exog.close`  | price_series | close of a configured exogenous symbol, aligned as-of-backward |
| `source.exog.return` | oscillator   | exogenous return over `k` bars                                 |
| `source.exog.zscore` | oscillator   | rolling z-score of the exogenous series                        |

Exogenous symbols are loaded **once per run** (same caller-thread pattern as the primary frame) and aligned onto the primary index with a **backward** as-of join + a configurable lag, so bar _i_ only ever reads exogenous data already closed by bar _i_. Overnight-driver use (ES → B3 open) is expressed with an explicit lag, never a contemporaneous future bar.

---

## 4. How a primitive plugs into the genome stack

Every new primitive touches the same five seams. This is the contract WO42 establishes and WO43/WO44 follow:

| Seam                                                          | Change                                                                                                                                                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backtesting/genome/node_specs.py` → `NODE_SPECS`             | Register a `NodeSpec` (arity, input series types, output ports/types, allowed param keys).                                                                                                                        |
| `backtesting/genome/composite_strategy.py` → `_evaluate_node` | Add an `elif kind == ...` branch computing the column(s), reusing existing `compute_*` helpers.                                                                                                                   |
| `backtesting/genome/param_bounds.py` → `GENOME_PARAM_BOUNDS`  | Add `StrategyParamSpec` for each new optimizable knob → auto-becomes an Optuna dim via `derive_genome_search_space`.                                                                                              |
| `backtesting/genome/validate.py` → `validate_genome`          | Auto-covered by the type-closure rules **if** the `NodeSpec` is correct; add special-case checks only where needed (e.g. session bounds).                                                                         |
| `backtesting/genome/operators.py`                             | Make the kind **reachable** by mutation/random-init (today `_mutate_add_node` only adds `ind.ma/ema/rsi`; `build_random_genome` only uses `ind.ma/ema`). Otherwise the primitive exists but the GA never uses it. |

> **Dead-primitive trap:** adding a `NodeSpec` + evaluator branch is necessary but **not sufficient**. If `operators.py` can't reach the kind, the GA will never compose it. WO42 refactors the hardcoded operator pools to be **category-driven** so new primitives are automatically generatable.

Causality test (`test_strategy_causality.py`) auto-applies to `CompositeStrategy`; new kinds must be included in the random-genome generator so the property test exercises them.

---

## 5. Feature discovery & validation (WO45)

A pre-evolution step that runs only on the **feature-discovery segment** (§2) and emits a ranked, deduplicated set of validated feature definitions.

### 5.1 Generation

Compose primitives into bounded candidate feature expressions (small sub-DAGs whose root output is an `oscillator` or `bool_series`). Draw from the WO42–WO44 families. This reuses the genome validator so every candidate is a legal, causal sub-DAG.

### 5.2 Scoring — purged, out-of-sample predictive power

For each candidate feature _f_ and a forward-return target _r(h)_ (return over horizon `h` bars):

- **Information Coefficient (IC):** Spearman rank-correlation between `f[i]` and `r(h)[i]`, with **purging + embargo** of the `h` bars around boundaries so overlapping forward-return labels don't leak.
- **Stability:** split the discovery segment into K folds; require IC **sign-consistency** and a minimum t-stat across folds. A feature that only works in one fold is rejected.
- **Mutual information** as a non-linear complement (optional).

### 5.3 Deduplication

Greedily accept features in IC-rank order; reject any whose `|corr|` to an already-accepted feature exceeds a threshold. You want _new_ information, not 12 flavors of momentum.

### 5.4 Null-floor deflation (the multiple-testing correction)

Estimate the noise floor: **block-permute** the target (or block-bootstrap the feature) to destroy real structure, recompute the best IC over the same number of candidates, and keep only features whose true IC exceeds the null's high quantile by a margin. This is the empirical analogue of the champion DSR — it calibrates "how good would the best-of-N look on pure luck" for _your_ feature search budget. Store the deflated IC alongside the raw IC.

### 5.5 Output

A list of `FeatureDefinition` { sub-DAG (genome nodes), param literals, raw IC, deflated IC, fold t-stats, horizon }. Persisted to the lake (`feature_discovery/{run_id}/...`) and summarized on the run; **best-effort** (a run completes with the lake unwritable).

---

## 6. GA integration & diversity (WO46)

1. **Promote** validated `FeatureDefinition`s into the GA: splice their sub-DAGs into a fraction of the **initial population** (alongside the existing 50% registry-seed / 50% random mix in `build_initial_population`), and ensure their primitive kinds are in the operator pools (WO42) so the GA can recombine and rediscover them.
2. **Diversity-aware selection** in `GeneticCandidateProvider.report()`: penalize a genome's fitness by the correlation of its OOS return stream to already-selected elites (fitness sharing / novelty). The output is a **book of low-correlation single-symbol strategies**, not 50 variants of one — which is exactly what a single-instrument trader wants for regime coverage.
3. **Persist** the discovered features used per champion and the book's pairwise correlation matrix on the run summary.

---

## 7. Batch outline

| WO       | Scope                                                                                               | Depends on            |
| -------- | --------------------------------------------------------------------------------------------------- | --------------------- |
| **WO42** | Feature-primitive **substrate** + GA reachability refactor; ship normalization transforms (3a)      | WO38/WO39 (read)      |
| **WO43** | Session/calendar + regime primitives (3b, 3c), B3-aware config                                      | WO42                  |
| **WO44** | Exogenous cross-asset data plumbing + `source.exog.*` primitives (3d)                               | WO42                  |
| **WO45** | Feature-discovery & validation harness: three-way split, purged OOS IC, stability, dedup, deflation | WO42 (WO43/44 enrich) |
| **WO46** | Wire discovered features into the GA seed + diversity-aware selection + persistence                 | WO45 + WO39           |
| WO47     | _(follow-up, frontend)_ Feature-engine UI: discovered-feature panel, IC stability, book correlation | WO46 + WO41           |

### Dispatch order

```text
WO42 ─┬─► WO43 ─┐
      └─► WO44 ─┴─► WO45 ─► WO46 ─► (WO47)
```

WO42 first (it establishes the "how to add a primitive" contract + operator reachability). WO43 and WO44 are independent enrichments that can run **in parallel** after WO42. WO45 consumes whatever families exist; WO46 closes the loop into the GA. WO47 (frontend) is deferred — the user's focus is discovery capability, not UI.

---

## 8. Causality & guardrails (apply to the whole batch)

- **Causal by construction.** Every new primitive's value at bar _i_ uses only bars ≤ _i_. No centered windows, no whole-series normalization, no contemporaneous-future exogenous reads. `CompositeStrategy` must keep passing `test_strategy_causality.py` for a canonical genome **and** N random valid genomes that include the new kinds.
- **Disabled = byte-identical.** With feature discovery off and no new primitives in a genome, a strategy-search / genetic run, its persistence, and its API payloads match today exactly. The three-way split collapses to the existing two-segment lock-box split.
- **One load per symbol per run.** Exogenous symbols load once on the caller thread and ride along the existing `from_frame_sliced` reuse; the `get_ohlcv`-once guarantee per symbol is preserved (call-count test).
- **No leakage across the three-way split.** Feature mining touches only the front segment; WF test windows fall strictly inside the middle; the lock-box is the tail. Date-assertion tests prove the boundaries.
- **Validation, not generation, is the moat.** Feature _generation_ is cheap (and an LLM can propose B3-specific hypotheses). A feature ships only if it clears purged OOS IC + stability + dedup + null-floor deflation. Promotion to a grammar primitive is gated on that, never on in-sample fit.
- **Best-effort persistence.** Feature-discovery artifacts go to the lake; a run completes with the lake unwritable and with Postgres stopped.
