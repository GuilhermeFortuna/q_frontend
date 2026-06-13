import { buildPositionSizingFromRiskParams } from '@/lib/optimization/bridge'
import type { BacktestRequest } from '@/types/backtesting'
import type { OptimizationBacktestConfig, OptimizationConfig } from '@/types/optimization'
import type { CandidateResult, StrategySearchConfig } from '@/types/strategySearch'

const RISK_PARAM_KEYS = new Set([
  'type',
  'quantity',
  'safety_margin_per_contract',
  'min_contracts',
  'max_contracts',
  'target_volatility_pct',
])

function splitBestParams(params: Record<string, unknown>) {
  const strategyParams: Record<string, unknown> = {}
  const riskParams: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(params)) {
    if (RISK_PARAM_KEYS.has(key)) {
      riskParams[key] = value
    } else {
      strategyParams[key] = value
    }
  }

  if (!riskParams.type && riskParams.quantity != null) {
    riskParams.type = 'fixed_quantity'
  }

  return { strategyParams, riskParams }
}

export function buildBacktestRequestFromCandidate(
  candidate: CandidateResult,
  backtest: OptimizationBacktestConfig,
): BacktestRequest {
  const params = candidate.best_params ?? {}
  const { strategyParams, riskParams } = splitBestParams(params)

  return {
    symbol: backtest.symbol,
    timeframe: backtest.timeframe,
    start: backtest.start,
    end: backtest.end,
    initial_capital: backtest.initial_capital,
    point_value: backtest.point_value,
    strategy: candidate.strategy,
    strategy_params: strategyParams,
    position_sizing: buildPositionSizingFromRiskParams(riskParams),
    ...(backtest.costs ? { costs: backtest.costs } : {}),
    day_trade: backtest.day_trade,
    day_trade_start_time: backtest.day_trade_start_time,
    day_trade_end_time: backtest.day_trade_end_time,
    day_trade_close_time: backtest.day_trade_close_time,
  }
}

export function buildOptimizationConfigFromCandidate(
  candidate: CandidateResult,
  searchConfig: StrategySearchConfig,
): OptimizationConfig {
  return {
    study: {
      ...searchConfig.study,
      name: `${searchConfig.backtest.symbol}_${candidate.strategy}_${Date.now()}`,
    },
    objective: searchConfig.objective,
    backtest: {
      ...searchConfig.backtest,
      strategy: candidate.strategy,
    },
    search_space: {
      strategy_params: {},
      risk_params: {},
    },
  }
}
