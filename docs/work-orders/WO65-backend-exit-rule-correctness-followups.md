# WO65 — Backend: exit-rule correctness follow-ups (textbook Wilder PSAR + shared `atr_period` grouping)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test`

**Context for this work:** the WO61–64 batch shipped the composable exit-rule registry and six
specialized exits. A post-merge review flagged two small correctness/clarity items, both contained:

1. **Parabolic SAR is a simplified accelerator, not textbook Wilder SAR.** In
   `exit_rules/parabolic_sar.py` the SAR is seeded at `entry_price`, and it omits the Wilder rule
   that **SAR may not penetrate the prior two bars' range** (clamp). Functionally it trails, but it
   is not a reference PSAR and can sit at non-physical levels right after entry.
2. **`atr_period` is mis-grouped.** It is tagged `exit_group="stop_loss"` in `legacy.py`, but it is a
   **shared indicator setting** consumed by ATR Stop, ATR Take-Profit, Chandelier, and the
   Profit-target ratchet. In the workbench it currently shows only under the "Stop Loss" card, which
   misleads users into thinking it only affects the stop.

This WO fixes both. It is small and mostly backend; it touches one frontend type + group map so the
shared param renders sanely immediately. The richer toggle-card workbench is **WO66/WO67** — this WO
just makes the metadata honest so those build on a correct base.

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/exit_rules/parabolic_sar.py` — `update_psar_long/short` helpers +
  `ParabolicSarStopRule`. Seeds `state["sar"]=entry_price`, advances `sar += af*(ep-sar)`, bumps AF
  on new extremes; `should_exit` fires when price crosses SAR.
- `src/q_backend/backtesting/exit_rules/legacy.py` — `AtrStopLossRule.param_specs()` declares
  `atr_period` with `exit_group="stop_loss"` (the only place `atr_period` is declared;
  `all_param_specs()` de-dupes by name so it appears once).
- `src/q_backend/backtesting/strategy_registry.py:16` — `StrategyParamSpec`; the `ExitGroup` Literal.
- `src/q_backend/backtesting/exit_rules/registry.py` — `all_param_specs()` (dedupe by name).
- `tests/backtesting/test_exit_rules.py` — existing PSAR + legacy tests.
- Frontend: `src/types/strategies.ts` (`ExitGroup` type) and
  `src/workspaces/strategy/exitWorkbenchGroups.ts` (`EXIT_GROUP_ORDER`, `EXIT_GROUP_LABELS`).

---

## Goal

```python
# 1. Textbook Wilder SAR: proper seed + "SAR can't enter prior two bars' range" clamp + reversal-safe.
# 2. atr_period reclassified as a shared indicator setting, not a Stop-Loss knob:
StrategyParamSpec(name="atr_period", ..., exit_group="general")   # renders in its own settings group
```

## Tasks

### 1. Textbook Wilder Parabolic SAR

In `parabolic_sar.py`, make the per-trade SAR follow Wilder's method:

- **Seed** on the first bar from a sensible prior reference: for a long, `sar = min(entry_price,
current_low)` with `ep = max(entry_price, current_high)`; mirror for short. (No look-ahead — use
  only the entry/first in-trade bar.)
- Each subsequent bar: `sar += af*(ep - sar)`; on a new EP, advance `af = min(af+af_step, af_max)`.
- **Clamp (the missing rule):** for a long, `sar = min(sar, prior_low, prior_prior_low)` so SAR never
  rises into the last two bars' lows (mirror with `max(... prior_high ...)` for short). Track the
  prior one/two bar lows/highs in `state`.
- Keep the math in pure, unit-testable helpers (`update_psar_long/short`) with explicit inputs;
  `on_bar` feeds them; `should_exit` unchanged (cross of SAR).
- Determinism + no look-ahead preserved.

### 2. Reclassify `atr_period` as a shared setting

- Add `"general"` to the backend `ExitGroup` Literal (`strategy_registry.py`).
- In `legacy.py`, change the `atr_period` spec's `exit_group` to `"general"` (leave its name,
  default `14`, min/max/step, hint untouched — backward compatible).
- Frontend: add `'general'` to `ExitGroup` in `src/types/strategies.ts`; in
  `exitWorkbenchGroups.ts` append `'general'` to `EXIT_GROUP_ORDER` (last) with label
  `EXIT_GROUP_LABELS.general = 'Indicator Settings'`. (This renders `atr_period` in its own card now;
  WO67 will refine shared-setting placement.)

## Guardrails

> **Behavior change is intentional and isolated.** Only PSAR triggers and `atr_period` grouping
> change. All other exit rules and the legacy-parity golden test stay green. PSAR is opt-in
> (`psar_af_start=0` disables), so default backtests are unaffected.

> **No look-ahead / determinism.** SAR uses only current + prior closed bars from `state`. Same OHLC
>
> - params → identical exits.

> **Backward-compatible params.** `atr_period`'s name/default/bounds are unchanged — saved
> strategies, the optimizer, and the genome see only a metadata (`exit_group`) change.

> **Don't expand scope.** No new exit rules, no API/metadata work (that's WO66), no workbench
> redesign (WO67/68).

## Tests — `tests/backtesting/test_exit_rules.py` (extend) + a small FE unit

- **PSAR clamp:** a constructed long series where the naive SAR would rise above the prior bar's low
  asserts the clamped SAR stays at/below it; reversal-style bars do not produce non-physical SAR;
  exact trigger bar on a hand-computed case (long + short); AF caps at `af_max`.
- **PSAR disabled parity:** `psar_af_start=0` ⇒ rule absent, trades unchanged.
- **`atr_period` grouping:** assert the spec returned by `all_param_specs()` has
  `exit_group == "general"`; assert ATR/Chandelier/ratchet rules still read it correctly (existing
  trigger tests stay green).
- **Frontend:** `exitWorkbenchGroups` groups a `general` spec under "Indicator Settings"
  (extend `tests/unit/workspaces/exitWorkbenchGroups.test.ts`).

## Docs

`q_backend/README.md`: update the Parabolic SAR bullet (now textbook Wilder with the prior-two-bar
clamp) and note `atr_period` is a shared `general` indicator setting.

---

## Definition of done

- `uv run pytest` passes and `pnpm test` passes. **Do not report completion until both do.**
- PSAR matches a hand-computed Wilder reference on the test case; `atr_period` reports
  `exit_group="general"`.
- Paste in the final message: the corrected SAR update+clamp, and the `atr_period` regrouping.

## Out of scope

- Exit-rule metadata / presets API — **WO66**.
- Workbench toggle-card redesign — **WO67**. Page layout/polish — **WO68**.
- Any new exit behaviors or partial exits.
