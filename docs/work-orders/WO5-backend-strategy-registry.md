# WO5 — Backend: strategy registry + library + schema endpoint

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** the backtesting engine ships exactly ONE strategy. `build_strategy`
in `src/q_backend/backtesting/factory.py` is a hardcoded `if name == "MACrossover"` branch,
and `MACrossoverStrategy` is the only `TradingStrategy` subclass. We are adding a strategy
**registry**, a small **library** of new strategies, and a **schema endpoint** so the
frontend can render strategy/param forms dynamically. Match the style of surrounding code.
Do not add new dependencies without asking. This work order is **backend only.**

---

## How the strategy system works today (read these files)

- `src/q_backend/backtesting/strategy.py` — `TradingStrategy` ABC with four abstract methods:
  `compute_indicators(df)`, `check_entry_conditions(row)`, `check_exit_conditions(row, open_trades)`,
  `get_chart_indicators()`. Also defines `ChartIndicatorSpec(key, label, pane, color)`.
  `MACrossoverStrategy` is the reference implementation — mirror its structure.
- `src/q_backend/backtesting/chart_data.py` — `serialize_chart_data` AUTO-EMITS any indicator
  column a strategy declares via `get_chart_indicators()`. New strategies' indicators reach the
  frontend chart with no frontend changes, as long as the column exists and a spec is declared.
- `src/q_backend/backtesting/moving_averages.py` — `compute_ma`, MA-type helpers. There are NO
  RSI/MACD/Bollinger/Donchian helpers yet — you will implement them in pandas.
- `src/q_backend/optimization/search_space.py` — `suggest_params` is ALREADY strategy-agnostic:
  it iterates an arbitrary `strategy_params` dict. **Do NOT modify it.** New strategies optimize
  for free as long as they accept their declared param names.

---

## Goal

Make strategies pluggable and ship a useful starter library, without changing the behavior of
the existing `MACrossover` strategy or the existing request/response shapes.

## Tasks

### 1. Strategy registry

Introduce a registry mapping `name -> {strategy class, metadata, param schema}`. A decorator
(`@register_strategy(...)`) or an explicit dict in `factory.py` is fine — keep it simple and in
keeping with the codebase. Rewrite `build_strategy(name, params, symbol)` to dispatch through
the registry instead of the `if/elif`. Unknown names still raise `ValueError`.

> **GUARDRAIL — back-compat.** `MACrossover` MUST remain registered under the exact same name,
> with the same default params and identical behavior. The existing request shape
> (`strategy: "MACrossover"`, `strategy_params: {short_period, long_period, short_ma_type,
long_ma_type, threshold}`) must keep working unchanged — existing tests, MSW mocks, and the
> frontend depend on it.

### 2. Per-strategy parameter schema

Each registered strategy declares a typed parameter schema (Pydantic). Define models, e.g.:

```python
class StrategyParamSpec(BaseModel):
    name: str
    label: str
    type: Literal["int", "float", "categorical"]
    default: int | float | str
    min: float | None = None        # int/float only
    max: float | None = None        # int/float only
    step: float | None = None       # int/float only
    choices: list[str] | None = None  # categorical only

class StrategyInfo(BaseModel):
    name: str
    label: str
    description: str
    params: list[StrategyParamSpec]
```

The `type` values map 1:1 to the optimization `SearchParam` kinds (int/float/categorical) and to
frontend form widgets, so this schema serves both. Provide the `MACrossover` schema first
(short_period int, long_period int, short_ma_type/long_ma_type categorical over the existing MA
types, threshold float) and confirm it round-trips the current defaults.

### 3. New strategies

Add four strategies (suggested: one module each under a `backtesting/strategies/` package, or
new classes alongside `MACrossoverStrategy` — match the codebase). Each implements all four ABC
methods, declares chart indicators, and registers with a param schema:

- **RSI mean-reversion** — params: `period` (int), `oversold` (float), `overbought` (float).
  Buy when RSI crosses up out of oversold, exit/short on overbought. RSI on an `oscillator` pane.
- **Bollinger-band reversion** — params: `period` (int), `num_std` (float). Bands on the `price`
  pane; enter on band touch/cross, exit on mean reversion to the middle band.
- **MACD** — params: `fast_period`, `slow_period`, `signal_period` (ints). MACD + signal on an
  `oscillator` pane; signal-line crossovers.
- **Donchian breakout** — params: `period` (int). Upper/lower channel on the `price` pane;
  breakout entries.

> **GUARDRAIL — no lookahead bias.** Follow the `MACrossover` pattern exactly: precompute all
> indicators vectorized in `compute_indicators`, precompute boolean trigger columns, and use
> `.shift(1)` for any crossover so a bar's signal never depends on its own or future data.
> `check_entry_conditions`/`check_exit_conditions` must only read the current row's precomputed
> columns. This is the #1 correctness trap — get it right per strategy.

### 4. Schema endpoint

Add `GET /api/v1/strategies` to `api/main.py` returning the registry:

```json
{
  "strategies": [
    {
      "name": "MACrossover",
      "label": "MA Crossover",
      "description": "Short/long moving-average crossover.",
      "params": [
        {
          "name": "short_period",
          "label": "Short Period",
          "type": "int",
          "default": 50,
          "min": 2,
          "max": 400,
          "step": 1
        },
        {
          "name": "long_period",
          "label": "Long Period",
          "type": "int",
          "default": 200,
          "min": 2,
          "max": 400,
          "step": 1
        },
        {
          "name": "short_ma_type",
          "label": "Short MA Type",
          "type": "categorical",
          "default": "sma",
          "choices": ["sma", "ema", "wma", "smma", "hma"]
        },
        {
          "name": "long_ma_type",
          "label": "Long MA Type",
          "type": "categorical",
          "default": "sma",
          "choices": ["sma", "ema", "wma", "smma", "hma"]
        },
        {
          "name": "threshold",
          "label": "Threshold",
          "type": "float",
          "default": 0.0,
          "min": 0.0,
          "max": 100.0,
          "step": 0.01
        }
      ]
    }
  ]
}
```

This is a pure read, no DB. No `get_session` dependency needed.

### 5. Tests

- Registry: `build_strategy` dispatches each registered name; unknown name raises `ValueError`;
  `MACrossover` still builds with identical defaults.
- Per strategy: `compute_indicators` produces the declared indicator columns; a crafted price
  series produces the expected entry/exit signals; assert no lookahead (a signal at bar `i` does
  not depend on data after `i` — e.g. shifting the tail of the series doesn't change earlier
  signals).
- `GET /api/v1/strategies` returns all strategies with valid schemas.

### 6. Docs

Update `q_backend/README.md`: list the new strategies and document `GET /api/v1/strategies`.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- In your final message, paste the exact `GET /api/v1/strategies` response for ALL strategies —
  the frontend work order (WO6) builds its forms against this schema.

## Out of scope

- Any frontend change.
- Modifying `optimization/search_space.py` — it is already strategy-agnostic.
- Changing `MACrossover` behavior, defaults, or its request/response shape.
- New third-party dependencies (implement indicators in pandas/numpy).
