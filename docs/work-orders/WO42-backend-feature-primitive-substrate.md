# WO42 — Backend: feature-primitive substrate + GA reachability + normalization transforms

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "Feature Engine". A genetic algorithm can only recombine the
primitives the grammar exposes; today that vocabulary is ~8 indicators over price sources plus
comparisons/logic. This batch widens it. **This WO is the foundation**: it (1) establishes the
canonical "how to add a feature primitive" path across the five genome seams, (2) refactors the
**hardcoded operator pools** so new primitive kinds are automatically reachable by the GA (today
they are not — `_mutate_add_node` only ever adds `ind.ma/ema/rsi`), and (3) ships the first,
zero-mining-risk family: **normalization transforms**. Design: **`docs/design/feature-engine.md`
§1, §3a, §4** (read them).

**Why reachability is half the work.** Adding a `NodeSpec` + an evaluator branch makes a primitive
_expressible_, but the GA will never _use_ it unless `operators.py` can draw it during random init
and mutation. A primitive the GA can't reach is dead weight. This WO makes the operator pools
**category-driven** so WO43/WO44 primitives become generatable for free.

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/genome/node_specs.py` — `NodeSpec` dataclass (`kind`, `min_inputs`,
  `max_inputs`, `input_series_types`, `output_ports`, `port_types`, `allowed_param_keys`) and the
  `NODE_SPECS` dict (the v1 allowlist). `ALLOWED_NODE_KINDS = frozenset(NODE_SPECS)`. Output types:
  `price_series | oscillator | bool_series | exit_policy`.
- `src/q_backend/backtesting/genome/composite_strategy.py` — `CompositeStrategy._evaluate_node`
  (the `if/elif kind == ...` dispatch that writes each node's column(s)) and `compute_indicators`
  (vectorized pass with a `_series_cache` keyed by `compiled.cache_key`). Reuses `compute_ma`,
  `compute_rsi`, `compute_realized_vol`, etc. — **reuse these, do not reimplement math.**
- `src/q_backend/backtesting/genome/param_bounds.py` — `GENOME_PARAM_BOUNDS: dict[str,
StrategyParamSpec]`. Any `{"param": key}` slot resolves its bounds here and becomes an Optuna
  dimension via `genome/search_space.py::derive_genome_search_space`.
- `src/q_backend/backtesting/genome/validate.py` — `validate_genome` (type-closure, arity, depth,
  acyclicity, param-ref bounds). New kinds are auto-covered **if** their `NodeSpec` is right.
  `resolve_node_params`, `collect_genome_param_keys` live here too.
- `src/q_backend/backtesting/genome/operators.py` — the GA operators. Note the **hardcoded pools**:
  `INDICATOR_KINDS` (excludes diff/ratio/tsmom), `_mutate_add_node` appends only
  `rng.choice(["ind.ma", "ind.ema", "ind.rsi"])`, `build_random_genome` uses only `ind.ma/ema`,
  `_mutate_swap_indicator` swaps within same output-type + arity. **These are what you refactor.**
- `tests/.../test_strategy_causality.py` — auto-applies to `CompositeStrategy` (registered) on a
  canonical genome + random genomes. New primitives must be exercised by the random generator.

---

## Goal

```python
# A new primitive is added by touching exactly the five seams, and the GA reaches it automatically.
register-style additions to NODE_SPECS + _evaluate_node + GENOME_PARAM_BOUNDS;
operators draw new kinds from category-driven pools (no per-kind hardcoding).
# Ship transform.zscore / transform.rank / transform.pct_change / transform.clip as the first family.
```

## Tasks

### 1. Category metadata on `NodeSpec` (node_specs.py)

Add an optional, additive field so operators can group primitives without string-prefix guessing:

```python
# NodeSpec gains:  category: str = "core"   # e.g. "indicator" | "feature" | "transform" | "source" | "cmp" | "logic" | "exit"
# and:             generatable: bool = True # may the random/add-node operators draw this kind?
```

Tag the existing kinds to preserve **today's** behavior exactly (e.g. `ind.diff`/`ind.ratio`/
`ind.tsmom` stay out of the swap/add pools — set `generatable=False` for those, matching the
current `INDICATOR_KINDS` exclusion). Defaults must reproduce current pools when WO42's new kinds
are absent.

### 2. Normalization transforms (design §3a) — node specs + evaluator + bounds

Add to `NODE_SPECS` (all `category="transform"`, `generatable=True`):

| Kind                   | inputs | input types | output port → type   | params                  |
| ---------------------- | ------ | ----------- | -------------------- | ----------------------- |
| `transform.zscore`     | 1      | any series  | `out` → oscillator   | `window`                |
| `transform.rank`       | 1      | any series  | `out` → oscillator   | `window`                |
| `transform.pct_change` | 1      | any series  | `out` → oscillator   | `change_bars`           |
| `transform.clip`       | 1      | any series  | `out` → same-as-in\* | `clip_low`, `clip_high` |

\* For `transform.clip`, follow the existing `transform.scale`/`abs` convention (declared
`price_series` out port; passthrough numeric). Implement causal, rolling formulas in
`_evaluate_node` (design §3a): z-score = `(x − x.rolling(w).mean()) / x.rolling(w).std()`; rank =
`x.rolling(w).apply(percentile_of_last)` (use a vectorized rolling-rank, not a slow `apply` if
practical — but correctness/causality first); pct_change = `x / x.shift(k) − 1`.

Add the new param specs to `GENOME_PARAM_BOUNDS` (`window` 5–200 int; `change_bars` 1–100 int;
`clip_low`/`clip_high` float). Reuse the existing `window` spec if present and bounds fit.

> **Causality:** rolling with `min_periods=window`; never centered; `pct_change` uses `.shift(k)`
> with `k ≥ 1`. Value at bar _i_ uses only bars ≤ _i_.

### 3. Category-driven operator pools (operators.py) — the reachability refactor

Replace the hardcoded literals with helpers derived from `NODE_SPECS` + the new `category`/
`generatable` tags:

- `INDICATOR_KINDS` → derive as "kinds with `generatable=True` whose primary output feeds a price/
  oscillator series and arity ≥ 1" (preserve the diff/ratio/tsmom exclusion via `generatable`).
- `_mutate_add_node` → instead of `["ind.ma","ind.ema","ind.rsi"]`, draw from a **generatable
  unary series-producing pool** that now includes the transforms. Keep wiring rules identical
  (attach to a `source.close`, re-point a random entry signal), just widen the kind choice.
- `build_random_genome` → allow a transform to sit between a source and an indicator with some
  probability, so generation-0 genomes exercise the new kinds (and the causality property test
  covers them).
- `_mutate_swap_indicator` → its compatibility filter already keys on output-type + arity; make it
  draw from the category pool so a `transform.zscore` can swap for an `ind.rsi` (both 1-input
  oscillators).

> **Preserve today's trajectories when the new kinds are absent.** A determinism/parity guard:
> with the WO42 transform kinds temporarily removed from the pool, a seeded population trajectory
> must match the pre-WO42 sequence (so the refactor is behavior-preserving for existing kinds).

### 4. Keep the math reuse honest

`transform.*` use pandas rolling primitives directly (no domain indicator). Do **not** add new
EMA/RSI/std implementations — z-score std is `pd.Series.rolling(w).std()` (population vs sample:
match `compute_bollinger_bands`'s convention for consistency). Document the choice in a comment.

## Guardrails

> **Disabled = identical.** A genome containing none of the new kinds compiles, validates, and
> backtests **byte-identically** to pre-WO42. Existing genome/optimization/walk-forward tests stay
> green and unmodified. The `NodeSpec` field additions are additive with defaults.

> **No dead primitives.** Every new kind is reachable by `_mutate_add_node` **and** appears in at
> least some seeded random genomes — proven by a test that generates N random genomes and asserts
> each new kind appears across the sample.

> **Causal by construction.** `CompositeStrategy` keeps passing `test_strategy_causality.py` for
> the canonical genome and for random genomes that now include `transform.*`.

> **Reuse the interpreter cache.** New branches write their column(s) and let the existing
> `_series_cache`/`cache_key` machinery handle reuse — do not add a parallel cache.

## Tests — `tests/.../test_feature_transforms.py`, extend `test_genome_*`

- **Numeric correctness:** `transform.zscore`/`rank`/`pct_change`/`clip` match hand-computed
  values on a small synthetic series; NaN warm-up region matches `min_periods`.
- **Causality:** prefix test — value at bar _i_ is unchanged when bars > _i_ are removed (per the
  causality-test pattern), for each new kind.
- **Reachability:** over N seeded random genomes + N `_mutate_add_node` applications, every new
  `transform.*` kind appears at least once.
- **Behavior-preserving refactor:** with the new kinds excluded from the pool, a seeded
  `build_initial_population` + mutation trajectory equals the pre-WO42 sequence.
- **Search-space derivation:** a genome using `{"param": "window"}` on `transform.zscore` yields
  an Optuna dimension via `derive_genome_search_space`; literal windows stay fixed.
- Existing `test_strategy_causality.py`, genome, optimization, walk-forward tests green and
  unmodified.

## Docs

`q_backend/README.md`: under the genome/genetic section, a short "Feature primitives" note — the
five seams a primitive touches and the category-driven operator pools — pointing to
`docs/design/feature-engine.md`.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Existing genome/optimization/walk-forward/causality tests untouched and green.
- In your final message, paste: the updated `NodeSpec` field list (with `category`/`generatable`),
  the four `transform.*` `NodeSpec` rows, their `GENOME_PARAM_BOUNDS` entries, and the new
  category-pool helper signatures in `operators.py` — **WO43 and WO44 add primitives against this
  exact contract.**

## Out of scope

- Session/calendar/regime primitives (WO43); exogenous/cross-asset (WO44).
- The feature-discovery layer and any validation/IC machinery (WO45).
- Diversity-aware selection and seeding discovered features into the GA (WO46).
- Any frontend (WO47).
