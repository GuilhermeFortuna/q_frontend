# WO91 — Backend: StrategySpec v1 schema and validator

## Shared context (read first)

Depends on WO90.

Read first:

- `q_frontend/docs/design/q_ai_strategy_builder.md`
- `q_frontend/docs/design/genetic-strategy-search.md`
- `q_backend/src/q_backend/backtesting/genome/validate.py`
- `q_backend/src/q_backend/backtesting/genome/node_specs.py`
- `q_backend/src/q_backend/backtesting/strategy_registry.py`

`StrategySpec` is a user-facing authoring shape for the AI builder. It must not become an
unbounded second runtime DSL. Treat it as a strict, typed, friendly wrapper/subset over Q's existing
strategy capabilities, especially `CompositeStrategy` where composable rules are needed.

## Goal

Define `strategy_spec.v1` and a backend validator that returns stable, structured validation errors.
The validator is authoritative even when the LLM was given the capability registry.

## Tasks

### 1. Add StrategySpec models

Create Pydantic models for:

- `StrategySpec`
- `IndicatorSpec`
- condition tree (`all`, `any`, comparisons)
- exit rules
- risk/sizing
- execution assumptions
- validation result and validation error

Minimum fields:

```json
{
  "schema_version": "strategy_spec.v1",
  "name": "...",
  "universe": ["..."],
  "market": "...",
  "timeframe": "...",
  "indicators": [],
  "entry": {},
  "exit": {},
  "risk": {},
  "execution_assumptions": {}
}
```

### 2. Keep the MVP scope narrow

Support only:

- long-only strategies
- OHLCV data
- closed-bar signals
- next-bar-open entries
- fixed-size / fixed-fraction sizing if already supported
- simple indicators represented in Q capabilities
- `all` / `any`
- comparison and cross operators supported by the backend
- explicit exit logic

Reject live trading, arbitrary Python, unsupported data sources, order book logic, and any
execution assumption not already supported.

### 3. Add structured validation

Return:

```json
{
  "valid": false,
  "errors": [
    {
      "path": "indicators[0].type",
      "code": "unsupported_indicator",
      "message": "Indicator 'supertrend' is not currently supported.",
      "suggestions": ["atr", "ema", "donchian"]
    }
  ]
}
```

Use stable `code` values. Include suggestions where the capability registry makes obvious
alternatives available.

### 4. Add validate endpoint

Add:

```http
POST /api/v1/strategy-builder/validate
```

Input:

```json
{ "strategy_spec": {} }
```

Output: validation result.

### 5. Test fixture cases

Add tests for:

- valid EMA cross style strategy
- valid Donchian breakout style strategy
- unsupported indicator
- unsupported timeframe
- missing exit logic
- unsupported live-trading assumption
- unknown symbol/universe behavior if symbol validation exists today
- model rejects executable Python/code fields

## Guardrails

- Do not compile or run strategies in this WO.
- Do not call an LLM.
- Do not weaken existing genome or strategy registry validation.
- Keep `StrategySpec` versioned and additive-friendly.

## Definition of done

- `uv run pytest` passes for new and affected backend tests.
- Completion message must paste the validation endpoint and list the stable error codes added.
