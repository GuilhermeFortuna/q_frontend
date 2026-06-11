# WO18 — Backend: transaction cost model for the candle engine

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** this batch ("Academic Strategy Library") implements strategies
from published academic papers (trend following, time-series momentum, technical rules).
The literature is unanimous that transaction costs decide whether these edges survive —
e.g. Baltas & Kosowski (2017) report 105–163 bps/year of costs on futures trend following,
and Do & Faff (2011) show most pairs-trading profit vanishes under realistic frictions.
Today every candle backtest in this platform is **gross of costs**: `Trade.commission`
exists in the model and `TradeRegistry.close_trade` subtracts it from PnL, but **nothing
ever sets it**. This work order wires a configurable cost model in. It is a prerequisite
for honestly evaluating the strategies in WO19/WO20. This work order is **backend only**
(WO21 adds the frontend form fields).

---

## How the engine works today (read these files)

- `src/q_backend/backtesting/engine.py` — `BacktestEngine`. Signals are evaluated on
  closed bars and filled at the **next bar's open**. Entries: section C of
  `_run_single_chunk` (~line 207) builds the `Trade` (note `point_value` lookup). Exits:
  sections A/B/E call `registry.close_trade(t.id, timestamp, fill_price)`.
- `src/q_backend/backtesting/registry.py` — `close_trade` (~line 24) computes
  `pnl = (exit - entry) * quantity * point_value` (sign-flipped for shorts) and then
  subtracts `trade.commission`. **This subtraction already exists — reuse it, don't add a
  second one.**
- `src/q_backend/backtesting/models.py` — `Trade.commission: float = 0.0` (~line 77).
- `src/q_backend/api/main.py` — `BacktestRequest` (~line 156): `symbol`, `timeframe`,
  `initial_capital`, `point_value`, `strategy`, `strategy_params`, `position_sizing`,
  `engine`, day-trade fields. Find where the request constructs `BacktestEngine` and the
  config dict persisted with the run.
- `src/q_backend/optimization/` — the optimizer builds backtest configs too; find where it
  constructs `BacktestEngine` and thread the same cost params through, so optimized
  parameters aren't selected on gross PnL while single runs report net.

---

## Goal

A per-run cost configuration, applied per side (entry and exit each pay once):

```python
class TransactionCostConfig(BaseModel):
    cost_per_contract: float = Field(0.0, ge=0)   # currency units per contract per side
    cost_bps: float = Field(0.0, ge=0)            # basis points of notional per side
```

Side cost at price `p` for quantity `q` with point value `pv`:

```
side_cost = q * cost_per_contract + (cost_bps / 10_000) * p * q * pv
```

Both default to 0, so **existing runs and all existing tests are unchanged**.

## Tasks

### 1. Config model

Add `TransactionCostConfig` (above) in `src/q_backend/backtesting/position_sizing.py` or a
small new `costs.py` — your call, but it must be importable by both the API and the
optimizer without circular imports.

### 2. Engine wiring

- `BacktestEngine.__init__` gains `costs: Optional[TransactionCostConfig] = None`
  (None ⇒ zero costs). Thread it through `_run_day_trade_chunk`'s args tuple too — that
  tuple is pickled for multiprocessing, keep it a plain Pydantic model (picklable).
- **Entry** (section C, where the `Trade` is built): set
  `commission = side_cost(fill_price, order.quantity, point_val)` on the new `Trade`.
- **Exit**: before each `registry.close_trade(...)` call, add the exit side to the trade:
  `trade.commission += side_cost(exit_price, trade.quantity, trade.point_value)`. There are
  multiple close sites (force-close A, pending exits B, end-of-day E, end-of-chunk) —
  factor a small helper so every close path pays the exit side exactly once. Do NOT touch
  `close_trade` itself; it already subtracts `trade.commission` from PnL.
- Capital tracking: `current_capital += closed_trade.pnl` already picks up the net figure —
  verify, don't duplicate.

### 3. API wiring

- `BacktestRequest` gains `costs: Optional[TransactionCostConfig] = None`. Pass it to the
  engine; include it in the persisted run config dict so history reload reproduces it.
- This is **additive**: no existing request/response field changes shape.

### 4. Optimizer wiring

Thread `costs` from the optimization request's backtest config into every trial's engine,
the same way `position_sizing` flows today. A study with costs set must select parameters
on net PnL.

### 5. Metrics

In `TradeRegistry.get_performance_metrics`, add `total_commission` (sum over closed
trades) to the returned dict. Additive only — do not rename or reshape existing keys.

### 6. Tests

- A round trip with `cost_per_contract=5`, `quantity=2` reduces PnL by exactly 20
  (2 sides × 2 contracts × 5).
- `cost_bps` math: entry and exit sides computed at their respective fill prices.
- Zero/None config ⇒ byte-identical results to before (run an existing engine test
  scenario with and without `costs=None` and compare trades).
- Day-trade parallel mode pays costs (force-closed trades included).
- Optimizer trial engine receives the cost config (constructor spy or similar).

### 7. Docs

Update `q_backend/README.md`: the cost model formula, per-side semantics, defaults.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- In your final message, paste the exact `TransactionCostConfig` JSON shape and the
  `BacktestRequest` field name — WO21's frontend form builds against this contract.

## Out of scope

- The tick engine (it models the bid/ask spread natively; commission there is a later WO).
- Any frontend change (WO21).
- Slippage / market-impact models beyond the two-term formula above.
- Per-symbol cost tables (single config per run for now).
