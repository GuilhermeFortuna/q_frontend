# Design — Multi-entry composition (mix & match entries with exits)

**Status:** Adopted 2026-06-24. Implemented by **WO107–WO112**.

## Problem

Today a backtest picks exactly **one** entry strategy (a monolithic `TradingStrategy`
subclass that owns `check_entry_conditions`), while **exits** are already a composable
registry of `ExitRule`s (`exit_rules/registry.py`, activated by flat params; first rule to
fire closes the trade). The user wants entries to be just as composable — and to freely
**mix and match any entries with any exits**.

## Decisions (locked with the user)

1. **Instance-based entries.** A backtest carries an ordered list of entry _instances_, each
   `{strategy, params}`. The **same** strategy type may appear more than once with different
   params (e.g. a fast MA crossover _and_ a slow one). Each instance is an existing registered
   strategy, **reused as-is** as a directional signal source — we do not rewrite the 13
   strategies into a new "entry rule" base.
2. **Signal managers combine the instances.** Ship three: **OR**, **AND**, **Majority/vote**
   (threshold). The manager interface is open for future managers (weighted, priority,
   confirmation-within-N-bars).
3. **The manager decides reversals too.** Entry strategies become _pure signal sources_ with no
   standalone exit. When the manager's net stance flips against an open trade, that trade is
   closed (symmetric to entry). Explicit exit rules (stops/targets/trailing/time) still layer on
   top, unchanged.
4. **Scope:** manual **Backtests** + **Optimization**. Genetic discovery (the genome
   `CompositeStrategy` in `backtesting/genome/`) is **out of scope** and untouched — we do not
   merge the two composition systems.
5. **Backward compatible.** A legacy single-strategy run is exactly one instance under an OR
   manager and must behave bit-for-bit as before.

## Key mechanic — stance derivation

Existing strategies emit **edge events**: `buy_signal`/`sell_signal` are true only on the
crossover bar. Combining raw edges with AND would require two edges on the _same_ bar (almost
never happens) — useless. So the composite converts each instance's edges into a **persistent
stance** before combining:

```
stance[i] = +1 (long)  from a BUY edge until the next SELL edge
            -1 (short) from a SELL edge until the next BUY edge
             0          before the instance's first signal
```

(Forward-fill the last edge direction.) The manager then combines per-bar stances into a **net
stance**:

- **OR** — net = +1 if any instance is +1 and none is −1; −1 if any −1 and none +1; else 0
  (disagreement ⇒ flat).
- **AND** — net = +1 only if **every** non-flat instance is +1 (and ≥1 instance is +1);
  symmetric for −1; else 0.
- **Majority** — let `L`,`S` be counts of +1/−1 stances. net = +1 if `L ≥ threshold` and `L > S`;
  −1 if `S ≥ threshold` and `S > L`; else 0. (`threshold` default 2; ties ⇒ flat.)

A new trade opens when the **net stance edges into** +1/−1; an open trade closes when the net
stance turns to the opposite sign (reversal). All logic is strictly causal (bar `i`'s net stance
depends only on bars `≤ i`).

## Architecture

### Backend

- `backtesting/signal_managers/` (new, mirrors `exit_rules/`):
  - `base.py` — `Stance` enum (`LONG`/`SHORT`/`FLAT`) + `SignalManager` ABC with
    `combine(stances: list[Stance]) -> Stance`, plus `id`/`label`/`description`/`param_specs()`.
  - `or_manager.py`, `and_manager.py`, `majority.py`.
  - `registry.py` — `SIGNAL_MANAGERS`, `get_manager(kind, params)`, `list_signal_managers()`.
- `backtesting/composite_entry.py` (new) — `CompositeEntryStrategy(TradingStrategy)`:
  holds `[(name, sub_strategy)]`, a `SignalManager`, and one `ExitStrategy`. `compute_indicators`
  runs each sub-strategy on a copy of the base OHLCV, derives per-instance stance arrays, applies
  the manager to produce net-stance columns, and merges each sub's chart indicators namespaced
  (`e{i}__col`). `check_entry_conditions`/`check_exit_conditions` read the net-stance columns.
- `factory.build_strategy` gains a multi-entry path (`build_composite_entry`).
- API: `BacktestRequest` gains `entries: list[EntryInstance] | None`,
  `entry_manager: EntryManagerConfig`, and a top-level `exit_params: dict` (shared, position-level
  exits). `entries=None` ⇒ synthesize one instance from `strategy`/`strategy_params` + OR manager.
  New `GET /api/v1/signal-managers` catalog.
- Optimization: per-instance param namespacing (`e{i}__<param>`), manager params searchable;
  `backtest_runner` rebuilds the entries list from trial params.

### Frontend

- `StrategyStudio` (Simulation) and `OptimizeSetupPanel` (Optimize): entry cards become
  **multi-select instances** (add/remove, duplicates allowed) reusing the `LibraryCard` shell from
  WO88; a **manager selector** (OR / AND / Majority+threshold); per-instance param (Simulation) or
  search-range (Optimize) panels stacked on the right.
- `useBacktestConfig` holds `entries` + `entryManager`; `buildBacktestRequest` emits the new
  payload (and keeps emitting the legacy single-entry shape when only one instance + OR is set, so
  nothing else has to change at once).

## Out of scope

- Genetic discovery / genome `CompositeStrategy` unification.
- New manager types beyond OR/AND/Majority (interface left open).
- Per-instance _exit_ attribution (exits stay position-level / shared).
