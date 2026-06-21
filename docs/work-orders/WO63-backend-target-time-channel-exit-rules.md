# WO63 — Backend: target, time & channel exit rules (Profit-target ratchet, Time stop, Donchian)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "Specialized exits". **WO61 must land first** (registry of
`ExitRule` modules; flat param dict; full-position CLOSE only; per-trade `state` dict; generic
`required_columns` indicator prep). This WO adds three rules with distinct mechanics: a **profit
target** that trails up, a **time** stop, and an **indicator-channel** stop (the one that needs a
precomputed column — and proves WO61's `required_columns` hook). Sibling **WO62** adds the
stop/trailing family; **WO64** is the generic frontend. Do NOT touch the engine/factory/frontend.

**Hard constraints (from WO61):** full-position exits only; flat scalar params, default 0/unset =
disabled; determinism; warm-up NaN no-fire; new indicator columns flow ONLY through
`required_columns` (no new hard-coded engine blocks).

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/exit_rules/base.py` (WO61) — `ExitRule` ABC (`on_bar`, `should_exit`,
  `required_columns`, `is_enabled`, `exit_group`).
- `src/q_backend/backtesting/exit_rules/registry.py` (WO61) — `EXIT_RULES` to append to.
- `src/q_backend/backtesting/exit_strategy.py` (WO61) — coordinator runs `on_bar` every bar for
  every open trade (so a per-trade **bar counter** can live in `state` — no engine change needed for
  the time stop).
- `src/q_backend/backtesting/technical_indicators.py`
  - `compute_donchian_channels(high, low, period) -> (upper, lower)` — **already exists** and already
    `.shift(1)`s (lookahead-safe). The Donchian rule reuses it; WO61's engine prep computes the
    columns from `required_columns`.
  - `compute_atr(high, low, close, period)` — for the ratchet's ATR distance.
- `src/q_backend/backtesting/strategy_registry.py:16` — `StrategyParamSpec` (with `exit_group`).

---

## Goal

```python
ProfitTargetRatchet # take-profit that trails UP once first ATR multiple hit (don't cap runners)
TimeStop            # close after N bars in trade (kill dead money)
DonchianChannelStop # exit on cross of opposite N-bar extreme (channel trail)
```

Each toggled by its own scalar param; composes with WO61/WO62 rules via first-trigger-wins.

## Tasks

### 1. Profit-target ratchet — `exit_rules/profit_target_ratchet.py` (`exit_group="target"`)

- Param `target_ratchet_atr` (float, default 0.0, 0–20, step 0.1) — 0 disables. Reuses `atr_period`;
  `required_columns` → `["atr_{atr_period}"]`.
- `on_bar`: once price reaches `entry + target_ratchet_atr*atr` (long), arm and set
  `state["ratchet"] = current_high - target_ratchet_atr*atr`; thereafter raise the ratchet as the
  high rises (never lower). Mirror for short.
- `should_exit` (long): armed and `current_low <= state["ratchet"]`; mirror for short. Warm-up NaN
  ATR ⇒ never arms. (Net effect: a target that protects an open profit without capping a runner.)

### 2. Time stop — `exit_rules/time_stop.py` (`exit_group="time"`)

- Param `max_bars_in_trade` (int, default 0, 0–5000, step 1) — 0 disables.
- `on_bar`: increment `state["bars"]` (starts at 0 on the entry bar).
- `should_exit`: `state["bars"] >= max_bars_in_trade`. No indicator column. Long/short identical.

### 3. Donchian channel stop — `exit_rules/donchian_stop.py` (`exit_group="trailing"`)

- Param `donchian_exit_period` (int, default 0, 0–500, step 1) — 0 disables.
- `required_columns` → `["donchian_high_{p}", "donchian_low_{p}"]` for `p=donchian_exit_period`.
  **Extend WO61's engine prep** to compute these via `compute_donchian_channels` when requested
  (the generic prep already iterates `required_columns`; add a recognizer for the `donchian_*_{p}`
  column names alongside the `atr_{p}` recognizer — still no rule-specific `if` in the engine, just
  a column-name → compute-fn mapping).
- `should_exit` (long): `current_low <= donchian_low_{p}` (broke the N-bar low); short:
  `current_high >= donchian_high_{p}`. Warm-up: NaN channel ⇒ do not fire.

### 4. Register

Append the three rules to `EXIT_RULES` in `exit_rules/registry.py`.

## Guardrails

> **`required_columns` is the only indicator pathway.** Donchian columns are declared by the rule
> and produced by WO61's generic prep via a column-name→fn map (`atr_*` → `compute_atr`,
> `donchian_*` → `compute_donchian_channels`). Do **not** add a rule-specific block to `engine.py`.

> **Disabled = invisible / no lookahead / full CLOSE only / determinism.** Same as WO61/WO62:
> default 0 ⇒ uninstantiated and existing backtests unchanged; channels use the already-shifted
> (lookahead-safe) `compute_donchian_channels`; rules emit only full exits.

> **Don't touch the spine beyond the column-name map.** No factory/coordinator/frontend edits.

## Tests — `tests/backtesting/test_exit_rules.py` (extend)

- **Ratchet:** price runs up past the first ATR multiple, ratchet arms and rises with the high; a
  pullback to the ratchet exits on the exact bar; a trade that never reaches the multiple never
  arms; short mirror; warm-up NaN no-arm.
- **Time stop:** a trade with no other exit closes exactly on bar `max_bars_in_trade`; counter
  starts at the entry bar; `0` disables.
- **Donchian:** `required_columns` requests `donchian_high_{p}`/`donchian_low_{p}`; the engine prep
  computes them; a long exits when `low` breaks the prior N-bar low; short mirror; warm-up no-fire.
- **Disabled parity:** all three params default → trades identical to a WO61/WO62-only run.

## Docs

`q_backend/README.md`: add Profit-target ratchet, Time stop, and Donchian channel stop to the
exit-rule list; note the column-name→compute-fn map that `required_columns` drives.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Each rule fires on the correct bar; Donchian columns are produced via `required_columns` (no
  engine `if rule==`).
- Paste in the final message: each rule's logic + param specs, and the column-name→fn map wiring
  for Donchian.

## Out of scope

- Chandelier / Break-even / Parabolic SAR — **WO62**.
- Registry/coordinator/engine foundation — **WO61**.
- Frontend rendering — **WO64**. Partial exits / position sizing.
