# WO62 — Backend: trailing & stop exit rules (Chandelier, Break-even, Parabolic SAR)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "Specialized exits". **WO61 must land first** — it replaces the
monolithic `ExitStrategy` with a registry of self-describing `ExitRule` modules (flat param dict,
full-position CLOSE only, per-trade `state` dict owned by the coordinator, generic
`required_columns` indicator prep). This WO adds three **smarter stop/trailing** rules on that
protocol. Sibling **WO63** adds target/time/channel rules; **WO64** is the generic frontend (these
rules will surface automatically once they declare an `exit_group`). Do NOT touch the engine,
factory, or frontend — WO61 already made exit rules pluggable.

**Hard constraints (from WO61):** full-position exits only; flat scalar params, default 0/unset =
disabled (so optimizer/genome/saved strategies are unaffected); determinism; warm-up NaN no-fire.

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/exit_rules/base.py` (from WO61) — the `ExitRule` ABC: `id`,
  `exit_group`, `param_specs`, `is_enabled`, `required_columns`, `on_bar(trade, data, state)`,
  `should_exit(trade, data, state)`.
- `src/q_backend/backtesting/exit_rules/legacy.py` (from WO61) — copy the trailing/ATR rule pattern
  (peak-tracking via `state`, `atr_{period}` column usage, long/short mirroring, warm-up guard).
- `src/q_backend/backtesting/exit_rules/registry.py` (from WO61) — `EXIT_RULES` list to append to.
- `src/q_backend/backtesting/technical_indicators.py` — `compute_atr(high,low,close,period)`
  already exists (the Chandelier rule declares `atr_{period}` via `required_columns`; the engine
  precomputes it). SAR is computed iteratively per-trade in `on_bar` (no column needed).
- `src/q_backend/backtesting/strategy_registry.py:16` — `StrategyParamSpec` (now with `exit_group`).
- `src/q_backend/backtesting/models.py` — `Trade` (`entry_price`, `action`, `id`, `symbol`),
  `Signal`, `SignalAction`.

---

## Goal

```python
# Three new ExitRule modules, registered, each toggled by its own scalar param:
ChandelierExit   # trailing stop at peak_high - mult*ATR  (mirror for shorts)
BreakevenStop    # once gain >= trigger, snap stop to entry (+/- small offset)
ParabolicSarStop # accelerating Wilder SAR trailing stop
```

Classic professional stops, composable with the legacy SL/TP and with each other
(first-trigger-wins). Setting a rule's param to 0/unset leaves it uninstantiated (zero cost).

## Tasks

### 1. Chandelier Exit — `exit_rules/chandelier.py` (`exit_group="trailing"`)

- Param `chandelier_atr_mult` (float, default 0.0, 0–10, step 0.1) — 0 disables. Reuses
  `atr_period` (already registered by WO61). `required_columns` → `["atr_{atr_period}"]`.
- `on_bar`: track per-trade `peak` (highest high since entry for longs / lowest low for shorts) in
  `state`, seeded from `entry_price` on first bar.
- `should_exit` (long): `current_low <= peak - chandelier_atr_mult * atr`; mirror for short
  (`current_high >= trough + mult*atr`). Warm-up: if `atr` is `NaN`, do not fire.

### 2. Break-even stop — `exit_rules/breakeven.py` (`exit_group="stop_loss"`)

- Params `breakeven_trigger_pct` (float, default 0.0, 0–0.5, step 0.001) — 0 disables;
  `breakeven_offset_pct` (float, default 0.0, 0–0.1, step 0.001) — fraction of entry to lock
  (positive = lock a sliver of profit; the stop sits at `entry*(1+offset)` for longs).
- `on_bar`: once gain from entry ≥ `breakeven_trigger_pct`, set `state["armed"]=True`.
- `should_exit` (long): if armed and `current_low <= entry*(1+breakeven_offset_pct)` → exit;
  mirror for short (`current_high >= entry*(1-offset)`). Not armed ⇒ never fires.

### 3. Parabolic SAR stop — `exit_rules/parabolic_sar.py` (`exit_group="trailing"`)

- Params `psar_af_start` (float, default 0.0, 0–0.1, step 0.005) — 0 disables; `psar_af_step`
  (float, default 0.02, 0–0.1, step 0.005); `psar_af_max` (float, default 0.2, 0–1.0, step 0.01).
- `on_bar`: maintain per-trade Wilder SAR in `state` — `sar`, `ep` (extreme point), `af`
  (acceleration factor, capped at `af_max`), seeded from entry bar; update each bar by
  `sar += af*(ep - sar)` with EP/AF advancement on new extremes. Direction = trade side.
- `should_exit` (long): `current_low <= sar`; mirror for short (`current_high >= sar`).
- Keep the SAR math in a small pure helper for unit testing; no lookahead (uses only closed-bar data).

### 4. Register

Append the three rules to `EXIT_RULES` in `exit_rules/registry.py`. No other file changes —
WO61's factory/engine/`get_exit_strategy_params` already consume the registry; WO64's frontend
already renders by `exit_group`.

## Guardrails

> **Disabled = invisible.** A rule whose primary param is 0/unset is not instantiated — zero
> runtime cost, no per-trade state, and (with defaults) **no change to any existing backtest**.

> **Full CLOSE only.** Each rule emits a full exit; no partial/scaled closes.

> **Determinism & no lookahead.** SAR/peak math uses only the current and prior closed bars and the
> seeded per-trade state. Same OHLC → same exits.

> **Don't touch the spine.** No edits to `engine.py`, `factory.py`, `strategy_registry`'s merge
> logic, or the frontend — only new rule modules + the registry append. If you need a new indicator
> column, declare it via `required_columns` (do not add another hard-coded engine block).

## Tests — `tests/backtesting/test_exit_rules.py` (extend)

- **Chandelier:** synthetic long uptrend then pullback fires on the exact bar price crosses
  `peak - mult*ATR`; short mirror; warm-up NaN ATR does not fire.
- **Break-even:** trade not reaching trigger never arms (no exit); after arming, a dip to entry(+offset)
  exits on the right bar; short mirror.
- **Parabolic SAR:** constructed series where SAR is hand-computable for 3–4 bars asserts exact
  trigger bar; AF caps at `af_max`; short mirror.
- **Disabled parity:** with all three params at default 0, trades are identical to a WO61-only run.
- **Stacking:** Chandelier + legacy ATR stop both enabled → whichever triggers first closes.

## Docs

`q_backend/README.md`: add Chandelier, Break-even, and Parabolic SAR to the exit-rule list with a
one-line description and their params.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Each rule fires on the correct bar in a constructed test (long + short).
- Paste in the final message: each rule's trigger math, its new param specs, and confirmation that
  defaults leave existing backtests unchanged.

## Out of scope

- Profit-target ratchet, Time stop, Donchian channel stop — **WO63**.
- Registry/coordinator/engine/factory foundation — **WO61**.
- Frontend rendering — **WO64**. Partial exits / position sizing.
