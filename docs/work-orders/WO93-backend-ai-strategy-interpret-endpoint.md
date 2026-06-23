# WO93 — Backend: AI strategy interpretation endpoint

## Shared context (read first)

Depends on WO90, WO91, and WO92.

Read first:

- `q_frontend/docs/design/q_ai_strategy_builder.md`
- `q_backend` API/router patterns for external service calls/configuration

This is the first WO that may call an AI model. The model output is advisory until it passes backend
validation and deterministic compilation.

## Goal

Add `/api/v1/strategy-builder/interpret`, which converts a user message plus current draft context
into a structured `AiStrategyResponse`.

The endpoint must provide the capability registry to the model, validate model output, and return
structured unsupported requests / assumptions / questions.

## Tasks

### 1. Add request/response models

Request:

```json
{
  "message": "Create a trend strategy using EMA 20 and EMA 50.",
  "conversation": [],
  "current_spec": null,
  "capabilities_version": "q_capabilities.v1",
  "validation_errors": []
}
```

Response:

```ts
type AiStrategyResponse = {
  summary: string
  assumptions: string[]
  questions: string[]
  unsupported_requests: string[]
  strategy_spec: StrategySpec | null
  validation: StrategySpecValidationResult | null
  compiled_strategy: CompiledStrategy | null
  confidence: number
}
```

### 2. Prompt from capability registry

Build the system/developer prompt from WO90's generated capabilities. The prompt must instruct:

- use only listed capabilities
- do not output executable Python as the primary representation
- preserve validation as mandatory
- list unsupported requests instead of silently dropping them
- ask targeted questions when ambiguous
- repair previous validation errors when provided

### 3. Validate and compile model output

Flow:

```text
model output
  ↓
parse structured response
  ↓
validate StrategySpec
  ↓
compile only if valid
  ↓
return validation + compiled payload
```

If validation fails, return the invalid draft plus structured errors. Do not compile.

### 4. Configuration and failure handling

- Put provider/model/API-key config behind existing backend config conventions.
- If AI is disabled or misconfigured, return a clear service error that the frontend can render.
- Add timeout/error handling; never let a model failure run a strategy.

### 5. Tests

Use mocked model responses. Cover:

- supported prompt returns valid spec + compiled strategy
- unsupported prompt lists unsupported requests and produces no invalid runtime behavior
- validation error repair path
- malformed model JSON is rejected safely
- executable-code output is rejected
- AI disabled/misconfigured response

## Guardrails

- Do not trust the model because it saw the registry.
- Do not add autonomous multi-agent loops.
- Do not run backtests in this endpoint.
- Do not store prompts/specs persistently yet; WO95 owns save/iteration metadata.

## Definition of done

- `uv run pytest` passes for new and affected backend tests.
- Completion message must paste the final request/response JSON contract and config env names.
