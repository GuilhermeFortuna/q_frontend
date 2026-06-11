# WO20 — Backend: per-instrument TSMOM strategy + inverse-volatility sizer + Yang–Zhang estimator

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** this batch implements strategies from academic papers. This WO
adapts **time-series momentum (TSMOM)** — Moskowitz, Ooi & Pedersen (2012) and the SIGN
rule from Baltas & Kosowski (2017) — to this platform. The papers trade ~50 futures
markets simultaneously with inverse-volatility weights; this engine is **single-symbol per
run**, so we implement the **per-instrument** core: sign-of-past-return signal plus
volatility-scaled position sizing. Expect lower Sharpe than published (the papers' results
lean heavily on cross-market diversification) — that is understood and fine; the per-asset
signal and the vol-targeting sizer are independently valuable. A multi-asset portfolio
engine is a possible later phase, NOT this WO. This work order is **backend only** (WO21
adds the sizer's frontend form).

Three deliverables: a Yang–Zhang OHLC volatility estimator, a `TSMOMStrategy`, and an
`InverseVolatilitySizer`. The sizer requires a small, additive engine-interface change
(detailed below) — it is the only engine touch in this WO.

---

## How things work today (read these files)

- `src/q_backend/backtesting/strategy.py` — `TradingStrategy` ABC + execution contract
  (closed bars, next-open fills, strict causality; `test_strategy_causality.py` enforces).
- `src/q_backend/backtesting/strategies/donchian_breakout.py` — registration template
  (class + `_build_*` + `register_strategy`). New modules must be imported in
  `strategies/__init__.py` to register.
- `src/q_backend/backtesting/position_sizing.py` — `PositionSizer` ABC
  (`size_signal(signal, current_price, current_capital)`, `max_position_size`), the two
  existing sizers, the `PositionSizingConfig` discriminated union, and
  `build_position_sizer`. **The union + builder is what you extend.**
- `src/q_backend/backtesting/engine.py` — `_run_single_chunk` section C (~line 207) calls
  `self.sizer.size_signal(sig, fill_price, current_capital)`. Note `current_data` (the
  fill bar) is in scope there — that's where the new optional argument comes from.
- `src/q_backend/backtesting/technical_indicators.py` — where `compute_yang_zhang` goes
  (existing style: plain functions over pandas Series).
- `src/q_backend/api/main.py` — `BacktestRequest.position_sizing: Optional[PositionSizingConfig]`
  flows to `build_position_sizer`; nothing else should need touching there.

---

## Tasks

### 1. Yang–Zhang volatility estimator (`technical_indicators.py`)

```python
def compute_yang_zhang(
    open_: pd.Series, high: pd.Series, low: pd.Series, close: pd.Series,
    window: int, periods_per_year: int = 252,
) -> pd.Series:
    """Rolling annualized Yang–Zhang (2000) volatility. Causal: value at bar i
    uses bars <= i only."""
```

Standard formulation: σ²_YZ = σ²_overnight + k·σ²_open-to-close + (1−k)·σ²_RS with
k = 0.34 / (1.34 + (window+1)/(window−1)), Rogers–Satchell for σ²_RS. Annualize by
`sqrt(periods_per_year)`. Rolling means/variances only — no full-series statistics
(causality test). First `window` bars are NaN.

Also add a close-to-close fallback:

```python
def compute_realized_vol(close: pd.Series, window: int, periods_per_year: int = 252) -> pd.Series
```

(rolling std of log returns, annualized).

### 2. `TSMOMStrategy` (`strategies/tsmom.py`)

- Params:
  - `lookback_bars` (int, default 252 ≈ 12 months of D1, range 20–1000),
  - `rebalance_bars` (int, default 21 ≈ monthly, range 1–252) — signal is only acted on
    every `rebalance_bars` bars, matching the papers' month-end evaluation,
  - `vol_window` (int, default 63), `vol_estimator` (categorical: `yang_zhang`,
    `close_to_close`; default `yang_zhang`, falling back to close-to-close when the frame
    lacks `open`/`high`/`low`).
- `compute_indicators`:
  - `momentum = close / close.shift(lookback_bars) - 1` (the papers use excess returns
    over the risk-free rate; with no rate series in this platform, raw return is the
    documented approximation),
  - `volatility` column from the chosen estimator (this column name is the **contract
    with the sizer** — see task 3),
  - a rebalance-bar marker (`bar_index % rebalance_bars == 0`, with bar index from
    `np.arange(len(df))`),
  - `buy_signal` on rebalance bars where momentum > 0 and the prior evaluated sign was
    ≤ 0 (or no position); `sell_signal` symmetric. Precompute desired-direction per
    rebalance point vectorially, then derive flip points.
- Entry/exit behavior: hold the position between rebalances; on a sign flip at a
  rebalance bar, `check_exit_conditions` closes the open trade and
  `check_entry_conditions` opens the opposite direction (the engine already executes
  queued exits before entries at the same fill bar, so a flip is exit+entry at the same
  next-open — verify in engine section B/C and rely on it).
- Chart indicators: `momentum` on the `oscillator` pane, `volatility` on the `oscillator`
  pane (or a second key on price if you find it clearer; oscillator is the expectation).
- Docstring cites MOP 2012 / Baltas–Kosowski 2017 and lists the deviations (single
  instrument, raw instead of excess returns, bar-count rebalancing).
- Register with `register_strategy` and import in `strategies/__init__.py`.

### 3. `InverseVolatilitySizer` (`position_sizing.py` + one engine line)

The sizer needs the signal bar's volatility, which the current
`size_signal(signal, current_price, current_capital)` interface cannot see. Make the
smallest additive change:

- `PositionSizer.size_signal` gains `current_data: Optional[pd.Series] = None` as a
  keyword argument (default None). Update the ABC, both existing sizers (they ignore it),
  and the single call site in `engine.py` section C to pass the fill bar's row. This is
  backward-compatible for any out-of-tree subclass that accepts `**kwargs`; in-tree there
  are exactly three sizers — update them all.
- New config + sizer:

```python
class InverseVolatilityPositionSizing(BaseModel):
    type: Literal["inverse_volatility"] = "inverse_volatility"
    target_volatility_pct: float = Field(default=10.0, gt=0)   # annualized, percent
    max_contracts: Optional[int] = Field(default=None, ge=1)
    min_contracts: int = Field(default=0, ge=0)
```

Sizing rule (per the papers' vol-targeting): with annualized vol `v` read from
`current_data["volatility"]`,

```
contracts = floor((target_vol/100) * current_capital / (v * price * point_value))
```

clamped to `[min_contracts, max_contracts]`. The sizer does not know `point_value`
today — `BacktestEngine` holds `point_values` and the `Trade` gets it after sizing.
Resolve this the lightweight way: give the sizer constructor an optional
`point_value: float = 1.0` and have the API/engine wiring pass `request.point_value`
into `build_position_sizer` (check how `build_position_sizer` is invoked in
`api/main.py` and the optimizer; add the argument there). Do NOT restructure the
engine's point-value handling.

- If `current_data` is None or `volatility` is NaN/missing/zero: return None (no trade)
  and document it. Never divide by zero, never size on garbage.
- `max_position_size` returns the same formula's result (the cap the engine enforces),
  or `max_contracts` when volatility is unavailable.
- Extend the `PositionSizingConfig` union and `build_position_sizer`.

### 4. Tests

- Yang–Zhang: deterministic synthetic OHLC where overnight and intraday variance are
  controlled; assert against a hand/NumPy-computed reference; constant-price series → 0;
  causality (value at i unchanged when future bars are mutated).
- TSMOM: synthetic trending series → long after lookback warmup, flips on a constructed
  reversal at the next rebalance bar (not mid-cycle); no signals during warmup NaNs.
- Sizer: known vol/capital/price/point_value → exact contract count; vol missing → no
  order; clamps respected; existing sizers still pass with the new kwarg.
- Engine integration: full `BacktestEngine.run` with TSMOM + inverse-vol sizer on
  synthetic data produces trades whose quantities match the volatility column at their
  signal bars.

### 5. Docs

`q_backend/README.md`: new strategy entry, new sizer with its formula, the
`volatility`-column contract between strategy and sizer (any strategy exposing an
annualized `volatility` indicator column can use the sizer; without it the sizer stands
down).

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- In your final message, paste:
  1. The `InverseVolatilityPositionSizing` JSON shape (WO21's frontend form builds
     against it).
  2. The registered TSMOM strategy `name` string and its param schema from
     `GET /api/v1/strategies`.
  3. The exact new `size_signal` signature.

## Out of scope

- Multi-asset / portfolio backtests, cross-sectional ranking (Miffre), portfolio-level
  vol targeting across symbols — later phase, if ever.
- The Baltas TREND (t-statistic) signal variant — natural follow-up, not now.
- Risk-free / excess-return data plumbing.
- Any frontend change (WO21).
- Transaction costs (WO18 — independent; do not block on it).
