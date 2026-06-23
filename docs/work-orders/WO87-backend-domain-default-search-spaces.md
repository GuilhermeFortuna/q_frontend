# WO87 — backend: domain-grounded default search spaces for optimization & discovery

## Shared context (read first)

Two-repo project (Windows paths for execution: `C:\Users\guilherme\q\...`):

- Backend `q_backend` — Python/FastAPI, use **`uv`** / `uv run pytest` (never pip/poetry).
- Frontend `q_frontend` — React/TS/Vite, use **`pnpm`** (never npm).

The problem: optimization sweeps and GA discovery derive their search spaces from each
parameter's `min`/`max`/`step`. Those values were authored as **manual-editor validation
bounds**, not **search bounds**, so the optimizer inherits absurd grids and false precision:

| Param                | Today             | Grid points | Why it's wrong (trading domain)                                                                                                            |
| -------------------- | ----------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `stop_loss_pct`      | 0–0.50 step 0.001 | ~500        | A 50% stop is never traded; real stops ≈ 0.2–5%. 0.1% increments are curve-fit noise.                                                      |
| `take_profit_pct`    | 0–1.0 step 0.001  | ~1000       | Real targets ≈ 0.3–10%.                                                                                                                    |
| `trailing_stop_pct`  | 0–0.50 step 0.001 | ~500        | ≈ 0.3–6%.                                                                                                                                  |
| `threshold` (genome) | −50–50 step 0.01  | ~10000      | Also the discovery dead-genome bug — thresholds land outside indicator output ranges so signals never fire (see `ga-discovery-diagnosis`). |

Oversized grids waste the trial budget on regions no trader uses **and** the false precision
overfits. This WO replaces the defaults with ranges grounded in algorithmic-trading domain
knowledge, **without** restricting the manual editor.

## How the pieces work today (read these files)

- `q_backend/src/q_backend/backtesting/strategy_registry.py` — `StrategyParamSpec`
  (`min`/`max`/`step`/`choices`). Serialized to the frontend registry endpoint and consumed
  by both the manual editor and the search-space derivation.
- `q_backend/src/q_backend/optimization/auto_search_space.py` — `_search_param_from_spec`
  maps a spec → `IntParam`/`FloatParam`/`CategoricalParam` or `None` (→ `fixed_params`).
  Used by `derive_strategy_search_space` (registry optimization sweeps) and by
  `exit_preset_search_space.py`.
- `q_backend/src/q_backend/optimization/exit_preset_search_space.py` — discovery exit-preset
  candidate expansion (WO79). Calls the `auto_search_space` `_search_param_from_spec`.
- **There is a SECOND, separate `_search_param_from_spec`** in
  `q_backend/src/q_backend/backtesting/genome/search_space.py` used by GA **discovery**. It
  reads only `min/max/step` from `GENOME_PARAM_BOUNDS` and **does not know about `search_*`**.
  This is why curating exit specs alone does NOT reach discovery (see Task 6).
- `q_backend/src/q_backend/backtesting/genome/exit_rule_policy.py` —
  `register_exit_param_bounds()` (runs at import) copies every exit-rule spec into
  `GENOME_PARAM_BOUNDS["exit_<name>"]`, carrying `min/max/step`. This copy is what discovery
  actually samples exit magnitudes from — so the curated exit bounds must be baked in here.
- `q_backend/src/q_backend/optimization/models.py` — `IntParam`, `FloatParam`,
  `LogFloatParam(low>0, high>0)` (continuous, no step), `CategoricalParam`.
- `q_backend/src/q_backend/backtesting/exit_rules/legacy.py` + `breakeven.py` — exit-rule
  `param_specs()` (the SL/TP/trailing/breakeven specs).
- `q_backend/src/q_backend/backtesting/strategies/*.py` — 11 registered strategies'
  `param_specs()`.
- `q_backend/src/q_backend/backtesting/genome/param_bounds.py` — `GENOME_PARAM_BOUNDS`,
  the DSL knobs the GA samples directly (these have **no manual editor**).
- `q_frontend/src/components/optimize/StrategySearchSpaceFields.tsx` — prefills the search
  UI from `spec.step`. `q_frontend/src/components/shared/StrategyParamFields.tsx` — the
  manual editor (uses `spec.min/max/step`; **must stay unchanged in behavior**).

## Goal

Search bounds become a first-class, separate concept from editor bounds, defaulted from
domain knowledge:

```python
# StrategyParamSpec gains optimizer-only fields; editor still uses min/max/step.
StrategyParamSpec(
    name="stop_loss_pct",
    type="float", default=0.0,
    min=0.0, max=0.50, step=0.001,      # manual editor — UNCHANGED
    search_min=0.002, search_max=0.05,  # optimizer: 0.2%–5%
    search_scale="log",                 # geometric: density where it matters
)
```

```python
# Derivation prefers search_* (fallback to min/max/step); log → LogFloatParam.
def _search_param_from_spec(spec):
    if not spec.searchable:
        return None  # → fixed_params (pin realism knobs)
    lo = spec.search_min if spec.search_min is not None else spec.min
    hi = spec.search_max if spec.search_max is not None else spec.max
    st = spec.search_step if spec.search_step is not None else spec.step
    if spec.type == "float" and spec.search_scale == "log" and lo and lo > 0:
        return LogFloatParam(low=lo, high=hi)
    ...
```

## Tasks

### 1. Extend `StrategyParamSpec` (`strategy_registry.py`)

Add optimizer-only fields (all optional, default to "no override"):

```python
search_min: float | None = None
search_max: float | None = None
search_step: float | None = None
search_scale: Literal["linear", "log"] | None = None
searchable: bool = True
```

Add a pydantic `model_validator` (mode="after"):

- if `search_min`/`search_max` both set → require `search_min < search_max`;
- if `search_scale == "log"` → require the effective low (`search_min` or `min`) `> 0`;
- `search_scale == "log"` only valid for `type == "float"`.

### 2. Rewrite `_search_param_from_spec` (`auto_search_space.py`)

- Return `None` when `spec.searchable is False` (caller pins to `fixed_params`).
- Resolve `lo/hi/st` preferring `search_*`, falling back to `min/max/step`.
- `float` + `search_scale == "log"` + `lo > 0` → `LogFloatParam(low=lo, high=hi)`.
- `float` otherwise → `FloatParam(low=lo, high=hi, step=st)`; `int` → `IntParam` (linear,
  log not supported for ints); `categorical` → unchanged.
- **No global grid cap** (curation-only, by decision). Update the module docstring (it
  currently says "LogFloatParam is not inferred from registry metadata" — now it is).

> `exit_preset_search_space.py` calls this same function — verify its helpers
> (`_force_enable_param_includes_off`, `_fallback_enable_search_param`) still behave; the
> enable-param `low=0` injection must continue to work with log magnitude params (the enable
> param is a separate spec from the magnitude param, so log on the magnitude is fine).

### 3. Curate exit-rule specs (`exit_rules/legacy.py`, `exit_rules/breakeven.py`)

% exits use **log** (sensitivity highest at tight stops; traders think geometrically). ATR
exits use **linear** (additive multiples, narrow range). Add `search_*` only — leave
`min/max/step` as-is:

| Param                   | search_min | search_max | search_step | search_scale | Rationale              |
| ----------------------- | ---------- | ---------- | ----------- | ------------ | ---------------------- |
| `stop_loss_pct`         | 0.002      | 0.05       | —           | log          | 0.2–5%                 |
| `take_profit_pct`       | 0.003      | 0.10       | —           | log          | 0.3–10%                |
| `trailing_stop_pct`     | 0.003      | 0.06       | —           | log          | 0.3–6%                 |
| `breakeven_trigger_pct` | 0.002      | 0.03       | —           | log          | small favorable move   |
| `breakeven_offset_pct`  | 0.0005     | 0.005      | —           | log          | covers cost/slippage   |
| `stop_loss_atr`         | 1.0        | 4.0        | 0.5         | linear       | Chandelier≈3           |
| `take_profit_atr`       | 1.0        | 6.0        | 0.5         | linear       | reward side            |
| `atr_period`            | 7          | 28         | 7           | linear       | [7,14,21,28], canon 14 |

### 4. Curate strategy specs (`strategies/*.py`)

Coarse linear grids of ~3–6 points anchored on canonical values (period 50≈51 is noise):

| Strategy            | Param                 | search_min | search_max | search_step | Note                                                |
| ------------------- | --------------------- | ---------- | ---------- | ----------- | --------------------------------------------------- |
| bollinger_reversion | period                | 10         | 40         | 10          | canon 20                                            |
|                     | num_std               | 1.0        | 3.0        | 0.5         | canon 2                                             |
| donchian_breakout   | period                | 10         | 60         | 10          | Turtle 20                                           |
| fma                 | period                | 20         | 100        | 20          |                                                     |
|                     | band_pct              | 0.0        | 1.0        | 0.25        |                                                     |
|                     | holding_period        | 5          | 30         | 5           |                                                     |
| trb                 | period                | 20         | 120        | 20          |                                                     |
|                     | band_pct              | 0.0        | 1.0        | 0.25        |                                                     |
|                     | holding_period        | 5          | 30         | 5           |                                                     |
| vma                 | period                | 10         | 50         | 10          | canon 20                                            |
|                     | band_pct              | 0.0        | 1.0        | 0.25        |                                                     |
| macd                | fast_period           | 8          | 16         | 4           | [8,12,16]                                           |
|                     | slow_period           | 20         | 32         | 6           | [20,26,32]                                          |
|                     | signal_period         | 6          | 12         | 3           | [6,9,12]                                            |
| ma_crossover        | short_period          | 10         | 60         | 10          |                                                     |
|                     | long_period           | 100        | 250        | 50          | canon 200                                           |
|                     | threshold             | 0.0        | 1.0        | 0.25        | confirmation band %                                 |
| rsi_mean_reversion  | period                | 7          | 21         | 7           | [7,14,21]                                           |
|                     | oversold              | 15         | 35         | 5           |                                                     |
|                     | overbought            | 65         | 85         | 5           |                                                     |
| tsmom               | lookback_bars         | 63         | 252        | 63          | 3/6/9/12-mo                                         |
|                     | rebalance_bars        | 21         | 63         | 21          | monthly→quarterly                                   |
|                     | vol_window            | 21         | 126        | 21          | canon 63                                            |
|                     | trend_signal_cap      | 1.0        | 3.0        | 0.5         |                                                     |
|                     | nw_lags               | 0          | 8          | 2           |                                                     |
| hurst_trend_blend   | lookback_1            | 21         | 63         | 21          | short horizon                                       |
|                     | lookback_2            | 63         | 189        | 63          | med horizon                                         |
|                     | lookback_3            | 126        | 378        | 126         | long, canon 252                                     |
|                     | rebalance_bars        | 21         | 63         | 21          |                                                     |
|                     | vol_window            | 21         | 126        | 21          |                                                     |
|                     | risk_free_rate_annual | —          | —          | —           | **`searchable=False`** (Sharpe input, not alpha)    |
|                     | signal_lag_bars       | —          | —          | —           | **`searchable=False`** (lookahead guard, not alpha) |
| gatev_pairs         | formation_bars        | 126        | 378        | 126         | canon 252 (12-mo)                                   |
|                     | trading_bars          | 63         | 189        | 63          | canon 126 (6-mo)                                    |
|                     | open_threshold_sd     | 1.5        | 3.0        | 0.5         | Gatev 2σ                                            |
|                     | vol_window            | 21         | 126        | 21          |                                                     |

> Categorical params (`ma_type`, `vol_estimator`, `trading_rule`, Gatev `col_*`,
> `rebalance_on_every_bar`) already have small, sane choice sets — leave them.

### 5. Tighten genome bounds in place (`genome/param_bounds.py`)

`GENOME_PARAM_BOUNDS` has **no manual editor** — the GA sampler reads `min/max/step`
directly — so edit `min/max/step` in place (do not use `search_*` here):

| Param          | New min | New max | New step | (was)         |
| -------------- | ------- | ------- | -------- | ------------- |
| short_period   | 5       | 60      | 5        | 2–400/1       |
| long_period    | 50      | 300     | 25       | 2–400/1       |
| threshold      | −3.0    | 3.0     | 0.5      | −50–50/0.01   |
| period         | 10      | 100     | 10       | 2–400/1       |
| oversold       | 15      | 40      | 5        | 0–50/0.5      |
| overbought     | 60      | 85      | 5        | 50–100/0.5    |
| num_std        | 1.0     | 3.0     | 0.5      | 0.5–5/0.1     |
| fast_period    | 5       | 20      | 5        | 2–100/1       |
| slow_period    | 20      | 60      | 10       | 2–400/1       |
| signal_period  | 5       | 15      | 5        | 2–100/1       |
| band_pct       | 0.0     | 1.0     | 0.25     | 0–5/0.01      |
| holding_period | 5       | 30      | 5        | 1–60/1        |
| lookback_bars  | 60      | 360     | 60       | 20–1000/1     |
| rebalance_bars | 10      | 60      | 10       | 1–252/1       |
| vol_window     | 20      | 120     | 20       | 2–400/1       |
| factor         | 0.5     | 3.0     | 0.5      | 0.01–100/0.01 |
| lookback_1     | 10      | 60      | 10       | 2–100/1       |
| lookback_2     | 30      | 150     | 30       | 2–300/1       |
| lookback_3     | 100     | 400     | 100      | 2–500/1       |

> Indicator-output-relative threshold alignment (so genomes actually fire) is the deeper
> discovery fix owned by the repair operator — out of scope here. This WO only narrows the
> raw range so the GA isn't sampling nonsense.

### 6. Propagate exit search bounds into discovery (`genome/exit_rule_policy.py`)

Without this, Task 3 only reaches **optimization** — GA **discovery** would still search
`exit_stop_loss_pct` over 0–0.5 step 0.001 (the original overfitting case). Discovery samples
exit magnitudes from `GENOME_PARAM_BOUNDS["exit_<name>"]`, which `register_exit_param_bounds()`
copies from the exit specs via `min/max/step`. Bake the curated search bounds into that copy:

- In `register_exit_param_bounds()`, when copying an exit spec into `GENOME_PARAM_BOUNDS`,
  translate the curated `search_*` into the copied `min`/`max`/`step` (the genome sampler and
  `genome/search_space.py` both read those — no need to touch either):
  - `min ← search_min` (then the existing enable-param `min=0` override still applies),
    `max ← search_max`, `step ← search_step` when set.
  - **Log → linear approximation** (the genome sampler has no log mode): when
    `search_scale == "log"` and `search_step` is unset, synthesize a coarse linear step
    targeting ≤ ~15 grid points, e.g. `step = round_sig((search_max - search_min) / 12)`.
    Document that discovery uses a linear approximation of the optimizer's log range.
  - Leave `searchable=False` exit params (none today) pinned as before.
- Do **not** add a third derivation path. The fix is purely in the bound-copy at registration;
  `genome/search_space.py::_search_param_from_spec` stays as-is and inherits the tightened
  bounds automatically.

> Reconcile note: two `_search_param_from_spec` copies now exist (auto_search_space vs.
> genome/search_space). This WO does NOT merge them (risk/scope) — it routes the exit fix
> through `register_exit_param_bounds` so both paths converge. A future cleanup may unify them.

### 7. Frontend pass-through (`q_frontend`)

- Extend the TS `StrategyParamSpec` type with `search_min`/`search_max`/`search_step`/
  `search_scale`/`searchable`.
- `StrategySearchSpaceFields.tsx`: prefill the search range from `search_min/max/step` when
  present (fall back to `min/max/step`); render a small "log" tag when `search_scale==="log"`;
  hide / omit params with `searchable===false` from the optimizable list.
- `StrategyParamFields.tsx` (manual editor): **no change** — it must keep using `min/max/step`.

## Guardrails

> The manual editor (`StrategyParamFields.tsx`) behavior is **read-only** in this WO — its
> `min/max/step` source must not change.
> Two derivation functions exist (optimization `auto_search_space` vs. discovery
> `genome/search_space`). Do **not** add a third, and do **not** merge them in this WO. The
> exit fix reaches discovery via `register_exit_param_bounds` baking bounds into
> `GENOME_PARAM_BOUNDS` (Task 6), so the genome derivation needs no change.
> No global grid-point cap (decided): curation is the only mechanism.
> Determinism: changing genome `min/max` can put previously-stored genomes out of bounds —
> confirm the existing clamp/repair on load still holds them in range (don't add new clamping).
> `LogFloatParam` is continuous (no step) — `search_step` is ignored when `search_scale=="log"`.

## Tests

- `q_backend/tests/optimization/test_auto_search_space.py`:
  - `search_*` overrides are honored over `min/max/step`.
  - Fallback to `min/max/step` when `search_*` absent (unchanged behavior for un-curated params).
  - `search_scale="log"` on a float → `LogFloatParam(low, high)`; `search_step` ignored.
  - `searchable=False` → param lands in `fixed_params`, not `strategy_params`
    (assert `risk_free_rate_annual`/`signal_lag_bars` are pinned for `hurst_trend_blend`).
  - Validator rejects `search_min >= search_max` and `log` with low `<= 0`.
- `q_backend/tests/optimization/test_exit_preset_search_space.py` (or existing file):
  exit-preset expansion still produces enable-param `low=0`, and `stop_loss_pct` magnitude
  comes through as `LogFloatParam`.
- `q_backend/tests/backtesting/test_param_bounds.py`: assert curated genome ranges
  (e.g. `threshold` within ±3.0, `period` 10–100 step 10).
- **Discovery exit bounds** (`tests/backtesting/test_exit_rule_policy.py` or
  `test_genome_search_space.py`): after `register_exit_param_bounds()`, assert
  `GENOME_PARAM_BOUNDS["exit_stop_loss_pct"].max == 0.05` (curated, not 0.50) and that
  `derive_genome_search_space` for a genome carrying the `fixed_stop_only` policy yields an
  `exit_stop_loss_pct` dimension with the tightened bounds (≤ ~15 grid points), enable-param
  still includes `0`/off.
- Spot-check exact curated values for two strategies (e.g. `rsi_mean_reversion`,
  `tsmom`) and the exit rules via the registry.

## Docs

- Update the `auto_search_space.py` module docstring (log-scale now inferred from metadata;
  search bounds vs editor bounds distinction).
- One-line note in `genome/param_bounds.py` header: bounds are search-tuned (coarse), not
  editor bounds.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does**.
- `pnpm -C q_frontend build` (or `pnpm tsc --noEmit`) passes for the type change.
- Paste-in-final-message contract: list every param whose effective search grid shrank,
  with old vs new grid-point count, **for BOTH paths** (optimization via `auto_search_space`
  and discovery via `GENOME_PARAM_BOUNDS["exit_*"]`), and confirm the manual editor bounds
  are byte-for-byte unchanged.

## Out of scope

- Indicator-output-relative genome threshold alignment / dead-genome repair — owned by the
  GA repair operator (see `ga-discovery-diagnosis`, WO46 family).
- Runtime grid-size cap / global backstop (explicitly declined).
- Merging the two `_search_param_from_spec` copies — deferred to a future cleanup.
- `exit_policy_seed_fraction` default (currently 0.25, so ~75% of seeded genomes carry no
  exit policy and trade stopless). Observed during the discovery audit; tuning exit
  _exploration_ is a separate behavior change, not a search-bound fix. Left for a follow-up.
- Position-sizing / risk search space (`default_risk_search_space`) — unchanged.
- Per-strategy objective/gate tuning — separate concern.
