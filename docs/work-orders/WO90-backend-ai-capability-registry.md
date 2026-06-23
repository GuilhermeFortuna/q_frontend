# WO90 — Backend: AI strategy-builder capability registry

## Shared context (read first)

Two-repo project:

- Backend `q_backend` — Python/FastAPI, use **`uv`** / `uv run pytest` (never pip/poetry).
- Frontend `q_frontend` — React/TS/Vite, use **`pnpm`** (not touched here).

Read first:

- `q_frontend/docs/design/q_ai_strategy_builder.md`
- `q_frontend/docs/design/genetic-strategy-search.md`
- `q_frontend/docs/design/feature-engine.md`
- `q_backend/src/q_backend/backtesting/strategy_registry.py`
- `q_backend/src/q_backend/backtesting/genome/node_specs.py`
- `q_backend/src/q_backend/backtesting/genome/param_bounds.py`
- `q_backend/src/q_backend/backtesting/exit_rules/`

The AI strategy builder must be constrained by backend truth. Do **not** hand-maintain a separate
capabilities list that can drift from the registry, genome DSL, exit-rule catalog, or execution
contract.

## Goal

Expose a machine-readable `q_capabilities.v1` document that tells the AI interpreter exactly what Q
can build and run today.

This is backend-only. It does not call any model.

## Tasks

### 1. Add capability models

Create typed Pydantic models for:

- `CapabilityRegistry`
- supported markets / engines / timeframes / data columns
- supported strategy registry entries
- supported genome node kinds and output/input types
- supported operators / condition groups
- supported exit rules
- supported risk / sizing knobs
- execution assumptions (`closed_bar`, `next_bar_open`, long-only vs short-capable)
- explicit unsupported capabilities

Schema version must be `"q_capabilities.v1"`.

### 2. Generate from existing backend truth

Build the registry from existing code:

- strategy registry for built-in strategies and param specs
- genome `NODE_SPECS` for composable primitives
- genome param bounds for optimizer/search ranges
- exit-rule registry and param specs
- engine/timeframe/data-column support from the current API/config paths

Manual constants are allowed only for product-level unsupported items such as live execution,
broker routing, order book depth, options Greeks, and fundamental data.

### 3. Add API endpoint

Add:

```http
GET /api/v1/strategy-builder/capabilities
```

Return the generated registry. Keep the response deterministic: stable ordering for arrays, stable
schema field order where practical, and no runtime-only noise.

### 4. Add drift protection tests

Tests should prove:

- all registered genome node kinds appear in capabilities
- all registered exit rules appear in capabilities
- known unsupported features appear in the unsupported list
- response validates against `CapabilityRegistry`
- output ordering is deterministic

## Guardrails

- Do not duplicate strategy execution semantics in the capability layer.
- Do not add AI/model dependencies.
- Do not change existing strategy, backtest, optimization, or discovery behavior.
- The capabilities endpoint is descriptive; validation and compilation happen in later WOs.

## Definition of done

- `uv run pytest` passes for the new and affected backend tests.
- Final message must paste the endpoint path and the top-level `schema_version`.
