# WO92 — Backend: deterministic StrategySpec compiler

## Shared context (read first)

Depends on WO90 and WO91.

Read first:

- `q_frontend/docs/design/q_ai_strategy_builder.md`
- `q_frontend/docs/design/genetic-strategy-search.md`
- `q_backend/src/q_backend/backtesting/genome/composite_strategy.py`
- `q_backend/src/q_backend/backtesting/genome/validate.py`
- `q_backend/src/q_backend/backtesting/genome/search_space.py`
- `q_backend/src/q_backend/backtesting/strategy_registry.py`
- `q_backend/src/q_backend/api/routers/backtests.py`

The compiler must be deterministic and app-owned. The LLM never decides runtime semantics.

## Goal

Compile a valid `StrategySpec` into Q's existing runnable representation:

- preferably `CompositeStrategy` + genome JSON for composable rule strategies, or
- an existing registry strategy + params when the spec exactly maps to a built-in strategy.

Do not create a parallel execution engine.

## Tasks

### 1. Add compile service

Implement:

```python
validate_strategy_spec(spec)
compile_strategy_spec(spec) -> CompiledStrategy
```

`CompiledStrategy` should include:

- deterministic id/hash
- source `schema_version`
- runnable strategy name (`CompositeStrategy` or registry strategy)
- fixed params / genome / strategy params needed by existing backtest paths
- human-readable summary metadata

### 2. Map StrategySpec to existing runtime semantics

For composable indicator/rule specs, emit a valid genome that passes existing genome validation.
Preserve existing semantics:

- closed-bar signals
- next-bar-open fills
- cross operators use existing causal cross semantics
- exits route through existing exit-rule / engine paths where possible
- no generated Python

### 3. Add compile endpoint

Add:

```http
POST /api/v1/strategy-builder/compile
```

Input:

```json
{ "strategy_spec": {} }
```

Output includes the compiled strategy payload, not just a status string, so WO94/WO95 can run it
without inventing a client-side mapping.

### 4. Add regression/parity tests

Cover at least:

- EMA cross strategy compiles to valid runnable config
- RSI mean-reversion style spec compiles
- Donchian breakout style spec compiles
- Bollinger style spec compiles if supported in WO91
- fixed stop/take-profit exit rules compile through existing exit params
- compiler output is deterministic for semantically identical specs
- invalid specs fail before compilation with WO91 validation errors

Where possible, run a tiny backtest fixture to prove the compiled payload reaches the existing
backtest engine.

## Guardrails

- No LLM calls.
- No new strategy execution semantics.
- No broad refactor of `CompositeStrategy`.
- If a mapping cannot be expressed safely in the existing genome/registry path, reject it with a
  structured validation/compile error instead of inventing behavior.

## Definition of done

- `uv run pytest` passes for new and affected backend tests.
- Completion message must paste one compiled EMA-cross response shape and state whether it maps to
  `CompositeStrategy` or a built-in registry strategy.
