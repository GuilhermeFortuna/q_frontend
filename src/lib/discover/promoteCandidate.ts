import { buildPositionSizingFromRiskParams } from '@/lib/optimization/bridge'
import type { BacktestRequest } from '@/types/backtesting'
import type {
  OptimizationBacktestConfig,
  OptimizationConfig,
  SearchSpaceConfig,
} from '@/types/optimization'
import type { CandidateResult, StrategySearchConfig } from '@/types/strategySearch'
import { isGeneticCandidate } from '@/types/strategySearch'

const RISK_PARAM_KEYS = new Set([
  'type',
  'quantity',
  'safety_margin_per_contract',
  'min_contracts',
  'max_contracts',
  'target_volatility_pct',
])

function splitBestParams(params: Record<string, unknown>) {
  const nestedStrategy = params.strategy_params
  const nestedRisk = params.risk_params
  if (nestedStrategy && typeof nestedStrategy === 'object' && !Array.isArray(nestedStrategy)) {
    const strategyParams = { ...(nestedStrategy as Record<string, unknown>) }
    const riskParams =
      nestedRisk && typeof nestedRisk === 'object' && !Array.isArray(nestedRisk)
        ? { ...(nestedRisk as Record<string, unknown>) }
        : {}

    for (const [key, value] of Object.entries(params)) {
      if (key === 'strategy_params' || key === 'risk_params') continue
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

function strategyForCandidate(candidate: CandidateResult): string {
  return isGeneticCandidate(candidate) ? 'CompositeStrategy' : candidate.strategy
}

function cleanPayload<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T
}

export function buildBacktestRequestFromCandidate(
  candidate: CandidateResult,
  backtest: OptimizationBacktestConfig,
): BacktestRequest {
  const params = candidate.best_params ?? {}
  const { strategyParams, riskParams } = splitBestParams(params)

  if (candidate.genome) {
    strategyParams.genome = candidate.genome
  }

  return cleanPayload({
    symbol: backtest.symbol,
    timeframe: backtest.timeframe,
    start: backtest.start,
    end: backtest.end,
    initial_capital: backtest.initial_capital,
    point_value: backtest.point_value,
    strategy: strategyForCandidate(candidate),
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

export function buildOptimizationConfigFromCandidate(
  candidate: CandidateResult,
  searchConfig: StrategySearchConfig,
): OptimizationConfig {
  const params = candidate.best_params ?? {}
  const { strategyParams, riskParams } = splitBestParams(params)
  if (candidate.genome) {
    strategyParams.genome = candidate.genome
  }

  return {
    study: {
      ...searchConfig.study,
      name: `${searchConfig.backtest.symbol}_${candidate.candidate_id}_${Date.now()}`,
    },
    objective: searchConfig.objective,
    backtest: {
      ...searchConfig.backtest,
      strategy: strategyForCandidate(candidate),
    },
    search_space: {
      strategy_params: strategyParams as SearchSpaceConfig['strategy_params'],
      risk_params: riskParams as SearchSpaceConfig['risk_params'],
    },
  }
}
