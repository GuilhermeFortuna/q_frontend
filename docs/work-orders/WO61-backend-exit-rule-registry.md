# WO61 — Backend: composable exit-rule registry (foundation + legacy migration)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "Specialized exits". The Strategy-page workbench exposes only six
exit knobs (fixed % SL/TP, ATR SL/TP, trailing %) because the entire exit system is a single
monolithic `ExitStrategy` class hard-wired in **three** places: `factory.py` copies the six keys by
hand, `strategy_registry.register_strategy` merges the six params into every candle strategy, and
`engine.py` has a hard-coded ATR-precompute block (`engine.py:134–144`) that reaches into
`exit_strategy.stop_loss_atr` / `take_profit_atr`. Adding "more specialized" exits today means
editing all three plus a string-heuristic UI.

This WO is the **foundation**: refactor the monolith into a **registry of self-describing exit-rule
modules**, migrating the existing five behaviors with **byte-identical** results. The specialized
new rules ride on this protocol — **WO62** (Chandelier, Break-even, Parabolic SAR) and **WO63**
(Profit-target ratchet, Time stop, Donchian). The generic workbench is **WO64**. This WO must NOT
add new exit behaviors or touch the frontend.

**Hard constraints:** full-position exits only (rules emit a full `CLOSE`, never partial); the param
storage stays a **flat dict** so saved strategies, the optimizer search-space, and the genome system
see only new _optional_ params (all default 0/disabled).

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/exit_strategy.py`
  - `ExitStrategy.__init__(stop_loss_pct, take_profit_pct, trailing_stop_pct, stop_loss_atr,
take_profit_atr, atr_period)` — flat scalar fields; `_extreme_prices: dict[trade_id, float]`
    peak/trough tracking.
  - `update_extreme_prices(open_trades, current_data)` — maintains per-trade high/low extremes.
  - `check_exits(open_trades, current_data) -> list[Signal]` — per trade, first-trigger-wins over
    fixed % SL/TP, ATR SL/TP, trailing %; warm-up guard: if `atr_{period}` is `NaN`, ATR exits skip.
  - `get_exit_strategy_params() -> list[StrategyParamSpec]` — the flat six-param list.
- `src/q_backend/backtesting/factory.py` — `build_strategy` hand-constructs
  `ExitStrategy(stop_loss_pct=..., ...)` from `merged` (lines 20–28).
- `src/q_backend/backtesting/strategy_registry.py`
  - `StrategyParamSpec` (BaseModel, line 16) — `name,label,type,default,min,max,step,choices,hint`.
  - `register_strategy(...)` — for `engine=="candle"` (except `CompositeStrategy`) appends
    `get_exit_strategy_params()` to the strategy's params (lines 71–78).
- `src/q_backend/backtesting/engine.py`
  - `compute_indicators(chunk)` then a **hard-coded ATR block** (`134–144`): if
    `exit_strategy.stop_loss_atr>0 or take_profit_atr>0`, compute `atr_{period}` via `compute_atr`.
  - `check_exits` is called at `engine.py:262` and `engine.py:284`.
- `src/q_backend/backtesting/technical_indicators.py` — `compute_atr(high,low,close,period)`
  (Wilder) already exists; reuse it.
- `src/q_backend/backtesting/strategy.py:58–59` — sets a default `ExitStrategy` on the strategy.

---

## Goal

```python
# Self-assembling coordinator from the flat param dict (no hand-listed kwargs):
strategy.exit_strategy = ExitStrategy(merged)        # picks up only the rules whose params are set
# Each exit type is one small module implementing a protocol; the registry is the single source of
# truth that get_exit_strategy_params(), factory.py, engine column-prep, and the frontend all read.
cols = strategy.exit_strategy.required_columns()      # engine precomputes these generically
```

Same trades as today for existing strategies; adding a future exit = one new file + one registry
line; the three-place duplication collapses to one registry.

## Tasks

### 1. New `exit_rules/` package — the protocol

Create `src/q_backend/backtesting/exit_rules/base.py` with an `ExitRule` ABC/Protocol:

```python
class ExitRule(ABC):
    id: str                      # "fixed_sl", "atr_tp", ...
    exit_group: str              # "stop_loss" | "trailing" | "target" | "time"

    def param_specs(self) -> list[StrategyParamSpec]: ...
    def is_enabled(self, params: dict) -> bool: ...           # e.g. its multiplier > 0
    def required_columns(self, params: dict) -> list[str]: ...# e.g. ["atr_14"]; default []
    def on_bar(self, trade, data, state: dict) -> None: ...    # mutate per-trade state (peaks, etc.)
    def should_exit(self, trade, data, state: dict) -> bool: ...
```

Per-trade `state` is a plain `dict` **owned by the coordinator** (see Task 3), passed to the rule —
rules are otherwise stateless and reusable. `on_bar` defaults to no-op; `required_columns` to `[]`.

### 2. Migrate the five legacy behaviors (byte-identical)

Create `src/q_backend/backtesting/exit_rules/legacy.py` with rules re-expressing today's logic with
the **exact same** param names, defaults, mins/maxes, steps, hints, and trigger math:
`fixed_sl` (`stop_loss_pct`), `fixed_tp` (`take_profit_pct`), `trailing` (`trailing_stop_pct`),
`atr_sl` (`stop_loss_atr`+`atr_period`), `atr_tp` (`take_profit_atr`+`atr_period`). The trailing and
ATR rules reuse the existing peak-tracking semantics (extreme = max(entry, running high) for longs,
mirror for shorts). Tag `exit_group` per rule (`stop_loss`/`target`/`trailing`).

### 3. Registry + coordinator

- `src/q_backend/backtesting/exit_rules/registry.py`: `EXIT_RULES: list[ExitRule]` (legacy rules
  now; WO62/63 append). Helpers: `all_param_specs()`, `enabled_rules(params)`,
  `required_columns(params)` (union over enabled rules).
- Refactor `exit_strategy.py`:
  - `ExitStrategy(params: dict)` — store `params`, resolve `self._rules = enabled_rules(params)`.
  - Own `self._state: dict[trade_id, dict[rule_id, dict]]`; prune stale trade ids each bar (as
    `_extreme_prices` cleanup does today).
  - `check_exits(open_trades, current_data)`: per open trade, for each enabled rule call `on_bar`
    then `should_exit`; **first rule to return True** appends `Signal(CLOSE)` and stops scanning
    that trade. Preserve the warm-up guard (a rule whose required column is `NaN` must not fire).
  - `required_columns() -> list[str]` delegating to the registry over `self.params`.
  - `get_exit_strategy_params()` (module-level) delegates to `registry.all_param_specs()`.

### 4. `StrategyParamSpec.exit_group` field

Add to `StrategyParamSpec` (`strategy_registry.py:16`):

```python
exit_group: Literal["stop_loss", "trailing", "target", "time"] | None = None
```

Distinct from the existing strategy-level `category`. Every exit param spec sets it; entry params
leave it `None`. (Frontend consumes it in WO64.)

### 5. Rewire factory + engine (remove duplication)

- `factory.py`: replace the hand-listed `ExitStrategy(stop_loss_pct=..., ...)` (20–28) with
  `strategy.exit_strategy = ExitStrategy(merged)`.
- `engine.py`: **delete** the hard-coded ATR block (`134–144`). Replace with a generic prep: ask
  `self.strategy.exit_strategy.required_columns()` and compute any missing columns vectorized —
  `atr_{p}` via `compute_atr`. No change to `check_exits` call sites or method signatures.
- `strategy.py:58–59`: default `ExitStrategy({})` (no rules enabled) — unchanged behavior.

## Guardrails

> **Backward compatibility is invariant.** The five legacy params keep identical names, defaults,
> and trigger math. A backtest of an existing strategy produces **byte-identical trades** before and
> after this refactor. Golden-test it.

> **No partial exits.** Rules only ever cause a full `Signal(CLOSE)`. No position-sizing / scale-out
> here or ever in this batch.

> **Flat param dict only.** No list/JSON/nested params. The optimizer search-space, genome, and
> saved strategies must see only new _optional_ scalar params (default 0/unset = disabled), so they
> need no changes.

> **Determinism.** Same OHLC + same params → identical exit signals. No wall-clock, no RNG.

> **One source of truth.** `get_exit_strategy_params()`, `factory.py`, engine column-prep, and (in
> WO64) the frontend all read the registry. No exit param name appears hard-coded anywhere else.

## Tests — `tests/backtesting/test_exit_rules.py` (new) + `test_exit_strategy.py` (extend)

- **Legacy parity (golden):** on a fixed OHLC fixture, a strategy with each legacy param set
  produces the **same trades** as a captured pre-refactor baseline (assert exit bars + prices).
- **Coordinator:** first-trigger-wins when two rules would fire same bar (assert order independence
  of outcome = a CLOSE either way); multiple rules stack (SL + trailing both enabled coexist).
- **Warm-up:** an ATR rule does not fire while `atr_{period}` is `NaN`.
- **`required_columns` → engine:** spy that the engine precomputes exactly the union of required
  columns and nothing else when only `%` rules are enabled (no ATR column computed).
- **State lifecycle:** per-trade state is created on open and pruned when the trade closes.
- Existing strategy/backtest tests green and **unmodified**.

## Docs

`q_backend/README.md`: document the exit-rule registry — exits are now composable modules behind an
`ExitRule` protocol; the flat param dict is preserved; new exits are one file + one registry entry;
the engine precomputes indicator columns generically via `required_columns`.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Existing strategies backtest to byte-identical trades (golden test green).
- Paste in the final message: the `ExitRule` protocol, the coordinator `check_exits` flow
  (state ownership + first-trigger-wins), and the `engine.py` ATR-block replacement.

## Out of scope

- New specialized exit behaviors — Chandelier/Break-even/Parabolic SAR (**WO62**); Profit-target
  ratchet/Time stop/Donchian (**WO63**).
- Frontend workbench rendering — **WO64**.
- Partial / scaled exits, position sizing, new entry strategies.
