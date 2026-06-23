import type {
  AiStrategyResponse,
  CompiledStrategy,
  StrategySpec,
  ValidationErrorDetail,
} from '@/types/strategyBuilder'

export const EMA_CROSS_SPEC: StrategySpec = {
  schema_version: 'strategy_spec.v1',
  name: 'EMA Trend Cross',
  universe: ['PETR4'],
  market: 'B3',
  timeframe: 'D1',
  indicators: [
    { id: 'ema_fast', type: 'ema', source: 'close', period: 20 },
    { id: 'ema_slow', type: 'ema', source: 'close', period: 50 },
  ],
  entry: {
    all: [{ left: 'ema_fast', op: 'crosses_above', right: 'ema_slow' }],
  },
  exit: {
    any: [
      { left: 'ema_fast', op: 'crosses_below', right: 'ema_slow' },
      { type: 'stop_loss', mode: 'percent', value: 0.03 },
    ],
  },
  risk: { position_sizing: 'fixed_quantity', quantity: 1 },
  execution_assumptions: {
    signal_timing: 'closed_bar',
    entry_timing: 'next_bar_open',
    allow_short: false,
  },
}

export const COMPILED_EMA_CROSS: CompiledStrategy = {
  compiled_id: 'compiled-ema-cross',
  schema_version: 'strategy_spec.v1',
  strategy_name: 'CompositeStrategy',
  strategy_params: {
    genome: { genome_id: 'ema-trend-cross' },
    exit_stop_loss_pct: 0.03,
  },
  genome: { genome_id: 'ema-trend-cross' },
  summary: {
    name: 'EMA Trend Cross',
    strategy_label: 'Composite Strategy',
    mapping: 'genome',
    indicators: ['ema_fast', 'ema_slow'],
    entry_summary: 'EMA fast crosses above EMA slow',
    exit_summary: 'EMA cross down or 3% stop',
    universe: ['PETR4'],
    timeframe: 'D1',
    market: 'B3',
  },
  backtest_config: {
    symbol: 'PETR4',
    timeframe: 'D1',
    strategy: 'CompositeStrategy',
    strategy_params: {
      genome: { genome_id: 'ema-trend-cross' },
      exit_stop_loss_pct: 0.03,
    },
    position_sizing: { type: 'fixed_quantity', quantity: 1 },
    execution_assumptions: {
      signal_timing: 'closed_bar',
      entry_timing: 'next_bar_open',
      allow_short: false,
    },
  },
}

export function buildInterpretResponse(
  overrides: Partial<AiStrategyResponse> = {},
): AiStrategyResponse {
  return {
    summary: 'Created an EMA crossover strategy.',
    assumptions: ['Uses closed-bar signals.', 'Entries occur at the next bar open.'],
    questions: [],
    unsupported_requests: [],
    strategy_spec: EMA_CROSS_SPEC,
    validation: { valid: true, errors: [] },
    compiled_strategy: COMPILED_EMA_CROSS,
    confidence: 0.92,
    ...overrides,
  }
}

export const TIMEFRAME_VALIDATION_ERROR: ValidationErrorDetail = {
  path: 'timeframe',
  code: 'unsupported_timeframe',
  message: "Timeframe 'BADTF' is not currently supported.",
  suggestions: ['D1'],
}

export const MOCK_CAPABILITIES = {
  schema_version: 'q_capabilities.v1' as const,
  data: {
    markets: ['B3'],
    engines: ['candle' as const],
    timeframes: ['D1', 'H1'],
    ohlcv_columns: ['open', 'high', 'low', 'close', 'volume'],
    tick_columns: ['price'],
    data_sources: ['local'],
  },
  strategies: [],
  genome_nodes: [],
  genome_param_bounds: [],
  genome_limits: { max_depth: 8, max_node_count: 32 },
  operators: ['>', '<', 'crosses_above', 'crosses_below'],
  condition_groups: ['all', 'any'],
  exit_rules: [],
  exit_presets: [],
  risk_sizing: [],
  execution_assumptions: {
    supported_signal_timing: ['closed_bar'],
    supported_entry_timing: ['next_bar_open'],
    allow_short: false,
    ai_builder_mvp_long_only: true,
  },
  unsupported: ['live trading'],
}

export const MOCK_MODELS = {
  provider: 'openai_compatible',
  default_model: 'test-model-a',
  models: [
    { id: 'test-model-a', label: 'Model A', available: true },
    { id: 'test-model-b', label: 'Model B', available: false },
  ],
}
