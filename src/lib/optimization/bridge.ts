import { namespacedEntryParamKey } from '@/lib/optimize/multiEntrySearchSpace'
import type {
  BacktestRequest,
  EntryInstance,
  EntryManagerConfig,
  PositionSizingConfig,
} from '@/types/backtesting'
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

const NAMESPACED_ENTRY_PARAM = /^e\d+__/

/**
 * Mirror of q_backend.optimization.search_space.entries_from_trial_params:
 * overlay each slot's `e{i}__`-prefixed trial params on the study's entry template.
 */
export function entriesFromTrialParams(
  strategyParams: Record<string, unknown>,
  entriesTemplate: EntryInstance[],
): EntryInstance[] {
  return entriesTemplate.map((template, index) => {
    const prefix = namespacedEntryParamKey(index, '')
    const params = { ...template.params }
    for (const [key, value] of Object.entries(strategyParams)) {
      if (key.startsWith(prefix)) params[key.slice(prefix.length)] = value
    }
    return { strategy: template.strategy, params }
  })
}

/**
 * Mirror of q_backend.optimization.search_space.exit_params_from_trial_params:
 * the un-namespaced trial params of a multi-entry study are its shared exit params.
 */
export function exitParamsFromTrialParams(
  strategyParams: Record<string, unknown>,
  exitTemplate: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const sampled = Object.entries(strategyParams).filter(
    ([key]) => !NAMESPACED_ENTRY_PARAM.test(key),
  )
  return { ...exitTemplate, ...Object.fromEntries(sampled) }
}

function cleanPayload<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T
}

/**
 * Build a Backtest request from a winning optimization trial, carrying over the
 * instrument/window from the study's backtest config and the trial's resolved
 * strategy + risk params recorded in `user_attrs`. Multi-entry studies record
 * namespaced params, so their entries, manager and shared exits are rebuilt the
 * same way the backend rebuilt them for the trial.
 */
export function buildBacktestRequestFromTrial(
  trial: OptimizationTrial,
  backtest: OptimizationBacktestConfig,
): BacktestRequest {
  const strategyParams = trial.user_attrs.strategy_params ?? {}
  const riskParams = trial.user_attrs.risk_params ?? {}

  let strategyPayload: Pick<
    BacktestRequest,
    'strategy_params' | 'entries' | 'entry_manager' | 'exit_params'
  > = { strategy_params: strategyParams }
  if (backtest.entries) {
    const exitParams = exitParamsFromTrialParams(strategyParams, backtest.exit_params)
    const entryManager: EntryManagerConfig = {
      kind: backtest.entry_manager?.kind ?? 'or',
      params: { ...backtest.entry_manager?.params, ...trial.user_attrs.manager_params },
    }
    strategyPayload = {
      strategy_params: exitParams,
      entries: entriesFromTrialParams(strategyParams, backtest.entries),
      entry_manager: entryManager,
      exit_params: exitParams,
    }
  }

  return cleanPayload({
    symbol: backtest.symbol,
    timeframe: backtest.timeframe,
    start: backtest.start,
    end: backtest.end,
    initial_capital: backtest.initial_capital,
    point_value: backtest.point_value,
    strategy: backtest.strategy,
    ...strategyPayload,
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
