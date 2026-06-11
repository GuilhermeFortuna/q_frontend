# WO19 — Backend: Lai–Lau technical rule strategies (VMA / FMA / TRB)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** this batch implements strategies from academic papers. This WO
codes the rule families from **Lai & Lau (2006), "The Profitability of the Simple Moving
Averages and Trading Range Breakout in the Asian Stock Markets"** (itself operationalizing
Brock, Lakonishok & LeBaron 1992). It was chosen because its rules are fully specified
from daily closes and map directly onto the platform's closed-bar / next-bar-open candle
engine. The platform already has close relatives — `MACrossoverStrategy` ≈ VMA,
`DonchianBreakoutStrategy` ≈ TRB — but the paper variants differ in specific, testable
ways (price-vs-MA rather than MA-vs-MA; close-based channels rather than high/low; a
**fixed 10-day holding period** for FMA/TRB). This work order is **backend only**; new
strategies auto-render in the frontend via the schema-driven strategy forms (WO5/WO6
registry), so no frontend change is required.

---

## How strategies work today (read these files)

- `src/q_backend/backtesting/strategy.py` — `TradingStrategy` ABC. **Read the execution
  contract docstring carefully**: strategies see only closed bars; the engine fills at the
  next bar's open; `compute_indicators` must be strictly causal (no `shift(-n)`, no
  whole-series stats). `tests/.../test_strategy_causality.py` enforces this automatically
  for every registered strategy — your new strategies are tested the moment they register.
- `src/q_backend/backtesting/strategies/donchian_breakout.py` — the **template to copy**:
  strategy class + `_build_*` factory + `register_strategy(...)` with `StrategyParamSpec`s.
  Note how `compute_indicators` precomputes boolean `buy_signal`/`sell_signal` columns and
  the row-level methods just read them.
- `src/q_backend/backtesting/strategies/__init__.py` — new modules MUST be imported here
  or they never register.
- `src/q_backend/backtesting/strategy_registry.py` — `StrategyParamSpec` supports
  `int`/`float`/`categorical`; categorical params become Optuna categorical dimensions in
  the optimizer for free.
- `src/q_backend/backtesting/moving_averages.py` — `compute_ma(series, period, ma_type)`;
  reuse it, don't reimplement SMA.
- `src/q_backend/backtesting/models.py` — `Trade` has `entry_time`; `check_exit_conditions`
  receives open trades, which is how the fixed holding period is implemented (no engine
  change needed).

---

## Goal

Three new registered candle strategies in `src/q_backend/backtesting/strategies/`:

### 1. `VMAStrategy` (`vma.py`) — Variable Moving Average

- Params: `period` (int, default 20, the paper's best; range 2–400), `band_pct`
  (float, default 0.0, range 0–5, the paper's optional 1% band), `ma_type`
  (categorical over the types in `moving_averages.py`, default `sma`).
- Rules (paper: short MA = the close itself, long MA = `period`-day MA):
  - BUY when `close` crosses **above** `ma * (1 + band_pct/100)`.
  - SELL when `close` crosses **below** `ma * (1 - band_pct/100)`.
  - "Variable" = position is held while the relation persists: a long is closed by the
    sell trigger and vice versa (same crossover-exit pattern as `MACrossoverStrategy`).
  - Inside the band: no signal, hold current state.
- The paper's "double-or-out" cash leg (parking in the risk-free asset on sells) is **not**
  modeled; going short on sell signals is this platform's standing convention. Note this
  deviation in the strategy docstring.

### 2. `FMAStrategy` (`fma.py`) — Fixed Moving Average

- Params: `period` (int, default 60, the paper's best FMA length), `band_pct` (as above),
  `ma_type` (as above), `holding_period` (int, default 10, range 1–60, trading **bars**).
- Same cross triggers as VMA, but execution differs:
  - On a trigger, enter and hold for exactly `holding_period` bars, **ignoring all
    intervening signals** (the paper's rule).
  - Exit via `check_exit_conditions`: emit CLOSE when at least `holding_period` bars have
    elapsed since the open trade's entry. Count **bars, not calendar days** — the paper
    uses trading days. Practical approach: in `compute_indicators`, add an integer
    bar-index column (`np.arange(len(df))`); in the strategy, map `entry_time` →
    bar index via the indexed frame, or track entry bar index on the instance keyed by
    trade id. Whichever you choose, it must survive the causality test and must not
    require engine changes.
  - While a position is open, suppress new entries (`check_entry_conditions` returns no
    signal if the strategy knows a trade is open — note the engine's per-symbol exposure
    cap via `PositionSizer.max_position_size` already prevents pyramiding past the cap;
    rely on that rather than strategy-side state if simpler).

### 3. `TRBStrategy` (`trb.py`) — Trading Range Breakout, close-based

- Params: `period` (int, default 60; the paper tests 3–240), `band_pct` (as above),
  `holding_period` (int, default 10).
- Rules (distinct from the existing Donchian strategy, which channels **high/low** and
  exits on the opposite breakout):
  - BUY when `close` > max of the **previous** `period` closes (excluding the current
    bar: `close.shift(1).rolling(period).max()`), beyond the band.
  - SELL when `close` < min of the previous `period` closes, beyond the band.
  - Fixed `holding_period`-bar exit, same mechanism as FMA.

### Shared requirements

- Factor the fixed-holding exit logic into one helper shared by FMA/TRB (a small mixin or
  module-level function) — do not duplicate it.
- Each strategy: chart indicators via `get_chart_indicators` (MA line / channel lines on
  the `price` pane), proper `register_strategy` metadata with paper-accurate defaults, and
  the registration import in `strategies/__init__.py`.
- Strategy docstrings must cite the paper and state every deviation from it (short side
  instead of cash leg; band as percent; bar-count holding).

## Tests

- Per strategy: a hand-built small OHLCV frame where the expected trigger bars are known;
  assert `buy_signal`/`sell_signal` land on exactly those bars.
- FMA/TRB: a trade opened at bar _i_ is closed by a CLOSE signal evaluated at bar
  `i + holding_period` (filled at `i + holding_period + 1`'s open — assert via an engine
  run, not just the signal), and intervening opposite triggers do NOT close it early.
- Band: a cross that stays inside the band produces no signal.
- TRB: current bar's close must be excluded from the channel (a new all-time-high bar must
  still be able to trigger).
- The existing causality test must pass with the new registrations (run the full suite).

## Docs

Update `q_backend/README.md` strategy list with the three new entries and one-line paper
citations.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- `GET /api/v1/strategies` returns the three new entries with their param schemas (start
  the server and paste the relevant JSON snippet in your final message).
- Final message also states: any deviation from the paper you made beyond the documented
  ones, and the registered strategy `name` strings (the frontend keys off them).

## Out of scope

- Engine or `TradingStrategy` interface changes — these strategies must fit the existing
  contract.
- The risk-free "double-or-out" cash leg.
- TSMOM / volatility sizing (WO20).
- Any frontend change (schema-driven forms render new strategies automatically).
