# WO13 — Backend: tick engine core (TickStrategy, intrabar kernel, TickBacktestEngine)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** we are adding a **separate tick-data backtest engine** alongside
the existing candle engine. The candle engine fills every signal at the _next bar's open_ and
cannot resolve intrabar events. The tick engine simulates fills at true MT5 tick resolution
with a real intrabar order system (stop-loss / take-profit / opposite-signal exits) using
**ask for buys and bid for sells**, so spread cost is modeled.

**WO12 (prerequisite, already done) shipped:**

- `MarketDataService.get_ticks_columnar(symbol, start, end, flags) -> dict[str, np.ndarray]`
  returning aligned arrays `time_msc` (int64 ms), `bid`, `ask`, `last`, `volume` (float64),
  `flags` (int32), sorted ascending by `time_msc`. (Use WO12's completion message for the
  exact contract.)
- A **Numba verdict** in `q_backend/docs/tick-engine-deps.md`: either _Numba viable @ versions
  X/Y_ or _not viable → pure-NumPy fallback_. **Read that file first** — it decides how you
  write the kernel (task 3).

This work order is the engine itself. It is **backend only.** No API endpoint and no frontend
work (WO14/WO15). Performance is the point: 1–4M ticks/month must process without per-tick
Python object allocation.

---

## How the candle engine works today (read these files — mirror its philosophy)

- `src/q_backend/backtesting/engine.py` — `BacktestEngine`. Note two things to **carry over**:
  - **Vectorize-then-iterate**: indicators + boolean signal columns are precomputed
    vectorized (`compute_indicators`), and the loop only reads precomputed values. The tick
    engine pushes this further: the strategy emits **signal arrays**, and only the kernel
    iterates.
  - `ParallelMode.DAY_TRADE` (~line 70): groups by `data.index.date` and fans chunks across a
    `ProcessPoolExecutor`, merging `TradeRegistry` results. **Reuse this exact pattern** — day
    chunking matters even more for ticks. `_run_day_trade_chunk` (~line 18) is a top-level
    function because instance methods don't pickle cleanly; follow that.
- `src/q_backend/backtesting/strategy.py` — `TradingStrategy` ABC and its **execution
  contract** docstring (causality rules: a value at index `i` may only depend on `<= i`; no
  `shift(-n)`, centered windows, or whole-series stats). `ChartIndicatorSpec` (~line 25) —
  **reuse this class** for chart metadata. `TickStrategy` mirrors these causality rules.
- `src/q_backend/backtesting/models.py` — `Trade`, `Order`, `OrderAction`, `SignalAction`,
  `TradeStatus`. The kernel does NOT build these per tick; **post-processing** builds one
  `Trade` per _closed trade_ (N trades, not N ticks).
- `src/q_backend/backtesting/registry.py` — `TradeRegistry`: `register_trade`, `close_trade`,
  `get_closed_trades`, `get_performance_metrics`, `merge`. The tick engine returns a populated
  `TradeRegistry` so all downstream metrics/persistence are unchanged.
- `src/q_backend/backtesting/position_sizing.py` — two sizing modes:
  - `fixed_quantity` → constant `quantity`.
  - `fixed_safety_margin` → `contracts = floor(capital / safety_margin_per_contract)`, clamped
    to `[min_contracts, max_contracts]`.
    Both reduce to **scalars** the kernel can evaluate from running capital. `max_position_size`
    is the per-symbol exposure cap. `build_position_sizer` (~line 194) builds the candle sizer.
- `src/q_backend/backtesting/strategy_registry.py` — `register_strategy`,
  `RegisteredStrategy`, `StrategyInfo`/`StrategyParamSpec`, `merge_strategy_params`. Types are
  currently bound to `TradingStrategy`; you will generalize them (task 5).
- `src/q_backend/backtesting/factory.py` — `build_strategy(name, params, symbol)`. You add a
  tick analogue.
- `tests/.../test_strategy_causality.py` — the guardrail that auto-checks every registered
  strategy for look-ahead. You will write the tick analogue.

---

## Goal

A `TickBacktestEngine` that takes columnar tick arrays + a `TickStrategy` + sizing config,
runs an intrabar fill simulation in a compiled (or candidate-reduced) hot loop, and returns a
populated `TradeRegistry` — fast enough for millions of ticks. Plus one first-party tick
strategy and the registry plumbing so it surfaces through the existing schema endpoint.

All new code lives under `src/q_backend/backtesting/tick/`.

## Tasks

### 1. `tick/strategy.py` — `TickStrategy` ABC + array containers

```python
@dataclass
class TickArrays:
    time_msc: np.ndarray   # int64 ms
    bid: np.ndarray        # float64
    ask: np.ndarray        # float64
    last: np.ndarray       # float64
    volume: np.ndarray     # float64
    # length N, ascending time_msc — exactly WO12's get_ticks_columnar output

@dataclass
class TickSignals:
    direction: np.ndarray   # int8[N]: +1 long entry intent, -1 short, 0 none
    sl_points: np.ndarray   # float64[N]: stop distance in price units (NaN = no SL)
    tp_points: np.ndarray   # float64[N]: take-profit distance (NaN = no TP)
    # extend later for trailing; keep NaN = "not set"

class TickStrategy(ABC):
    def __init__(self, **kwargs): self.parameters = kwargs
    @abstractmethod
    def compute_signals(self, ticks: TickArrays) -> TickSignals: ...
    @abstractmethod
    def get_chart_indicators(self) -> list[ChartIndicatorSpec]: ...
    # optional: compute_indicator_series(ticks) -> dict[str, np.ndarray] for the chart
```

- Document the **causality contract** in the docstring, copied/adapted from `TradingStrategy`:
  `compute_signals` must be strictly causal and fully vectorized — index `i` depends only on
  `<= i`. **No per-tick Python callback** is part of the interface (that's the whole point).
- Indicators are **tick-native** (rolling over N ticks or over a time window via `time_msc`),
  computed with NumPy. Define clearly in the docstring what a "period" means for ticks
  (e.g. N ticks vs N milliseconds) so strategy authors aren't guessing.

### 2. `tick/orders.py` — exit reasons + sizing reduction

- `class ExitReason(IntEnum): STOP_LOSS=1; TAKE_PROFIT=2; SIGNAL=3; END_OF_DAY=4` — integer
  codes the kernel can write into an array.
- A helper that reduces a `PositionSizingConfig` to the scalars the kernel needs
  (`fixed_quantity`: just `quantity`; `fixed_safety_margin`: `margin`, `min`, `max`). The
  kernel computes contracts from **running capital** at entry (compounding requires it be
  inside the loop). Keep this as plain scalars/ints — nothing Pydantic crosses into the kernel.

### 3. `tick/kernel.py` — the intrabar hot loop

Pure-function-over-arrays. **Implementation depends on WO12's Numba verdict:**

- **Numba viable:** decorate with `@njit(cache=True)`, operate only on NumPy scalars/arrays
  inside (no Python objects, no Pydantic, no dict).
- **Not viable:** plain Python loop over arrays, but **candidate-reduced** — precompute (with
  NumPy) the indices where `direction != 0` so entries are O(candidates) not O(N), and keep
  the per-tick exit check tight.

Keep the kernel behind one function signature so the two implementations are interchangeable:

```python
def simulate(
    bid, ask, direction, sl_points, tp_points,   # arrays, length N
    initial_capital, point_value,
    sizing_mode, sizing_a, sizing_b, sizing_c,    # scalars from tick/orders.py
) -> tuple[np.ndarray, ...]:
    """Single position at a time. Returns parallel arrays, one entry per CLOSED trade:
       entry_idx[], exit_idx[], entry_price[], exit_price[],
       direction[](+1/-1), quantity[], exit_reason[](ExitReason code)."""
```

Semantics (the accuracy core — get these exact):

- **Flat + `direction[i] != 0`** → open. Long fills at `ask[i]`, short at `bid[i]`. Size from
  running capital. `sl_price`/`tp_price` from the entry params (NaN → that exit disabled).
  Record `entry_idx=i`.
- **In a position**, each subsequent tick `i`:
  - Exit a **long** by selling at `bid[i]`; exit a **short** by buying at `ask[i]`.
  - Triggers, checked in priority **SL → TP → opposite signal**:
    - long: SL if `bid[i] <= sl_price`; TP if `bid[i] >= tp_price`.
    - short: SL if `ask[i] >= sl_price`; TP if `ask[i] <= tp_price`.
    - opposite signal: `direction[i]` is opposite the open position.
  - On exit: record the closed trade, update running capital by realized PnL
    (`(exit-entry) * qty * point_value`, sign by direction), go flat. **Re-entry on the same
    tick is not allowed** (next tick earliest) to avoid same-tick churn.
- **End of array**: force-close any open position at the last tick (long→bid, short→ask),
  `exit_reason = END_OF_DAY`. (Per-day chunking in the engine makes this the day's close.)

> **GUARDRAIL — bid/ask discipline is the whole accuracy story.** Buys/long-entries and
> short-covers pay the **ask**; sells/long-exits and short-entries receive the **bid**. Never
> fill both sides at the same price (that silently deletes the spread, the main thing ticks
> buy us). A unit test must assert a round-trip with a non-zero spread loses the spread.

### 4. `tick/engine.py` — `TickBacktestEngine`

- `__init__(self, strategy: TickStrategy, sizing_config, initial_capital, point_value)`.
- `run(self, ticks: TickArrays, parallel_mode=ParallelMode.DAY_TRADE) -> TradeRegistry`:
  - `DAY_TRADE`: split tick arrays by calendar day (derive day from `time_msc`), fan chunks
    across `ProcessPoolExecutor` via a **top-level** chunk-runner fn (mirror
    `_run_day_trade_chunk`), merge registries. `SEQUENTIAL`: one chunk.
  - Per chunk: `signals = strategy.compute_signals(chunk)` → `simulate(...)` → **post-process
    the trade-event arrays into `Trade` models** (one per closed trade) and
    `registry.register_trade` / `close_trade`. This is the only place Python objects are
    created, and it's O(trades) not O(ticks).
  - Reuse `ParallelMode` from `engine.py` (import it; don't redefine).

> **GUARDRAIL — no per-tick objects.** The only Python/Pydantic objects created are `Trade`s,
> one per closed trade. If a reviewer finds object allocation inside the per-tick loop, it's
> wrong. The chunk passed to a worker must be NumPy arrays, not a DataFrame of Pydantic rows.

### 5. Registry generalization + tick factory + first strategy

- `strategy_registry.py`: generalize so tick strategies register and surface via the existing
  `StrategyInfo`/`StrategyParamSpec` schema (the frontend forms in WO15 render from this with
  no rewrite). Choose the lower-churn option:
  - widen the `strategy_class` / `build` type bounds to `TradingStrategy | TickStrategy`
    (introduce a shared marker base or a `Union` type alias), **and**
  - add an `engine: Literal["candle","tick"]` field to `RegisteredStrategy`/`StrategyInfo` so
    `GET /api/v1/strategies` (WO14 consumes it) can tell clients which engine a strategy is
    for. Default existing registrations to `"candle"`.
- `tick/factory.py`: `build_tick_strategy(name, params, symbol)` mirroring
  `factory.build_strategy`, using `merge_strategy_params`.
- `tick/strategies/__init__.py` + one first-party strategy, e.g.
  `tick_ma_breakout.py`: a tick-native MA/threshold breakout that emits `direction` plus
  `sl_points`/`tp_points` from its params. Register it (`engine="tick"`) with a
  `StrategyParamSpec` list (periods, threshold, sl, tp) so it appears in the schema endpoint.
  Import the package for side-effect registration the way `backtesting/strategies/__init__.py`
  is imported in `factory.py`.

### 6. Tests

- **Kernel correctness** (`tests/.../tick/test_kernel.py`): hand-built tiny tick arrays:
  - SL-first vs TP-first when both lie within the same span — exact `exit_reason` + price.
  - Long entry pays ask, exit receives bid; short mirror; **round-trip with spread loses the
    spread** (the guardrail).
  - Opposite-signal exit; end-of-array force close.
  - `fixed_quantity` and `fixed_safety_margin` sizing produce expected contract counts and
    PnL; compounding updates capital between trades.
- **Causality guardrail** (`tests/.../tick/test_tick_strategy_causality.py`): mirror
  `test_strategy_causality.py` — feed each **registered tick strategy** ticks, perturb future
  ticks, assert `compute_signals` output for index `i` is unchanged (no look-ahead).
- **Engine integration**: a small synthetic tick stream end-to-end → populated
  `TradeRegistry`; `DAY_TRADE` vs `SEQUENTIAL` produce consistent per-day results.
- **Parity sanity**: a strategy with no SL/TP on coarse synthetic ticks lands close to the
  candle engine's trades on the equivalent bars (loose tolerance — spread/fill timing differ
  by design).

### 7. Docs

Update `q_backend/README.md`: a "Tick engine" section — the `TickStrategy` contract, the
intrabar fill model (bid/ask rules, SL→TP→signal priority), and how to register a tick
strategy.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- In your final message, paste **the contracts WO14 builds against**:
  1. The final `TickStrategy` ABC + `TickArrays` / `TickSignals` dataclass fields.
  2. The `simulate(...)` signature and the **trade-event array contract** (the parallel output
     arrays + `ExitReason` codes).
  3. `TickBacktestEngine.run(...)` signature and the registered name + `StrategyParamSpec` of
     the first-party tick strategy.
  4. Whether the kernel used Numba `@njit` or the pure-NumPy fallback (per WO12's verdict).

## Out of scope

- Any API endpoint / request-response change — WO14 wires `TickBacktestEngine` into
  `/api/v1/backtest/run`.
- Bar resampling for charts (WO14).
- Any frontend change (WO15).
- The optimization tick runner (WO16).
- Pyramiding / multiple simultaneous positions, trailing stops, limit/stop _entry_ orders —
  the kernel is single-position market-entry + SL/TP/signal exit for now. Leave clean
  extension points (NaN-disabled param slots) but don't build them.
