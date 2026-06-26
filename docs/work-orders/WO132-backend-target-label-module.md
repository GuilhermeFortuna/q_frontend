# WO132 — Backend: Target / label definition module

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/feature-intelligence.md` **§2 (target / label definition)**. This opens **Phase 2**.
No dependency on WO127–131 except it reuses bar frames; WO133 (metrics) depends on this.

**Principle:** IC / Rank IC / MI are meaningless without a defined label. Targets are their own module
— the single source of truth for _what every metric is measured against_, and the home of the only
intentionally forward-looking computations in the system (the embargo derives from a target's
horizon).

## How the pieces work today (read these files)

- `src/q_backend/market_data/local_store.py::read_ohlcv` + `_bars_to_dataframe` — bar frame shape
  (`time/open/high/low/close/volume`).
- `src/q_backend/backtesting/technical_indicators.py::compute_realized_vol` — reuse for the
  vol-adjusted target denominator (don't re-implement vol).
- `src/q_backend/features/compute.py` (WO128) — note the **contrast**: features are causal
  (`forward_window == 0`); targets here are the _only_ place `.shift(-horizon)` is legal.

## Goal

```python
# src/q_backend/features/targets.py
@dataclass(frozen=True)
class TargetSpec:
    name: str          # "fwd_return", "fwd_log_return", "fwd_vol_adj_return", "fwd_direction"
    horizon: int       # bars ahead
    kind: str          # "regression" | "classification"

def compute_target(bars: pd.DataFrame, spec: TargetSpec) -> pd.Series: ...
def list_target_specs(horizons: list[int]) -> list[TargetSpec]: ...
def embargo_bars(spec: TargetSpec) -> int: ...   # == spec.horizon
```

## Tasks

### 1. Target family — `targets.py`

- `fwd_return(h)`: `close.shift(-h) / close - 1`.
- `fwd_log_return(h)`: `log(close.shift(-h) / close)`.
- `fwd_vol_adj_return(h)`: `fwd_return(h) / compute_realized_vol(...)` (causal vol at `t`, so the
  denominator is PIT-safe; only the numerator looks forward).
- `fwd_direction(h)`: `sign(fwd_return(h))` as `{-1, 0, 1}` (classification, for MI).
- The **last `horizon` rows are NaN** (no future to look at) — never fill them. `compute_target`
  returns the series time-indexed with that trailing NaN tail.

### 2. Embargo

`embargo_bars(spec) == spec.horizon`. Document (and let WO133 use it) that when splitting a series
into train/test, the last `embargo_bars` of train and the first `embargo_bars` of test must be
**dropped** so a label built from future bars cannot straddle the boundary. Provide a helper
`purge_embargo(index, split_point, embargo) -> (train_idx, test_idx)`.

### 3. Alignment helper

`align_feature_target(feature: pd.Series, target: pd.Series) -> tuple[pd.Series, pd.Series]`: inner-join
on time, drop rows where either is NaN (feature warm-up head + target horizon tail). This is the one
join WO133's metrics use, so feature(`t`) is always matched to target(`t`) — no off-by-one.

## Guardrails

> **Targets are the only forward-looking code.** `.shift(-h)` lives here and nowhere else. A feature
> that needs the future is a modeling error, not a feature.
> **Trailing NaN is sacred.** The last `horizon` rows have no label — never impute them.
> **Embargo is derived, not configured.** It equals the horizon; the train/test purge uses it so
> evaluation can't leak a future label across a split.

## Tests

- `tests/features/test_targets.py`:
  - `fwd_return(h)` at `t` equals `close[t+h]/close[t]-1`; the last `h` rows are NaN.
  - `fwd_direction` is in `{-1,0,1}`.
  - `purge_embargo` removes exactly `embargo` rows on each side of the split; no row appears in both
    train and test.
  - `align_feature_target` drops the feature warm-up head and the target horizon tail and returns
    equal-length, same-index series.

## Docs

- `docs/design/feature-intelligence.md`: tick §2 implemented; list the target family + horizons.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the target family list and confirmation `purge_embargo` prevents
  train/test label overlap for a sample horizon.

## Out of scope

- The metrics themselves (IC/MI/stability) — **WO133**.
- Any feature computation — that's WO128; this module only labels.
