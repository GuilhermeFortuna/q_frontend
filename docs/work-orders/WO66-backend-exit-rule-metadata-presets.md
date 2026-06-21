# WO66 — Backend: exit-rule metadata + presets catalog for the workbench

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** the WO61–64 batch made exits composable, but the Strategy-page workbench
still renders them as a flat wall of number inputs that all default to `0` ("set to 0 to disable").
Users can't tell what's active or how params group into a coherent exit. The fix is a **toggle-card**
workbench (**WO67**): each exit is a card with an on/off switch that reveals its params, plus an
"active exits" summary and one-click **presets**.

That UI needs structured metadata the backend does not expose yet: today `GET /api/v1/strategies`
returns a **flat** `params` list per strategy, with only `exit_group` to hint grouping. This WO adds
the metadata layer — **which params form one exit rule, the rule's label/description, its enable
param, and a catalog of named presets** — and exposes it via the API. Frontend consumption is WO67;
**this WO is backend-only.** Do this **after WO65** (it relies on `atr_period` being `exit_group=
"general"`).

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/exit_rules/base.py` — `ExitRule` (`id`, `exit_group`, `param_specs`,
  `is_enabled`, `required_columns`, `on_bar`, `should_exit`). Rules know their own param names but do
  **not** yet expose a human label/description or a designated "enable" param.
- `src/q_backend/backtesting/exit_rules/registry.py` — `EXIT_RULES`, `all_param_specs()` (flat,
  deduped), `enabled_rules`, `required_columns`.
- `src/q_backend/backtesting/exit_rules/*.py` — each concrete rule; the param that toggles it is the
  one `is_enabled` checks (e.g. `chandelier_atr_mult`, `breakeven_trigger_pct`,
  `donchian_exit_period`, `max_bars_in_trade`, `psar_af_start`, `target_ratchet_atr`, and the legacy
  `stop_loss_pct` / `take_profit_pct` / `trailing_stop_pct` / `stop_loss_atr` / `take_profit_atr`).
- `src/q_backend/backtesting/strategy_registry.py` — `StrategyParamSpec`, `StrategyInfo`,
  `StrategiesResponse`, `register_strategy` (merges `get_exit_strategy_params()` into candle
  strategies), `list_registered_strategies()`.
- `src/q_backend/api/routers/strategies.py` — `GET /api/v1/strategies` →
  `{"strategies": list_registered_strategies()}`.
- (WO65) `atr_period` is `exit_group="general"` — a shared indicator setting, not owned by one rule.

---

## Goal

```jsonc
// New, additive payload the workbench can build toggle cards + presets from:
{
  "exit_rules": [
    {
      "id": "chandelier",
      "label": "Chandelier Exit",
      "exit_group": "trailing",
      "description": "Trailing stop at peak high minus an ATR multiple.",
      "enable_param": "chandelier_atr_mult",
      "param_names": ["chandelier_atr_mult"],
      "required_param_names": ["atr_period"],
    }, // shared (general) params it depends on
    // ...one per rule...
  ],
  "shared_exit_params": ["atr_period"], // exit_group == "general"
  "exit_presets": [
    {
      "id": "atr_stop_chandelier",
      "label": "ATR stop + Chandelier trail",
      "description": "Volatility stop with a trailing lock as the trend runs.",
      "parameters": { "stop_loss_atr": 2.0, "atr_period": 14, "chandelier_atr_mult": 3.0 },
    },
    // ...
  ],
}
```

The existing flat `params` list stays on each strategy (unchanged); this is **additional** structure.

## Tasks

### 1. Per-rule descriptive metadata

Give each `ExitRule` (in `base.py` as fields, set by each concrete rule) a human `label: str`,
`description: str`, and an `enable_param: str` (the param `is_enabled` keys off). Add a method/attr
`param_names() -> list[str]` (the names this rule owns, in display order, **excluding** shared
`general` params) and `required_param_names()` (shared params it needs, e.g. `atr_period`). Keep it
declarative; do not change runtime behavior.

### 2. `ExitRuleInfo` schema + registry assembler

In `strategy_registry.py` (or `exit_rules/`), add Pydantic `ExitRuleInfo`
(`id, label, description, exit_group, enable_param, param_names, required_param_names`). Add
`registry.list_exit_rules() -> list[ExitRuleInfo]` and
`registry.shared_exit_params() -> list[str]` (names whose spec `exit_group == "general"`).

### 3. Presets catalog

Add `exit_rules/presets.py`: a hand-curated `EXIT_PRESETS: list[ExitPreset]` (Pydantic
`ExitPreset{ id, label, description, parameters: dict[str, float|int] }`). Seed ~4–6 sensible
combos, e.g.:

- **ATR stop + Chandelier trail** (`stop_loss_atr`, `atr_period`, `chandelier_atr_mult`)
- **Break-even + Time stop** (`breakeven_trigger_pct`, `breakeven_offset_pct`, `max_bars_in_trade`)
- **Fixed % bracket** (`stop_loss_pct`, `take_profit_pct`)
- **Parabolic SAR trail** (`psar_af_start`, `psar_af_step`, `psar_af_max`)
- **Donchian channel trail** (`donchian_exit_period`)
- **Ratchet target + ATR stop** (`target_ratchet_atr`, `stop_loss_atr`, `atr_period`)

Each preset's `parameters` keys MUST be real exit param names (validate against
`all_param_specs()` in a test).

### 4. Expose via API (additive, non-breaking)

Add a `GET /api/v1/exit-rules` endpoint in `api/routers/strategies.py` returning
`{ "exit_rules": [...], "shared_exit_params": [...], "exit_presets": [...] }` (a Pydantic
`ExitRuleCatalogResponse`). Do **not** change the shape of `GET /api/v1/strategies` — the flat
`params` per strategy stays as-is so nothing else breaks.

## Guardrails

> **Purely additive.** No change to `ExitStrategy` runtime, to `all_param_specs()`, to the
> `/strategies` payload shape, or to saved-strategy storage. Optimizer/genome untouched.

> **Single source of truth.** Rule labels/descriptions/enable-params live on the rule objects;
> the catalog is assembled from the registry, not hand-duplicated. Every preset param name and every
> `enable_param`/`param_names`/`required_param_names` entry must resolve to a real spec — test it.

> **`atr_period` is shared.** It appears in `shared_exit_params`, not in any single rule's
> `param_names` (rules that need it list it under `required_param_names`). Depends on WO65.

> **Determinism of catalog.** Stable ordering (group order, then rule order) so the UI is stable.

## Tests — `tests/backtesting/test_exit_rules.py` + `tests/api/test_strategies_routes.py` (extend/new)

- Every `ExitRuleInfo.enable_param` and each name in `param_names`/`required_param_names` exists in
  `all_param_specs()`; `enable_param` is the same param `is_enabled` checks (toggle a preset's
  enable param and assert the rule becomes enabled).
- `shared_exit_params() == ["atr_period"]` (all `general` specs).
- Every `EXIT_PRESETS` entry: unique `id`, non-empty label/description, all parameter keys valid,
  and applying it via `ExitStrategy(preset.parameters)` enables exactly the intended rules.
- `GET /api/v1/exit-rules` returns the three keys with the expected counts; `GET /api/v1/strategies`
  payload is **unchanged** (snapshot/contract test stays green).

## Docs

`q_backend/README.md`: document the `/api/v1/exit-rules` catalog (rule metadata, shared params,
presets) and that it powers the workbench toggle cards + presets.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- `GET /api/v1/exit-rules` returns rule metadata, `shared_exit_params`, and the presets catalog;
  `/strategies` is unchanged.
- Paste in the final message: the `ExitRuleInfo`/`ExitPreset` schemas, the endpoint contract, and
  the preset list with their param maps.

## Out of scope

- Any frontend rendering — **WO67** (toggle cards/presets) and **WO68** (layout).
- New exit behaviors / PSAR + `atr_period` fixes — **WO65**.
- Per-user saved presets / editing presets in the UI (v2).
