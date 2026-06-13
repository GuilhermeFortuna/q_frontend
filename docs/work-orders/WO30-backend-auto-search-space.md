# WO30 — Backend: auto-derive Optuna search spaces from the strategy registry

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** this batch ("Discovery") adds **automatic strategy search** — point
the system at an instrument + date range and have it sweep every registered strategy,
optimize each, walk-forward-validate each, and return a leaderboard ranked on out-of-sample
performance. The sweep cannot ask the user to hand-write an Optuna search space per strategy,
so the first piece is the bridge that makes a search space **fall out of the registry**: each
strategy already declares its parameters with bounds (`min`/`max`/`step`/`choices`). This WO
turns those declarations into a `SearchSpaceConfig` automatically. It is **backend only, pure
compute** — no API route, no DB, no new strategy. WO31 consumes it.

---

## How parameters and search spaces are modeled today (read these files)

- `src/q_backend/backtesting/strategy_registry.py` — the registry.
  - `StrategyParamSpec` (~line 16): `name`, `label`, `type` (`"int" | "float" |
"categorical"`), `default`, `min`, `max`, `step`, `choices`, `hint`.
  - `StrategyInfo.params: list[StrategyParamSpec]` is the per-strategy param list.
  - `get_registered_strategy(name)` / `list_registered_strategies()` /
    `default_params_for(name)` — the access functions.
  - `StrategyInfo.engine` is `"candle"` or `"tick"`.
- `src/q_backend/optimization/models.py` — the search-space target types:
  - `IntParam(low, high, step=1)`, `FloatParam(low, high, step=None)`,
    `LogFloatParam(low, high)`, `CategoricalParam(choices)`, the `SearchParam` discriminated
    union, and `SearchSpaceConfig(strategy_params: dict[str, SearchParam],
risk_params: dict[str, SearchParam])`.
- `src/q_backend/optimization/search_space.py` — how the space is **consumed**:
  `suggest_params` reads `search_space.strategy_params` / `search_space.risk_params` and
  `build_position_sizing_config` reads `risk_params` keys (`type`, `quantity`,
  `safety_margin_per_contract`, `min_contracts`, `max_contracts`). Your `risk_params`
  helper must emit keys these functions already understand.

---

## Goal

A pure module that, given a strategy name, returns the `SearchSpaceConfig` an optimizer
would otherwise be hand-fed — every **bounded** param searched, every **unbounded** param
pinned to its default.

## Tasks

### 1. New module `src/q_backend/optimization/auto_search_space.py`

```python
def derive_strategy_search_space(strategy_name: str) -> tuple[SearchSpaceConfig, dict]:
    """Return (search_space, fixed_params).

    search_space.strategy_params holds the params that will be searched; fixed_params holds
    the {name: default} of params that cannot be searched (kept constant during the study).
    """
```

Mapping rule, per `StrategyParamSpec`:

| spec.type     | condition                         | → contribution                                                         |
| ------------- | --------------------------------- | ---------------------------------------------------------------------- |
| `int`         | `min` and `max` set, `min < max`  | `IntParam(low=int(min), high=int(max), step=int(step) if step else 1)` |
| `float`       | `min` and `max` set, `min < max`  | `FloatParam(low=min, high=max, step=step)`                             |
| `categorical` | `choices` set, `len(choices) > 1` | `CategoricalParam(choices=choices)`                                    |
| any           | otherwise (no/degenerate bounds)  | **fixed** → `fixed_params[name] = default`                             |

- Pure function, no I/O. Unknown strategy → propagate the registry's `ValueError`
  (`get_registered_strategy` already raises it).
- A `categorical` with a single choice, or an int/float with `min == max`, is **fixed** (a
  one-value search dimension is wasteful and Optuna-noisy) — verify the strict `min < max`.

### 2. Risk / position-sizing search-space helper

```python
def default_risk_search_space() -> SearchSpaceConfig: ...
```

Return a small, sane default `risk_params` space whose keys match what
`build_position_sizing_config` (`search_space.py`) consumes. Keep it conservative — a
`fixed_safety_margin` sizing with a searched `safety_margin_per_contract` over a modest range
is a fine default; **do not** invent keys the builder doesn't read. WO31 will let a caller
override or disable this; here just provide the default and document each key with a comment.

### 3. Convenience surface

```python
def auto_search_space(strategy_name: str, *, include_risk: bool = True) -> SearchSpaceConfig:
    """strategy_params from derive_strategy_search_space + (optionally) the default risk space."""
```

So WO31 can get a complete `SearchSpaceConfig` in one call. The `fixed_params` from task 1
must be retrievable too (WO31 merges them into every trial's params) — either return them
from a paired call or expose `derive_strategy_search_space` directly; document which.

### 4. Tests — `tests/.../test_auto_search_space.py`

- **Parametrized over every registered candle strategy** (`list_registered_strategies()`):
  for each, assert that every param with valid bounds appears in
  `search_space.strategy_params` with the right `SearchParam` subtype, and every unbounded
  param appears in `fixed_params` at its `default`. (This is the regression guard — it will
  catch a future strategy that ships params the sweep can't handle.)
- Boundary cases on a synthetic `StrategyInfo`: `min == max` → fixed; single-choice
  categorical → fixed; float with `step=None` → `FloatParam(step=None)`; int with no `step`
  → `IntParam(step=1)`.
- `default_risk_search_space()` produces only keys that `build_position_sizing_config`
  accepts (assert by actually calling the builder on a sampled dict and getting a valid
  config, not by hard-coding key names twice).
- Unknown strategy name raises `ValueError`.

### 5. Docs

A short docstring at module top explaining the "bounded → searched, unbounded → fixed"
contract and that this is the bridge enabling registry-wide strategy search (WO31).

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- No existing file changed except the new module + its test (and an `__init__` export only if
  the package conventionally re-exports — check `optimization/__init__.py` first).
- In your final message, paste the signatures of the three public functions and one real
  example: the `SearchSpaceConfig` + `fixed_params` derived for `MACrossover`.

## Out of scope

- Any optimizer/runner/API/DB change (WO31+ consume this).
- Tick strategies (WO31 filters engine; this module may still derive a space for them, but
  don't special-case — the registry's `params` are engine-agnostic here).
- `LogFloatParam` inference (the registry has no log hint; keep float→`FloatParam`). Note it
  as a possible future refinement, don't build it.
- Wiring an "auto-fill search space" button into the existing Optimize form (separate
  follow-up once this lands).
