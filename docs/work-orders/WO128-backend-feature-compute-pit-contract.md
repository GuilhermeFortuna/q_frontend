# WO128 — Backend: PIT-safe feature computation service + leakage contract

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/feature-intelligence.md` **§1 (PIT / leakage contract)** — this WO _is_ that
contract in code. Depends on **WO127** (`FeatureSpec`/registry). WO129 (matrix) depends on this.

**Principle:** one entry point computes a named feature into a causal series on bars, and the
point-in-time invariant (value at `t` uses bars `≤ t` only) is enforced and tested here, once, for
everything downstream.

## How the pieces work today (read these files)

- `src/q_backend/features/registry.py` (WO127) — `FeatureSpec`, `get_feature_spec`, `resolve_params`,
  `feature_id`, `spec.node_kind`, `spec.lookback_param`.
- `src/q_backend/backtesting/genome/composite_strategy.py::_evaluate_node` — the canonical mapping
  from a node kind + resolved params to its compute call. **Mirror its dispatch exactly so a feature
  series is bit-identical to what a backtest computes** (e.g. `ind.rsi` → `compute_rsi(close,
period)`, `ind.atr` → `compute_atr(high, low, close, period)`).
- `src/q_backend/backtesting/technical_indicators.py`, `backtesting/moving_averages.py` — the leaf
  functions called there.
- `src/q_backend/market_data/local_store.py::read_ohlcv(symbol, timeframe, start, end)` — returns a
  list of `OHLCV`; `_bars_to_dataframe` shows the column shape (`time/open/high/low/close/volume`).
  **This is how callers get bars; the compute service takes a DataFrame, never reads bars itself.**

## Goal

```python
# src/q_backend/features/compute.py
@dataclass(frozen=True)
class FeatureSeries:
    feature_id: str
    series: pd.Series          # indexed by bar time; NaN over warm-up
    warmup_bars: int           # leading bars that are not yet valid
    leakage_status: str

def compute_feature(
    bars: pd.DataFrame,        # time/open/high/low/close/volume, time-sorted ascending
    spec: FeatureSpec,
    params: dict[str, Any],
) -> FeatureSeries: ...
```

## Tasks

### 1. `compute.py` dispatch mirroring `_evaluate_node`

- Validate `bars` is time-sorted ascending and has the OHLCV columns (raise `ValueError` otherwise).
- `resolve_params(spec, params)`, then dispatch on `spec.node_kind` to the same leaf call
  `_evaluate_node` uses. Factor the dispatch so it is obviously the _same_ computation (a small
  `_COMPUTE_BY_KIND` table is fine) — do not re-derive indicator math.
- Return the series indexed by `bars["time"]`.

### 2. Warm-up trimming (PIT enforcement)

- Compute `warmup_bars` from `spec.lookback_param` (e.g. `period`), defaulting to the largest window
  param when several exist. Set the first `warmup_bars` values to `NaN` (they depend on an incomplete
  window) so no downstream consumer treats a half-warmed value as valid.
- **Causality assertion (the core test, see Task 4):** value at index `t` must not change when bars
  **after** `t` are removed.

### 3. Leakage guard helpers — `src/q_backend/features/leakage.py`

- `assert_causal(compute_fn, bars, *, sample_indices) -> None`: for each sampled `t`, compute the
  series on `bars[:t+1]` and on the full `bars`, and assert the value at `t` is equal (within
  float tolerance) across both. Raise `LeakageError` with the offending index on mismatch.
- `FORWARD_LOOKING_KINDS: frozenset[str]` (empty for v1 — documents the hook). If a spec's `node_kind`
  is in it, `compute_feature` stamps `leakage_status="suspect"` regardless of the registry value.
- This is the reusable check WO133's evaluation and the WO130 ingestion both call.

### 4. Determinism + causality are tested invariants

- Same bars + spec + params → identical series (no RNG, no wall-clock, no `.shift(negative)`,
  no `bfill`).

## Guardrails

> **PIT is non-negotiable.** No `.shift(-n)`, no `bfill`/`ffill` from future rows, no centered rolling
> windows. Warm-up is NaN, not interpolated. The causality assertion gates the test suite.
> **Bit-parity with backtest.** A feature series must equal the column `compute_indicators` would
> produce for the same primitive + params. If you can't make them equal, stop and flag it — do not
> ship a second, divergent implementation of an indicator.
> **No I/O.** The service takes a DataFrame in and returns a series; it never reads bars, never
> touches the DB or lake.

## Tests

- `tests/features/test_compute.py`:
  - `compute_feature` for `rsi`, `atr`, `realized_vol`, `ma` produces the expected shape; warm-up
    region is NaN of the right length.
  - **bit-parity:** for a small bar frame, the computed series equals the matching `g_<node>` column
    from `composite_strategy.compute_indicators` (build a one-node genome, compare).
- `tests/features/test_leakage.py`:
  - `assert_causal` passes for every v1 spec on random-walk bars.
  - a deliberately leaky compute (`close.shift(-1)`) makes `assert_causal` raise `LeakageError` at the
    expected index.

## Docs

- `docs/design/feature-intelligence.md`: tick §1 contract implemented.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: confirmation the bit-parity test against `compute_indicators` passes for at
  least `rsi` + `atr`, and that `assert_causal` rejects the injected leaky feature.

## Out of scope

- Multi-feature matrices + caching — **WO129**. Targets/labels — **WO132** (forward windows live
  there, never here).
