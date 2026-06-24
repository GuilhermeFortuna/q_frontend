# WO108 — Backend: CompositeEntryStrategy (stance derivation + manager + reversal)

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/multi-entry-composition.md` (**Stance derivation** + **Architecture → Backend**).
Depends on **WO107** (`signal_managers/` registry must exist).

## How the pieces work today (read these files)

- `src/q_backend/backtesting/strategy.py` — `TradingStrategy` ABC + the execution contract
  (strict causality; signals derived from a closed bar, filled next bar open). `MACrossoverStrategy`
  is the reference: `compute_indicators` precomputes `buy_signal`/`sell_signal` columns;
  `check_entry_conditions` reads them; `resolve_symbol` helper.
- `src/q_backend/backtesting/genome/composite_strategy.py` — `CompositeStrategy` (genome) is a good
  reference for a `TradingStrategy` that derives entry/exit from precomputed boolean columns
  (`entry_long_signal`/`exit_long_signal` etc.) and a cached compute. **Do not modify or reuse it**
  — it is the genetic-search system (out of scope); just mirror its column-driven shape.
- `src/q_backend/backtesting/exit_strategy.py` — `ExitStrategy(params)`; engine calls
  `exit_strategy.check_exits(...)` independently. The composite owns ONE `ExitStrategy`.
- `src/q_backend/backtesting/engine.py` — `_run_single_chunk` calls `strategy.compute_indicators`,
  then per bar `check_exit_conditions` (strategy-native reversal) **and** `exit_strategy.check_exits`
  (explicit rules), then `check_entry_conditions`. The composite plugs into all three unchanged.
- `src/q_backend/backtesting/factory.py` — `build_strategy(name, params, symbol)` builds a single
  strategy and attaches `ExitStrategy(merged)`.
- `src/q_backend/backtesting/strategy_registry.py` — `get_registered_strategy`,
  `merge_strategy_params`, `default_params_for` (use to build each sub-instance).

## Goal

```python
comp = CompositeEntryStrategy(
    instances=[("MACrossover", {"short_period": 10, ...}),
               ("RSIMeanReversion", {"rsi_period": 14, ...})],
    manager=get_manager("and", {}),
    exit_params={"stop_loss_atr": 2.0, "atr_period": 14},
    symbol="BTCUSDT",
)
df = comp.compute_indicators(ohlcv)   # adds net_long_signal / net_short_signal + e{i}__ indicators
```

`compute_indicators` derives each instance's **stance** (forward-filled edge direction), applies
the manager per bar, and writes net-stance columns. Entries fire on net-stance edges; reversals
close trades when net stance flips against them. Explicit exits still come from
`exit_strategy.check_exits`.

## Tasks

### 1. `src/q_backend/backtesting/composite_entry.py` — `CompositeEntryStrategy(TradingStrategy)`

`__init__(self, instances, manager, exit_params, symbol)`:

- For each `(name, params)` build the sub-strategy via the registry:
  `merged = merge_strategy_params(name, params); sub = get_registered_strategy(name).build(merged, symbol)`.
  Keep `self._instances = [(slot_id, name, sub)]` where `slot_id = f"e{i}"`.
- `self.manager = manager`; `self.exit_strategy = ExitStrategy(exit_params or {})`.
- Call `super().__init__(...)` but **override** the base's auto `exit_strategy` afterward with the
  shared `exit_params` one (base `__init__` builds `ExitStrategy(kwargs)` — keep behavior sane).

`compute_indicators(data)`:

1. `df = data.copy()`.
2. For each instance: `sub_df = sub.compute_indicators(data.copy())`; read its
   `buy_signal`/`sell_signal` columns (fall back to running `check_entry_conditions` per row only if
   a strategy doesn't precompute them — all built-ins do precompute, so prefer the columns).
   Derive **stance**: start 0; +1 from a buy edge, −1 from a sell edge, forward-fill
   (`np.where(buy, 1, np.where(sell, -1, np.nan))` then `ffill().fillna(0)`). Store as
   `df[f"{slot_id}__stance"]`. Merge each sub's `get_chart_indicators()` columns into `df` renamed
   `f"{slot_id}__{key}"` for charting.
3. Combine per bar: build a 2-D int array of instance stances `(n_bars, n_instances)` and apply
   `manager.combine` row-wise → `net` array of {−1,0,+1}. (A python loop over bars is acceptable;
   keep it vectorized where trivial for OR/AND/Majority if easy, but correctness first.)
4. Net **edges** → entry signals: `net_long_signal = (net == 1) & (prev_net != 1)`,
   `net_short_signal = (net == -1) & (prev_net != -1)` where `prev_net = shift(net, 1)`.
   Also store raw `df["net_stance"] = net` for the reversal check. Write `buy_signal`/`sell_signal`
   aliases (= net edges) so existing tooling that reads them keeps working.

`check_entry_conditions(current_data)`: emit BUY if `net_long_signal`, SELL if `net_short_signal`
(reuse `resolve_symbol`).

`check_exit_conditions(current_data, open_trades)`: reversal — for each open trade, CLOSE a BUY
(long) trade when `net_stance <= -1` (manager now short/flat-against), CLOSE a SELL when
`net_stance >= 1`. (Define exactly: close long when `net_stance == -1`; close short when
`net_stance == 1` — flat does **not** force-close; only an opposite stance reverses.)

`get_chart_indicators()`: aggregate each instance's specs with the `e{i}__` key prefix and a label
prefixed by the instance (e.g. `e0 · MA Short (10)`), so multiple instances don't collide.

### 2. Factory support — `factory.py`

Add `build_composite_entry(entries: list[dict], manager_kind: str, manager_params: dict,
exit_params: dict, symbol: str) -> CompositeEntryStrategy` where each `entry` is
`{"strategy": name, "params": {...}}`. Keep `build_strategy` unchanged for the single-entry path;
WO109 calls the new builder when `entries` is present.

## Guardrails

> **Causality:** stance at bar `i` may depend only on bars `≤ i` (forward-fill is causal; never
> back-fill). The repo's `test_strategy_causality.py` guards registered strategies — keep the
> composite causal so it would pass the same bar-truncation check.
> **Backward compatibility:** a composite of exactly one instance under the OR manager must produce
> the **same trades** as building that strategy directly — assert this in tests.
> **One `ExitStrategy`** for the whole position (exits are position-level, not per-instance).
> Do not touch the genome `CompositeStrategy` or `exit_rules`.

## Tests

`tests/backtesting/test_composite_entry.py`:

- **Equivalence:** single instance `("MACrossover", params)` + OR manager produces an identical
  trade list to a `BacktestEngine` run on `build_strategy("MACrossover", params, symbol)` over a
  fixture frame.
- **Stance derivation:** a hand-built frame with one buy edge then one sell edge yields the
  expected forward-filled `e0__stance` series.
- **AND filtering:** two instances whose stances agree only on a sub-range produce entries only on
  the net-long edge of that range; disagreement ⇒ no entry.
- **Majority (threshold 2):** three instances; net flips long only when ≥2 are long and longs>shorts.
- **Reversal:** an open long closes on the bar after net stance turns −1 (engine fills next open);
  flat net stance does **not** close it.
- **Exits still apply:** with `exit_params={"stop_loss_pct": ...}` the explicit stop still fires via
  `exit_strategy.check_exits` independent of the manager.

## Docs

- None beyond the design doc.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: confirm (a) single-instance+OR equivalence test passes, (b) the AND and
  Majority entry tests pass, (c) reversal closes on opposite stance but not on flat.

## Out of scope

- API request schema, `exit_params` plumbing from the request, managers catalog endpoint — **WO109**.
- Optimization search-space namespacing — **WO110**.
