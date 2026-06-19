# WO43 — Backend: session / calendar + regime feature primitives (B3-aware)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "Feature Engine". WO42 established the five-seam path for adding
a feature primitive and made the GA operator pools **category-driven**. This WO adds two
economically-motivated families that need no new data: **session / calendar** features and
**regime** features. Intraday-session and seasonal effects are among the most persistent
retail-driven inefficiencies in the Brazilian market (B3); regime gates let a genome say "only
trade when the market looks like Y." Design: **`docs/design/feature-engine.md` §3b, §3c, §4**.

**Build on WO42's contract.** Every primitive here is added by touching the same five seams
(`node_specs.py`, `composite_strategy.py::_evaluate_node`, `param_bounds.py`, `validate.py`,
`operators.py` pools) and inherits WO42's category-driven reachability. Do not re-refactor the
operators — just tag the new kinds `generatable=True` in the right category.

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/genome/node_specs.py` — `NodeSpec` (now with `category`/`generatable`
  from WO42), `NODE_SPECS`. Output types `price_series | oscillator | bool_series | exit_policy`.
- `src/q_backend/backtesting/genome/composite_strategy.py` — `_evaluate_node` dispatch; the bar
  `DatetimeIndex` is `df.index` (naive-local timestamps — see `BacktestRunner` normalization). The
  index is the source of session/calendar values; reuse `compute_realized_vol` /
  `compute_yang_zhang` (from `technical_indicators.py`) and `compute_ma` for regime features.
- `src/q_backend/backtesting/genome/param_bounds.py` — `GENOME_PARAM_BOUNDS`.
- `src/q_backend/backtesting/genome/validate.py` — `validate_genome`; add a targeted check only for
  session-window bounds (`from < to`).
- `src/q_backend/optimization/backtest_runner.py` — `BacktestRunConfig` already carries
  `day_trade_start_time` / `day_trade_end_time` (`"09:00"` style). **Reuse this session convention**
  for defaults; do not invent a second session config.

---

## Goal

Genomes can express session gates ("inside the B3 morning"), intraday position, day-of-week, and
volatility/trend **regime** oscillators — all causal (the timestamp and rolling stats at bar _i_
use only bars ≤ _i_) — and the GA composes them via WO42's pools.

## Tasks

### 1. Session / calendar primitives (design §3b)

Add to `NODE_SPECS` (`category="feature"`, `generatable=True`):

| Kind                        | inputs | output port → type  | params                          |
| --------------------------- | ------ | ------------------- | ------------------------------- |
| `feature.minutes_from_open` | 0      | `out` → oscillator  | `session_open` (HH:MM, fixed)   |
| `feature.time_of_day`       | 0      | `out` → oscillator  | `session_open`, `session_close` |
| `feature.day_of_week`       | 0      | `out` → oscillator  | —                               |
| `feature.session_window`    | 0      | `out` → bool_series | `window_from`, `window_to`      |

- These are **leaf** nodes (0 inputs) reading `df.index`. `minutes_from_open` = minutes since the
  configured `session_open` on that bar's date (NaN/0 before open). `time_of_day` = normalized 0–1
  position within `[session_open, session_close]`. `day_of_week` = `df.index.dayofweek` (0–4).
  `feature.session_window` = boolean `True` when the bar time is within `[window_from, window_to]`
  (a **gate** you can `logic.and` with any entry signal).
- **Defaults are B3-aware** but config-driven: default `session_open="09:00"`, `session_close=
"18:00"` (or pull from `BacktestRunConfig.day_trade_*` if the strategy receives it). Session
  times are **fixed literals** in the genome (not Optuna dims) — they're structural, not tunable.

### 2. Regime primitives (design §3c)

Add to `NODE_SPECS` (`category="feature"`, `generatable=True`):

| Kind                   | inputs | input types    | output port → type | params                      |
| ---------------------- | ------ | -------------- | ------------------ | --------------------------- |
| `feature.vol_regime`   | 1      | `price_series` | `out` → oscillator | `window`, `regime_lookback` |
| `feature.trend_regime` | 1      | `price_series` | `out` → oscillator | `ma_period`                 |

- `feature.vol_regime` = rolling **percentile rank** of realized vol over `regime_lookback`
  (compute realized vol via `compute_realized_vol` on the input; then a causal rolling percentile,
  same primitive as WO42 `transform.rank`). Output in 0–1.
- `feature.trend_regime` = normalized slope / distance of price from its `ma_period` MA, scaled by
  recent vol (causal). Output centered near 0.

Add `regime_lookback` (int 20–500) and reuse `window` / `ma_period`-style specs in
`GENOME_PARAM_BOUNDS` (add `ma_period` if not already present — mirror `period` bounds).

### 3. Validation (validate.py)

Add one targeted rule: for `feature.session_window`, reject `window_from >= window_to` at parse
time (`GenomeValidationError`). Everything else is covered by WO42's type-closure once the
`NodeSpec`s are correct. Session/calendar leaf nodes (0 inputs, oscillator/bool output) wire like
`source.*` for the validator.

### 4. Operator reachability

Tag the new kinds in the right WO42 category so `_mutate_add_node` / `build_random_genome` /
`_mutate_swap_indicator` can draw them. A `feature.session_window` (bool leaf) should be reachable
as an operand for `logic.and` (so the GA can gate any signal by session); ensure the bool-producing
pool includes it.

## Guardrails

> **Causal by construction.** Calendar values come from the bar's own timestamp (known at bar _i_);
> regime stats are rolling with `min_periods`. No centered windows, no peeking at later bars.
> `CompositeStrategy` keeps passing `test_strategy_causality.py` including random genomes with the
> new kinds.

> **Disabled = identical.** A genome with none of these kinds is byte-identical to WO42. Additive
> only; existing tests untouched and green.

> **One session convention.** Reuse `BacktestRunConfig.day_trade_*` semantics for session bounds;
> do not introduce a parallel session config object. Session times are fixed genome literals, not
> Optuna dimensions.

> **Timezone discipline.** The index is naive-local (see `_to_naive_local` in `load_sliced_frame`);
> session math assumes local exchange time — assert this in a test with a known B3-hours fixture.

## Tests — `tests/.../test_feature_session_regime.py`

- **Session correctness:** on a fixture spanning two trading days at M5, `minutes_from_open` /
  `time_of_day` / `day_of_week` / `session_window` take the right values at the open, mid-session,
  and outside the window; `session_window` is a clean boolean gate.
- **Session-bound validation:** `window_from >= window_to` raises `GenomeValidationError`.
- **Regime correctness + causality:** `vol_regime` rises with injected volatility; prefix test
  (truncating future bars doesn't change past values) for both regime kinds.
- **Gate composition:** a genome `logic.and(entry_signal, feature.session_window)` only fires
  inside the window (signals outside are suppressed) — end-to-end through `compute_indicators`.
- **Reachability:** random genomes sample the new kinds (WO42 pattern).
- Existing causality/genome/optimization/walk-forward tests green and unmodified.

## Docs

`q_backend/README.md`: extend the feature-primitives note with the session/calendar + regime
families and the B3-session default; link the design doc.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Existing tests untouched and green; additive only.
- In your final message, paste the new `NodeSpec` rows, their `GENOME_PARAM_BOUNDS` entries, and
  one example genome that gates an MA-cross entry by `feature.session_window` (the B3 morning).

## Out of scope

- Exogenous/cross-asset primitives + data plumbing (WO44).
- Feature discovery / IC validation (WO45); GA seeding + diversity (WO46).
- Making session bounds Optuna-tunable (they stay structural literals).
- Any frontend (WO47).
