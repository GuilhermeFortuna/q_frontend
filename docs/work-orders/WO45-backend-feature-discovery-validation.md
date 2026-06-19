# WO45 — Backend: feature-discovery & validation harness (three-way split, purged OOS IC, deflation)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "Feature Engine". WO42–WO44 widened the genome grammar with new
causal primitives. **This WO is the anti-overfitting core** — the part that makes automated feature
creation a research instrument instead of a data-mining trap. It adds a **feature-discovery layer**
that mines compositions of primitives, scores them on data the GA never trains on, and emits only
features that survive **purged out-of-sample IC + cross-fold stability + de-duplication + null-floor
deflation**. Design: **`docs/design/feature-engine.md` §2, §5, §8** (read them).

**The one rule that matters.** A feature is promotable **only** if it keeps predicting on data the
miner never saw. Mining features on the same data the GA then optimizes on doubles the overfitting.
This WO carves a dedicated **feature-discovery segment** at the front of the range — disjoint from
the walk-forward region and the lock-box — and validates every feature there with leakage controls.

---

## How the pieces work today (read these files)

- `src/q_backend/optimization/lockbox.py` — `compute_lockbox_bounds(start, end, lockbox)` returns
  `(wf_end, lockbox_start, lockbox_end)` and `backtest_config_for_walkforward` truncates the WF
  range. **You generalize this two-segment split into a three-segment split** (front discovery,
  middle WF, tail lock-box). `LockboxConfig` lives in `strategy_search.py`.
- `src/q_backend/backtesting/genome/operators.py` — `build_random_genome`, `draw_valid_child`,
  `_draw_valid`, the category pools (WO42). Reuse these to **generate candidate feature sub-DAGs**
  (no new generator — a feature is a small valid genome whose root output is oscillator/bool).
- `src/q_backend/backtesting/genome/compile.py` + `composite_strategy.py` — `compile_genome` and
  `CompositeStrategy.compute_indicators` materialize a genome's columns. A candidate feature's value
  series = the root node's column after `compute_indicators` over the **discovery segment** frame.
- `src/q_backend/optimization/backtest_runner.py` — `load_sliced_frame` / `from_frame_sliced`. The
  discovery segment is a **slice of the same loaded frame** (incl. WO44 exogenous columns) — never
  a refetch.
- `src/q_backend/optimization/dsr.py` — `deflated_sharpe_ratio`: the existing multiple-testing
  correction over the effective trial count. Mirror its _spirit_ for the feature IC null floor.

---

## Goal

```python
report = discover_features(FeatureDiscoveryConfig(...), frame, primary_returns)
#   -> ranked, de-duplicated list[FeatureDefinition] with raw IC, deflated IC, fold t-stats,
#      computed ONLY on the front discovery segment; nothing here touches WF or lock-box data.
```

## Tasks

### 1. Three-way temporal split — generalize `lockbox.py`

Add `FeatureDiscoveryConfig` (additive on `StrategySearchConfig`):

```python
class FeatureDiscoveryConfig(BaseModel):
    enabled: bool = False
    discovery_pct: float | None = 0.30   # front fraction reserved for mining (xor discovery_days)
    discovery_days: int | None = None
    forward_horizon_bars: int = 1        # target = return over this many bars
    n_folds: int = 4                     # stability folds within the discovery segment
    embargo_bars: int | None = None      # default = forward_horizon_bars
    max_candidates: int = 2000           # mining budget (drives the null-floor deflation)
    min_abs_ic: float = 0.02             # raw screen before deflation
    dedup_corr: float = 0.7              # drop features |corr| above this to an accepted one
    promote_top_k: int = 24              # how many survivors to hand to the GA (WO46)
    seed: int | None = None
```

Generalize `compute_lockbox_bounds` (or add `compute_three_way_bounds`) to return
`(discovery_start, discovery_end, wf_start, wf_end, lockbox_start, lockbox_end)`:

```text
[ discovery_start .. discovery_end )[ wf_start .. wf_end )[ lockbox_start .. lockbox_end )
        front (FeatureDiscovery)          middle (existing WF)        tail (existing lock-box)
```

- `discovery_*` carved from the **front** by `discovery_pct`/`discovery_days`; lock-box from the
  **tail** (unchanged WO40 logic); WF is the remainder. The existing `LockboxConfig` tail math is
  reused verbatim. With `FeatureDiscovery.enabled=False`, the split collapses to today's
  two-segment behavior **byte-identically** (`wf_start == start`, no discovery carve).

### 2. Candidate generation — `optimization/feature_discovery.py`

- Draw `max_candidates` valid feature sub-DAGs using the WO42 category pools + `build_random_genome`
  helpers, constrained so each root output is `oscillator` or `bool_series` and node count is small
  (parsimony — features are simple). Reuse the genome validator; redraw on invalid.
- Materialize each feature's value series by compiling + running `compute_indicators` over the
  **discovery-segment slice only** (warm-up allowed by reaching earlier bars within the segment).

### 3. Scoring — purged out-of-sample IC (design §5.2)

For each candidate feature `f` and target `r = primary forward return over forward_horizon_bars`:

- **IC** = Spearman rank-correlation between `f[i]` and `r[i]`.
- **Purge + embargo:** drop the `embargo_bars` rows around fold boundaries so overlapping
  forward-return labels never straddle train/score — implement a purged K-fold over the discovery
  segment (López de Prado style). Compute IC per fold.
- **Stability gate:** require IC **sign-consistency** across `n_folds` and a minimum |mean IC| /
  fold-IC t-stat. A feature strong in one fold but flat elsewhere is rejected.

### 4. De-duplication (design §5.3)

Greedily accept survivors in descending |mean IC|; reject any candidate whose absolute correlation
(of its value series) to an already-accepted feature exceeds `dedup_corr`. Keep at most
`promote_top_k`.

### 5. Null-floor deflation (design §5.4) — the multiple-testing correction

- Build a null by **block-permuting** the target `r` (preserve autocorrelation block size ≈
  `forward_horizon_bars`) and recomputing the **best** |IC| over the same candidate budget; repeat
  to estimate the null's high quantile (e.g. 95th).
- A feature is promotable only if its true IC exceeds the null quantile by a margin. Store both
  `ic_raw` and `ic_deflated` (true IC minus null floor, or a p-value vs the null). This is the
  empirical analogue of `dsr.py`'s correction, applied to feature mining.

### 6. Output + persistence

```python
@dataclass
class FeatureDefinition:
    feature_id: str
    nodes: list[dict]        # the validated sub-DAG (genome node JSON)
    root_ref: str            # which node/port is the feature value
    output_type: str         # "oscillator" | "bool_series"
    ic_raw: float
    ic_deflated: float
    fold_ics: list[float]
    horizon_bars: int

@dataclass
class FeatureDiscoveryReport:
    features: list[FeatureDefinition]   # ranked, deduped, deflation-passed
    candidates_evaluated: int
    null_ic_quantile: float
    discovery_bounds: tuple[datetime, datetime]
```

Persist the report to the lake under `feature_discovery/{run_id}/` (features + null stats) and put a
compact summary (`candidates_evaluated`, `null_ic_quantile`, promoted feature count + ids) on the
run `result_summary`. **Best-effort** — a run completes with the lake unwritable and Postgres
stopped.

## Guardrails

> **No leakage across the split.** Every IC, fold, and dedup correlation is computed **only** on the
> discovery segment. A date-assertion test proves no discovery bar overlaps the WF region or the
> lock-box, and that WF test windows + lock-box are untouched by this WO.

> **Purged + embargoed.** Forward-return labels overlap by `forward_horizon_bars`; the purged K-fold
>
> - embargo must remove straddling rows. A test with a deliberately leaky (lookahead) feature shows
>   high naive IC but **fails** the purged/stability gate.

> **Deflation bites.** Holding a feature's true IC fixed, increasing `max_candidates` raises the null
> floor and lowers `ic_deflated` (more candidates tried → higher bar) — mirror `test_dsr.py`'s
> monotonicity assertion.

> **Disabled = identical.** `FeatureDiscovery.enabled=False` → three-way split collapses to today's
> two-segment lock-box split; no discovery runs; payloads/persistence byte-identical to WO44.

> **Deterministic.** Same `seed` → identical candidate set, fold assignment, null draws, and promoted
> features.

## Tests — `tests/.../test_feature_discovery.py`, `test_three_way_split.py`

- **Three-way bounds:** discovery (front) / WF (middle) / lock-box (tail) are contiguous,
  non-overlapping; disabled collapses to the WO40 two-segment result exactly.
- **Purged IC:** a planted predictive feature (signal + noise) clears the gate; a pure-noise feature
  does not; a **lookahead** feature with high naive IC is rejected by purge/stability.
- **Dedup:** two near-identical features → only one promoted (`|corr| > dedup_corr`).
- **Deflation monotonicity:** more candidates → higher null floor → lower `ic_deflated`; hand-checked
  on a toy distribution within tolerance.
- **Determinism:** same seed → identical `FeatureDiscoveryReport`.
- **Resilience:** report builds with the lake unwritable; run completes with Postgres stopped.
- Existing lock-box / DSR / walk-forward / genome tests green and unmodified.

## Docs

`q_backend/README.md`: a "Feature discovery" note — the three-way split, purged OOS IC + stability,
dedup, null-floor deflation — framed as **"a feature ships only if it survives data the miner never
saw."** Link the design doc.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Disabled path byte-identical to WO44; existing tests untouched and green.
- In your final message, paste: the `FeatureDiscoveryConfig` field list, the `compute_three_way_bounds`
  return tuple, and the `FeatureDefinition` / `FeatureDiscoveryReport` shapes — **WO46 consumes
  these to seed the GA.**

## Out of scope

- Seeding discovered features into the GA population + diversity-aware selection (WO46).
- New primitive families (WO42–WO44 — done).
- A model-based (non-IC) feature scorer; per-feature DSR as a hard strategy gate.
- Any frontend (WO47).
