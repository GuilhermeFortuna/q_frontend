import type { StrategyInfo, StrategyParamSpec } from '@/types/strategies'

export type CapabilityRegistry = {
  schema_version: 'q_capabilities.v1'
  data: {
    markets: string[]
    engines: Array<'candle' | 'tick'>
    timeframes: string[]
    ohlcv_columns: string[]
    tick_columns: string[]
    data_sources: string[]
  }
  strategies: StrategyInfo[]
  genome_nodes: Array<{
    kind: string
    min_inputs: number
    max_inputs: number
    input_series_types: Array<'price_series' | 'oscillator'> | null
    output_ports: string[]
    port_types: Record<string, string>
    allowed_param_keys: string[]
  }>
  genome_param_bounds: StrategyParamSpec[]
  genome_limits: { max_depth: number; max_node_count: number }
  operators: string[]
  condition_groups: string[]
  exit_rules: import('@/types/strategies').ExitRuleInfo[]
  exit_presets: import('@/types/strategies').ExitPreset[]
  risk_sizing: Array<{ type: string; label: string; description: string }>
  execution_assumptions: {
    supported_signal_timing: string[]
    supported_entry_timing: string[]
    allow_short: boolean
    ai_builder_mvp_long_only: boolean
  }
  unsupported: string[]
}

export type ValidationErrorDetail = {
  path: string
  code: string
  message: string
  suggestions?: string[]
}

export type ValidationResult = {
  valid: boolean
  errors: ValidationErrorDetail[]
}

export type StrategySpec = {
  schema_version: 'strategy_spec.v1'
  name: string
  universe: string[]
  market: string
  timeframe: string
  indicators: Array<{
    id: string
    type: string
    source?: string
    period?: number
  }>
  entry: StrategySpecConditionGroup
  exit: StrategySpecConditionGroup
  risk: {
    position_sizing: 'fixed_quantity' | 'fixed_safety_margin'
    quantity?: number | null
    safety_margin_per_contract?: number | null
  }
  execution_assumptions?: {
    signal_timing?: string
    entry_timing?: string
    allow_short?: boolean
    live_trading?: boolean
  }
  data_requirements?: { columns?: string[] }
}

export type StrategySpecCondition =
  | {
      left: string
      op: string
      right: string | number
    }
  | {
      type: 'stop_loss' | 'take_profit'
      mode: 'percent' | 'atr'
      value: number
      atr_period?: number | null
    }

export type StrategySpecConditionGroup = {
  all?: StrategySpecCondition[]
  any?: StrategySpecCondition[]
}

export type CompiledStrategySummary = {
  name: string
  strategy_label: string
  mapping: string
  indicators: string[]
  entry_summary: string
  exit_summary: string
  universe: string[]
  timeframe: string
  market: string
}

export type CompiledStrategyBacktestConfig = {
  symbol: string
  timeframe: string
  strategy: string
  strategy_params: Record<string, unknown>
  position_sizing: Record<string, unknown>
  execution_assumptions: Record<string, unknown>
}

export type CompiledStrategy = {
  compiled_id: string
  schema_version: string
  strategy_name: string
  strategy_params: Record<string, unknown>
  genome: Record<string, unknown> | null
  summary: CompiledStrategySummary
  backtest_config: CompiledStrategyBacktestConfig
}

export type CompileStrategySpecResponse = {
  compiled_strategy_id: string
  status: 'compiled'
  compiled_strategy: CompiledStrategy
}

export type CompileStrategySpecErrorResponse = {
  status: 'validation_failed' | 'compile_failed'
  errors: ValidationErrorDetail[]
}

export type ConversationMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type StrategyInterpretRequest = {
  message: string
  model?: string
  provider?: string
  conversation?: ConversationMessage[]
  current_spec?: StrategySpec | null
  capabilities_version?: string
  validation_errors?: ValidationErrorDetail[]
}

export type AiModelOption = {
  id: string
  label: string
  available: boolean
  provider?: string
}

export type AiStrategyModelsResponse = {
  provider: string
  default_model: string
  providers?: Array<{ id: string; label: string }>
  models: AiModelOption[]
}

export type AiStrategyResponse = {
  summary: string
  assumptions: string[]
  questions: string[]
  unsupported_requests: string[]
  change_notes?: string[]
  strategy_spec: StrategySpec | null
  validation: ValidationResult | null
  compiled_strategy: CompiledStrategy | null
  confidence: number
}

export type AiStrategyServiceErrorResponse = {
  status: 'ai_disabled' | 'ai_misconfigured' | 'provider_error' | 'parse_error'
  message: string
  detail?: string | null
}
