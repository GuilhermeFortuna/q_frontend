# WO95 — Frontend/backend: save, run, export, and iterate AI StrategySpecs

## Shared context (read first)

Depends on WO90-WO94.

This WO finishes the end-to-end workflow:

```text
Prompt → StrategySpec → validation → deterministic compile → apply → save/run/export/iterate
```

Read first:

- `q_frontend/docs/design/q_ai_strategy_builder.md`
- `q_frontend/docs/design/strategy-into-backtests.md`
- `q_frontend/src/components/backtests/setup/StrategyStudio.tsx`
- `q_frontend/src/lib/backtesting/useBacktestConfig.ts`
- backend custom strategy save endpoints/models

## Goal

Make AI-authored strategies first-class artifacts that can be saved, duplicated, exported, run in
Simulation, and optimized while preserving traceability.

## Tasks

### 1. Persist AI strategy metadata

Extend the save path to preserve, additively:

- `strategy_spec`
- `strategy_spec_version`
- `capabilities_version`
- original prompt
- assumptions
- unsupported requests acknowledged by the user
- compiled strategy id/hash
- compiled strategy payload or reference

Use existing custom strategy persistence where possible. Do not break existing custom strategies.

### 2. Explicit unsupported-request acknowledgement

If the model returned unsupported requests and also produced a closest supported spec, require the
user to acknowledge that unsupported parts were excluded before saving or running.

### 3. Run and optimize from the compiled payload

Wire actions:

- Run backtest from applied compiled config
- Save strategy
- Duplicate strategy
- Optimize parameters where existing optimization/search-space support can safely infer ranges
- Export `StrategySpec` JSON

Use existing Backtests/Optimize request builders. Avoid one-off payload builders.

### 4. Revision and iteration basics

Store client-side revision state during the session:

- previous prompt/spec/validation result
- compare latest vs previous spec at a coarse section level
- reset draft

Full historical revision browsing can be deferred, but saved artifacts must contain enough metadata
for it later.

### 5. Backend tests

If persistence models/endpoints change, add tests that:

- old custom strategies still load
- AI metadata is optional/additive
- saved AI spec round-trips
- compiled payload hash is deterministic

### 6. Frontend tests

Add tests that:

- save payload includes AI metadata
- unsupported requests block save/run until acknowledged
- run backtest uses the applied compiled config
- duplicate preserves spec metadata but creates an editable draft
- export downloads/creates valid `strategy_spec.v1` JSON
- existing non-AI custom strategy save/load still works

## Guardrails

- Do not change existing backtest or optimize payload shapes except additive metadata where the
  backend contract explicitly supports it.
- Do not store secrets or raw provider credentials in prompts/metadata.
- Do not claim profitability or turn this into autonomous strategy discovery.
- Do not bypass validation/compilation for save or run.

## Definition of done

- Backend affected tests pass with `uv run pytest`.
- Frontend tests/typecheck/build pass:
  - `pnpm test:run`
  - `pnpm exec tsc -p tsconfig.app.json --noEmit`
  - `pnpm build`
- Completion message must paste one saved AI-strategy metadata payload shape and confirm old custom
  strategies still round-trip.
