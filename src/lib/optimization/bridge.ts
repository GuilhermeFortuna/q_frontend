import type { BacktestRequest, PositionSizingConfig } from '@/types/backtesting'
import type { OptimizationBacktestConfig, OptimizationTrial } from '@/types/optimization'

/**
 * Mirror of q_backend.optimization.search_space.build_position_sizing_config:
 * turn a trial's resolved risk params into a position-sizing payload.
 */
export function buildPositionSizingFromRiskParams(
  risk: Record<string, unknown>,
): PositionSizingConfig | undefined {
  const type = risk.type
  if (type === 'fixed_quantity') {
    return { type: 'fixed_quantity', quantity: Number(risk.quantity ?? 1) }
  }
  if (type === 'fixed_safety_margin') {
    return {
      type: 'fixed_safety_margin',
      safety_margin_per_contract: Number(risk.safety_margin_per_contract ?? 5000),
      min_contracts: Number(risk.min_contracts ?? 1),
      max_contracts: risk.max_contracts != null ? Number(risk.max_contracts) : null,
    }
  }
  if (type === 'inverse_volatility') {
    return {
      type: 'inverse_volatility',
      target_volatility_pct: Number(risk.target_volatility_pct ?? 10),
      min_contracts: Number(risk.min_contracts ?? 0),
      max_contracts: risk.max_contracts != null ? Number(risk.max_contracts) : null,
    }
  }
  return undefined
}

/**
 * Build a Backtest request from a winning optimization trial, carrying over the
 * instrument/window from the study's backtest config and the trial's resolved
 * (unprefixed) strategy + risk params recorded in `user_attrs`.
 */
function cleanPayload<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T
}

export function buildBacktestRequestFromTrial(
  trial: OptimizationTrial,
  backtest: OptimizationBacktestConfig,
): BacktestRequest {
  const strategyParams = trial.user_attrs.strategy_params ?? {}
  const riskParams = trial.user_attrs.risk_params ?? {}

  return cleanPayload({
    symbol: backtest.symbol,
    timeframe: backtest.timeframe,
    start: backtest.start,
    end: backtest.end,
    initial_capital: backtest.initial_capital,
    point_value: backtest.point_value,
    strategy: backtest.strategy,
    strategy_params: strategyParams,
    position_sizing: buildPositionSizingFromRiskParams(riskParams),
    ...(backtest.costs ? { costs: backtest.costs } : {}),
    day_trade: backtest.day_trade,
    day_trade_start_time: backtest.day_trade_start_time,
    day_trade_end_time: backtest.day_trade_end_time,
    day_trade_close_time: backtest.day_trade_close_time,
    engine: backtest.engine ?? 'candle',
    display_timeframe: backtest.display_timeframe,
    tick_flags: backtest.tick_flags,
  })
}
