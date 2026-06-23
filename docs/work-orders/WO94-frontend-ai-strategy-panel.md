# WO94 — Frontend: AI strategy panel inside StrategyStudio

## Shared context (read first)

Depends on backend contracts from WO90-WO93.

Frontend `q_frontend` — React/TS/Vite, use **`pnpm`**:

- tests: `pnpm test:run`
- typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit`
- build: `pnpm build`

Read first:

- `q_frontend/docs/design/q_ai_strategy_builder.md`
- `q_frontend/docs/design/strategy-into-backtests.md`
- `q_frontend/src/components/backtests/setup/StrategyStudio.tsx`
- `q_frontend/src/lib/backtesting/useBacktestConfig.ts`
- `q_frontend/src/api/queries/strategies.ts`

Do **not** create a new standalone Strategy page. Strategy authoring already lives inside Backtests
Simulation via `StrategyStudio`.

## Goal

Add an AI authoring panel to the existing Backtests `StrategyStudio`. The panel lets the user
describe a trading idea, receives a structured draft from the backend, shows assumptions /
unsupported requests / validation errors, and previews the generated strategy spec.

This WO does not need to save revision history; WO95 owns final save/run/iterate wiring.

## Tasks

### 1. Add API client hooks

Add typed client functions/hooks for:

- `GET /api/v1/strategy-builder/capabilities`
- `POST /api/v1/strategy-builder/interpret`
- `POST /api/v1/strategy-builder/validate`
- `POST /api/v1/strategy-builder/compile`

Use the backend JSON contracts from WO90-WO93.

### 2. Add AI panel UI

Inside `StrategyStudio`, add a compact AI builder area that includes:

- message input
- submit state / error state
- conversation/draft state
- assumptions list
- unsupported requests list
- precise validation feedback
- "Ask AI to fix" action that resubmits with validation errors
- structured preview sections: name, universe, timeframe, indicators, entry, exit, risk,
  execution assumptions

Keep it visually consistent with the current setup UI. This is a working research tool, not a
marketing chatbot.

### 3. Editable preview basics

Allow lightweight manual edits where practical without building a full JSON editor:

- name
- universe/symbol list if the existing backtest form supports it
- timeframe if already represented in the setup
- risk values and supported exit values if mappings are available

If a field cannot safely map to the existing config yet, show it read-only and leave the final edit
flow to WO95.

### 4. Apply compiled draft to current setup

When the backend returns `compiled_strategy`, provide an explicit "Apply to setup" action that maps
the compiled payload into `useBacktestConfig` fields using existing hydration patterns.

Do not auto-apply silently.

### 5. Tests

Add unit/component tests for:

- panel renders in `StrategyStudio`
- submitting a prompt calls interpret endpoint
- assumptions and unsupported requests render
- validation errors render with path/code/message
- "Ask AI to fix" resubmits with validation errors
- "Apply to setup" updates strategy/params from compiled payload
- AI service unavailable renders a non-crashing error state

## Guardrails

- Frontend-only except generated API types if the repo has a local typegen pattern.
- Do not create or restore `/strategy`.
- Do not let unsupported requests disappear from the UI.
- Do not run a backtest automatically after interpretation.
- Keep existing StrategyStudio custom strategy behavior intact.

## Definition of done

- `pnpm test:run`, `pnpm exec tsc -p tsconfig.app.json --noEmit`, and `pnpm build` pass.
- Completion message must include screenshots or a concise description of the rendered panel states
  if screenshots are not available.
