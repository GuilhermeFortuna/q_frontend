# WO69 — Backend + Frontend: sensible enable-on defaults for exit rules

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test` ; typecheck/build: `pnpm exec tsc -p tsconfig.app.json --noEmit` / `pnpm build`

**Context for this work:** WO67 shipped the toggle-card exit configurator. When a user flips an exit
**on**, the frontend sets its `enable_param` to a value derived by `defaultEnableValue()` in
`src/workspaces/strategy/exitRuleSemantics.ts` — which falls back to the **midpoint of min..max** when
the spec default is 0 (all toggles default to 0 = disabled). That midpoint produces **absurd trading
values**, so toggling a single exit on lands the user on a value they must immediately fix:

| Exit               | Current toggle-on value |
| ------------------ | ----------------------- |
| Fixed Stop Loss    | 25%                     |
| Fixed Take Profit  | 50%                     |
| Trailing Stop      | 25%                     |
| Break-even trigger | 25%                     |
| Ratchet target     | 10× ATR                 |
| Time stop          | 2500 bars               |
| Donchian           | 250 period              |
| ATR / Chandelier   | 5× ATR                  |

The WO66 **presets** already encode sensible numbers (e.g. `stop_loss_atr: 2.0`, `chandelier: 3.0`,
`donchian_exit_period: 20`, `max_bars_in_trade: 50`) — single-toggle just doesn't use them. This WO
makes the **backend** the source of truth for a sensible enable-on value per rule and has the
**frontend** prefer it over the midpoint heuristic. Small, additive, no behavior change to backtests.

This builds on WO66 (`ExitRuleInfo`) and WO67 (`defaultEnableValue` / `ExitRuleCard`).

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/exit_rules/base.py` — `ExitRule` declares `id`, `exit_group`, `label`,
  `description`, `enable_param`, `param_names()`, `required_param_names()`.
- `src/q_backend/backtesting/exit_rules/*.py` — each concrete rule sets those class attrs; the
  enable param is the one `is_enabled` keys off (e.g. `chandelier_atr_mult`, `max_bars_in_trade`).
- `src/q_backend/backtesting/exit_rules/presets.py` — `EXIT_PRESETS` with good real-world values.
- `src/q_backend/backtesting/strategy_registry.py` — `ExitRuleInfo` (Pydantic) +
  `registry.list_exit_rules()` assembler.
- `src/q_backend/backtesting/exit_rules/registry.py` — `list_exit_rules()`.
- Frontend `src/workspaces/strategy/exitRuleSemantics.ts` — `defaultEnableValue(spec)` (midpoint
  fallback) and `isExitRuleEnabled`.
- Frontend `src/workspaces/strategy/ExitRuleCard.tsx` — `handleToggle` calls
  `defaultEnableValue(enableSpec)` when enabling.
- Frontend `src/types/strategies.ts` — `ExitRuleInfo` type. `src/mocks/data.ts` — mock catalog used
  by the workbench tests (must gain the new field).

---

## Goal

```jsonc
// ExitRuleInfo gains a recommended enable-on value, sourced from the rule (good real-world number):
{ "id": "max_bars_in_trade", "enable_param": "max_bars_in_trade", "enable_value": 50, ... }
{ "id": "fixed_sl", "enable_param": "stop_loss_pct", "enable_value": 0.02, ... }
```

```ts
// Frontend prefers the backend value; midpoint heuristic stays only as a last-resort fallback.
onChange(rule.enable_param, rule.enable_value ?? defaultEnableValue(enableSpec))
```

Toggling any exit on now yields a sensible, ready-to-use value.

## Tasks

### 1. Backend: `enable_value` on each rule

- Add an `enable_value: float | int` class attribute to `ExitRule` (`base.py`) and set a sensible
  value on **every** concrete rule, consistent with the preset numbers. Suggested values:
  - `stop_loss_pct` 0.02, `take_profit_pct` 0.05, `trailing_stop_pct` 0.02
  - `stop_loss_atr` 2.0, `take_profit_atr` 3.0, `chandelier_atr_mult` 3.0, `target_ratchet_atr` 2.0
  - `breakeven_trigger_pct` 0.02, `psar_af_start` 0.02
  - `max_bars_in_trade` 50, `donchian_exit_period` 20
- The `enable_value` MUST be within the enable param spec's `[min, max]` and (for `int` params) an
  integer — assert this in a test.

### 2. Backend: expose it

- Add `enable_value: float | int` to the `ExitRuleInfo` Pydantic model (`strategy_registry.py`) and
  populate it from `rule.enable_value` in `registry.list_exit_rules()`. Additive — no other API
  shape changes; `/strategies` untouched.

### 3. Frontend: prefer the backend value

- Add `enable_value: number` to the `ExitRuleInfo` TS type (`src/types/strategies.ts`) and to the
  mock catalog rows in `src/mocks/data.ts`.
- In `ExitRuleCard.handleToggle`, when enabling, use `rule.enable_value` if it is a positive number;
  otherwise fall back to `defaultEnableValue(enableSpec)` (keep the heuristic for forward-compat /
  any rule missing a value). Keep disable = set `enable_param` to 0.
- Leave `defaultEnableValue` in place as the fallback; do not delete it.

## Guardrails

> **Additive, no backtest behavior change.** This only changes the value written when a user toggles
> an exit on in the UI. `ExitStrategy`, `all_param_specs()`, presets, saved strategies, optimizer,
> and genome are untouched.

> **Backend is the source of truth.** The enable-on value lives on the rule and flows through
> `ExitRuleInfo`; the frontend does not hard-code per-exit numbers. The midpoint heuristic remains
> only as a last-resort fallback for a rule without `enable_value`.

> **Valid by construction.** Every `enable_value` is within its enable param's min/max (and integer
> where required) so a freshly toggled exit never shows a validation error.

> **Disable semantics unchanged.** Toggling off still sets `enable_param` to 0; "enabled" still means
> `enable_param > 0`.

## Tests

Backend — `tests/backtesting/test_exit_rules.py` (extend):

- Every rule's `enable_value` is within its enable param spec's `[min, max]`; int params get int
  values; `ExitStrategy({enable_param: enable_value})` enables exactly that rule.
- `list_exit_rules()` / `GET /api/v1/exit-rules` include `enable_value` for every rule.

Frontend — `tests/unit/workspaces/` (extend):

- Toggling a rule on writes `rule.enable_value` to its `enable_param` (not the midpoint), reveals its
  params, and shows no validation error.
- A rule whose `enable_value` is missing/0 falls back to `defaultEnableValue` (keep one such case).
- Toggling off zeroes the `enable_param`.

## Docs

`q_backend/README.md`: note `ExitRuleInfo.enable_value` — the recommended value applied when an exit
is toggled on in the workbench (aligned with preset values).

---

## Definition of done

- `uv run pytest` passes and `pnpm test` / `pnpm exec tsc -p tsconfig.app.json --noEmit` / `pnpm build`
  pass. **Do not report completion until all do.**
- Manually (`./dev.sh`, Strategy page): toggling each exit on yields the sensible value from the
  table above, not the old midpoint.
- Paste in the final message: the `enable_value` table actually used, the `ExitRuleInfo` change, and
  the `handleToggle` preference logic.

## Out of scope

- New exit behaviors, preset editing, or any change to the saved-strategy payload.
- Reworking `defaultEnableValue` beyond keeping it as the fallback.
- Per-user customizable default values (future).
