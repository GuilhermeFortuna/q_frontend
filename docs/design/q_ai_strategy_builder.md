# Q Capability Proposal: Constrained AI Strategy Builder

## Summary

The **Constrained AI Strategy Builder** is a proposed Q workspace where a user describes a trading idea in natural language and the system converts that intent into a safe, validated, app-native strategy definition.

The core idea is not to let the AI freely generate and execute code.

Instead, the AI acts as a bridge between:

```text
Human trading idea
  ↓
AI interpretation
  ↓
Structured StrategySpec
  ↓
Backend validation
  ↓
Deterministic compilation
  ↓
Backtest / optimization / save
```

This keeps the feature powerful while preventing the model from inventing unsupported backend behavior, generating unsafe code, or producing strategies that cannot actually run inside Q.

---

## Product Positioning

This feature should be framed as:

> Describe a trading idea. Q converts it into a reproducible, testable strategy definition.

It should **not** be framed as:

> AI creates profitable trading strategies automatically.

The value is in removing friction between the user's intent and the backend's research/backtesting capabilities.

---

## Core Principle

The AI must be constrained by the backend's actual capabilities.

That means the model is not allowed to invent arbitrary indicators, risk models, execution semantics, data sources, broker features, or market assumptions. It can only compose strategies using capabilities that Q explicitly exposes.

The correct design is:

```text
User prompt
  ↓
LLM produces structured JSON
  ↓
Backend validates JSON against supported capabilities
  ↓
Backend compiles JSON into app-native strategy representation
```

Avoid this:

```text
User prompt
  ↓
LLM writes Python
  ↓
App executes generated Python
```

Free-form code generation is too risky for this system because it introduces security, correctness, reproducibility, and hallucination problems.

---

## Why This Matters

Trading systems are especially sensitive to small mistakes.

A strategy definition can look valid while hiding serious problems:

- lookahead bias
- unsupported indicators
- wrong timeframe assumptions
- incorrect order timing
- invalid stop logic
- impossible fills
- missing transaction costs
- incorrect position sizing
- broken symbol resolution
- unsupported data columns
- unsafe live-trading assumptions

The AI should help the user express ideas faster, but the backend should remain the authority on what can actually run.

---

## Capability-Constrained Architecture

```text
┌────────────────────────────┐
│ User Chat Input            │
│ "Buy when EMA 20 crosses…" │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ AI Strategy Interpreter    │
│ Converts intent to spec    │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ StrategySpec JSON / DSL    │
│ Structured, typed, limited │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ Capability Validator       │
│ Rejects unsupported logic  │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ Strategy Compiler          │
│ Deterministic app-owned    │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ Backtest / Optimize / Save │
└────────────────────────────┘
```

The LLM translates.  
The backend validates.  
The compiler generates.  
The engine runs.

---

## Main Components

### 1. Strategy Studio Page

A frontend workspace where the user can chat with the AI model and iteratively build a trading strategy.

Suggested layout:

```text
┌──────────────────────────────┬──────────────────────────────┐
│ AI Chat                      │ Strategy Preview              │
│                              │                              │
│ "Create a breakout strategy" │ Name                         │
│                              │ Universe                     │
│                              │ Timeframe                    │
│                              │ Indicators                   │
│                              │ Entry rules                  │
│                              │ Exit rules                   │
│                              │ Risk model                   │
├──────────────────────────────┴──────────────────────────────┤
│ Validate → Save Strategy → Run Backtest → Optimize           │
└──────────────────────────────────────────────────────────────┘
```

The chat should feel like a strategy-building interface, not a generic chatbot.

---

### 2. StrategySpec

A structured intermediate representation of the trading strategy.

Example:

```json
{
  "name": "EMA Trend Pullback",
  "universe": ["AAPL"],
  "market": "US",
  "timeframe": "1d",
  "data_requirements": {
    "columns": ["open", "high", "low", "close", "volume"]
  },
  "indicators": [
    {
      "id": "ema_fast",
      "type": "ema",
      "source": "close",
      "period": 20
    },
    {
      "id": "ema_slow",
      "type": "ema",
      "source": "close",
      "period": 50
    }
  ],
  "entry": {
    "all": [
      {
        "left": "ema_fast",
        "op": ">",
        "right": "ema_slow"
      },
      {
        "left": "close",
        "op": "crosses_above",
        "right": "ema_fast"
      }
    ]
  },
  "exit": {
    "any": [
      {
        "left": "ema_fast",
        "op": "<",
        "right": "ema_slow"
      },
      {
        "type": "stop_loss",
        "mode": "percent",
        "value": 0.03
      }
    ]
  },
  "risk": {
    "position_sizing": "fixed_fraction",
    "risk_per_trade": 0.01
  },
  "execution_assumptions": {
    "signal_timing": "closed_bar",
    "entry_timing": "next_bar_open",
    "allow_short": false
  }
}
```

This spec should be versioned.

Example:

```json
{
  "schema_version": "strategy_spec.v1"
}
```

---

### 3. Capability Registry

The backend should expose a machine-readable registry describing what the system currently supports.

Example:

```json
{
  "schema_version": "q_capabilities.v1",
  "data": {
    "markets": ["US", "B3"],
    "timeframes": ["1d", "1h", "15m", "5m"],
    "columns": ["open", "high", "low", "close", "volume"],
    "providers": ["yfinance"]
  },
  "indicators": ["sma", "ema", "rsi", "atr", "donchian", "bollinger_bands"],
  "operators": [">", "<", ">=", "<=", "crosses_above", "crosses_below"],
  "condition_groups": ["all", "any"],
  "risk_models": ["fixed_size", "fixed_fraction", "volatility_target"],
  "execution_assumptions": {
    "supported_signal_timing": ["closed_bar"],
    "supported_entry_timing": ["next_bar_open"]
  },
  "unsupported": [
    "live_order_execution",
    "broker_routing",
    "order_book_depth",
    "intrabar_fill_simulation",
    "options_greeks",
    "fundamental_data"
  ]
}
```

The AI prompt should include this registry so the model knows the boundaries.

The backend should still validate everything, even if the AI was given the registry.

---

### 4. AI Strategy Interpreter

The AI receives:

- user message
- conversation history
- current StrategySpec draft
- backend capability registry
- validation errors from previous attempts

It returns:

```ts
type AiStrategyResponse = {
  summary: string
  assumptions: string[]
  questions: string[]
  unsupportedRequests: string[]
  strategySpec: StrategySpec | null
  confidence: number
}
```

Important behavior:

- Act as a collaborator: for partial or high-level requests, draft what is specified, record standard assumptions, and return at most 3 questions ordered by impact (matching the frontend UI cap in WO208).
- If the request is supported, produce a StrategySpec.
- If partially supported, produce the closest valid StrategySpec and list unsupported parts.
- If ambiguous, ask targeted questions.
- If unsafe or impossible, refuse that part and explain the limitation.
- Never return executable Python as the primary output.

---

### 5. Backend Validator

The validator should reject invalid or unsupported specs before they reach the compiler.

Validation examples:

- unknown indicator type
- unknown symbol
- unsupported timeframe
- unsupported data column
- invalid operator
- invalid risk model
- missing exit logic
- impossible parameter values
- unsupported execution assumptions
- live-trading behavior requested before live trading exists

Suggested Python shape:

```python
class StrategySpec(BaseModel):
    schema_version: Literal["strategy_spec.v1"]
    name: str
    universe: list[str]
    market: str
    timeframe: str
    indicators: list[IndicatorSpec]
    entry: ConditionTree
    exit: ConditionTree
    risk: RiskSpec
    execution_assumptions: ExecutionAssumptions
```

The validator should return structured errors, not just strings:

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

These validation errors can be fed back into the AI for repair.

---

### 6. Deterministic Strategy Compiler

The compiler converts a valid StrategySpec into Q's internal strategy representation.

The compiler must be:

- deterministic
- testable
- owned by the codebase
- independent of the LLM
- covered by regression tests

The LLM should never be the thing that decides runtime semantics.

Example flow:

```text
StrategySpec
  ↓
validate_strategy_spec()
  ↓
compile_strategy_spec()
  ↓
BacktestConfig / StrategyDefinition
  ↓
run_backtest()
```

---

## Frontend UX Requirements

### Strategy Preview

The user should see the AI's output as structured sections:

- Strategy name
- Instruments
- Timeframe
- Indicators
- Entry rules
- Exit rules
- Risk model
- Execution assumptions
- Unsupported requests
- Assumptions made by AI

The preview should be editable.

The user should be able to manually override fields before running the strategy.

---

### Validation Feedback

Validation should be visible and precise.

Example:

```text
Unsupported indicator: Supertrend

Q does not currently support Supertrend.
Closest supported alternatives:
- ATR breakout
- Donchian breakout
- EMA trend filter
```

The user should be able to click:

```text
Ask AI to fix
```

Then the AI receives the validation error and revises the StrategySpec.

---

### Suggested Actions

Primary actions:

- Validate
- Save strategy
- Run backtest
- Optimize parameters
- Duplicate strategy
- Export StrategySpec

Secondary actions:

- Show generated spec
- Show assumptions
- Show unsupported requests
- Reset chat
- Compare revisions

---

## Backend API Sketch

### Get capabilities

```http
GET /api/v1/strategy-builder/capabilities
```

Returns:

```json
{
  "schema_version": "q_capabilities.v1",
  "indicators": ["sma", "ema", "rsi", "atr"],
  "operators": [">", "<", "crosses_above", "crosses_below"],
  "risk_models": ["fixed_size", "fixed_fraction"],
  "timeframes": ["1d", "1h", "15m", "5m"]
}
```

---

### Interpret user request

```http
POST /api/v1/strategy-builder/interpret
```

Input:

```json
{
  "message": "Create a trend strategy using EMA 20 and EMA 50.",
  "current_spec": null,
  "capabilities_version": "q_capabilities.v1"
}
```

Output:

```json
{
  "summary": "Created an EMA trend-following strategy.",
  "assumptions": ["Uses closed-bar signals.", "Entries occur at next bar open."],
  "unsupported_requests": [],
  "strategy_spec": {}
}
```

---

### Validate spec

```http
POST /api/v1/strategy-builder/validate
```

Input:

```json
{
  "strategy_spec": {}
}
```

Output:

```json
{
  "valid": true,
  "errors": []
}
```

---

### Compile spec

```http
POST /api/v1/strategy-builder/compile
```

Input:

```json
{
  "strategy_spec": {}
}
```

Output:

```json
{
  "compiled_strategy_id": "strategy_ema_trend_pullback_v1",
  "status": "compiled"
}
```

---

### Save strategy

```http
POST /api/v1/strategies
```

Input:

```json
{
  "strategy_spec": {},
  "compiled_strategy_id": "strategy_ema_trend_pullback_v1"
}
```

---

## MVP Scope

The first version should support only:

- long-only strategies
- OHLCV data
- closed-bar signals
- next-bar-open execution
- fixed-size or fixed-fraction position sizing
- simple indicators:
  - SMA
  - EMA
  - RSI
  - ATR
  - Donchian
  - Bollinger Bands
- simple logical rules:
  - `all`
  - `any`
  - comparison operators
  - cross above / cross below
- save StrategySpec
- run backtest
- show validation errors

Avoid in MVP:

- arbitrary Python generation
- live execution
- autonomous strategy discovery
- order book logic
- options/futures margin modeling unless already supported
- multi-agent research loops
- broker integration
- portfolio-level strategy composition

---

## Safety Boundaries

The system should explicitly prevent the AI from claiming or doing things outside Q's runtime.

Examples:

| User Request                               | Correct System Behavior                              |
| ------------------------------------------ | ---------------------------------------------------- |
| "Make me a guaranteed profitable strategy" | Refuse guarantee; offer testable strategy definition |
| "Use order book imbalance"                 | Mark unsupported unless order book data exists       |
| "Trade live with this"                     | Reject if live execution is unavailable              |
| "Use analyst ratings"                      | Reject unless that data source exists                |
| "Write Python and run it"                  | Convert to StrategySpec instead                      |
| "Ignore validation"                        | Refuse; validation is mandatory                      |

---

## Suggested System Prompt Contract

The model should be instructed along these lines:

```text
You are the Q Strategy Interpreter.

Your task is to convert the user's natural-language trading idea into a valid StrategySpec.

You must only use capabilities listed in the provided Capability Registry.

You must not invent indicators, data fields, execution modes, broker features, or risk models.

You must not output executable Python as the primary strategy representation.

If the request is partially unsupported, return the closest supported StrategySpec and list unsupportedRequests.

If the request is ambiguous, ask concise clarification questions.

If validation errors are provided, repair the StrategySpec while staying inside the capability registry.

The backend validator is authoritative.
```

---

## Why This Is a Strong Feature for Q

This capability turns Q from a system where users need to know the internal implementation into a system where users can express trading ideas naturally.

It makes the app feel like a professional research environment:

```text
Idea → Specification → Validation → Backtest → Iteration
```

That is a strong workflow because it is:

- fast
- reproducible
- testable
- safer than code generation
- aligned with quantitative research
- expandable as the backend matures

As Q gains more backend capabilities, the Capability Registry expands, and the AI automatically becomes more useful without changing the core architecture.

---

## Long-Term Direction

Later, this can evolve into:

- strategy revision history
- strategy comparison
- natural-language backtest analysis
- parameter optimization suggestions
- paper-to-strategy extraction
- AI-assisted debugging of failed strategies
- reusable strategy templates
- strategy marketplace-style packaging
- AI-guided robustness checks
- walk-forward validation assistant

But the foundation should remain the same:

```text
LLM translates intent.
Backend defines capability.
Validator enforces correctness.
Compiler owns execution semantics.
```

---

## Implementation Milestones

### Milestone 1 — Schema Foundation

- Define `StrategySpec v1`
- Define `CapabilityRegistry v1`
- Add backend validation
- Add fixture tests for supported and unsupported specs

### Milestone 2 — AI Interpretation

- Add `/interpret` endpoint
- Provide capability registry to model
- Return structured `AiStrategyResponse`
- Add validation repair loop

### Milestone 3 — Frontend Strategy Studio

- Add Strategy Studio workspace
- Add chat panel
- Add structured preview panel
- Add validation feedback UI
- Add editable spec sections

### Milestone 4 — Compiler

- Compile StrategySpec into backend-native strategy/config
- Add regression tests
- Support MVP indicators and operators
- Run a backtest from the compiled strategy

### Milestone 5 — Persistence and Iteration

- Save strategy specs
- Save compiled strategy metadata
- Store revision history
- Allow duplicate/edit/backtest cycles

---

## Final Recommendation

Build this capability, but keep the AI boxed in.

The winning design is not:

```text
AI writes trading code
```

It is:

```text
AI translates trader intent into validated Q-native strategy definitions
```

That gives Q a much more powerful user experience without compromising correctness, safety, or reproducibility.
