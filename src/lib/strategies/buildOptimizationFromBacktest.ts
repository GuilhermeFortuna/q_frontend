import { endOfDay, startOfDay } from 'date-fns'

import type { BacktestConfigFields } from '@/lib/backtesting/useBacktestConfig'
import { buildOptimizationConfig } from '@/lib/optimize/useOptimizeConfig'
import { defaultSearchSpaceFromSpecs } from '@/lib/strategies/strategyParams'
import type { OptimizationConfig } from '@/types/optimization'
import type { StrategyInfo } from '@/types/strategies'

export function buildOptimizationConfigFromBacktestFields(
  fields: BacktestConfigFields,
  selectedStrategy: StrategyInfo | undefined,
): OptimizationConfig | null {
  if (!selectedStrategy) return null

  const searchSpace = defaultSearchSpaceFromSpecs(selectedStrategy.params)

  return buildOptimizationConfig(
    {
      symbol: fields.symbol,
      timeframe: fields.timeframe,
      startDate: fields.startDate,
      endDate: fields.endDate,
      capital: fields.capital,
      pointValue: fields.pointValue,
      dayTrade: fields.dayTrade,
      dayTradeStartTime: fields.dayTradeStartTime,
      dayTradeEndTime: fields.dayTradeEndTime,
      dayTradeCloseTime: fields.dayTradeCloseTime,
      engine: fields.engine,
      displayTimeframe: fields.displayTimeframe,
      tickFlags: fields.tickFlags,
      objective: 'maximize_return_drawdown',
      sampler: 'tpe',
      nTrials: 50,
      seed: 42,
      pruner: 'median',
      continueOnTrialError: true,
      maxWorkersInput: '',
      strategy: fields.strategy,
      strategySearchSpace: searchSpace,
      riskMode:
        fields.sizingMode === 'fixed_safety_margin'
          ? 'fixed_safety_margin'
          : fields.sizingMode === 'inverse_volatility'
            ? 'inverse_volatility'
            : 'fixed_quantity',
      qtyLow: Math.max(1, fields.positionSizingFields.quantity),
      qtyHigh: Math.max(1, fields.positionSizingFields.quantity * 2),
      marginLow: fields.positionSizingFields.safetyMargin,
      marginHigh: fields.positionSizingFields.safetyMargin * 2,
      minContractsLow: fields.positionSizingFields.minContracts,
      minContractsHigh: Math.max(fields.positionSizingFields.minContracts, 5),
      targetVolLow: fields.positionSizingFields.targetVolatilityPct,
      targetVolHigh: fields.positionSizingFields.targetVolatilityPct * 2,
      inverseMinContractsLow: fields.positionSizingFields.inverseMinContracts,
      inverseMinContractsHigh: Math.max(fields.positionSizingFields.inverseMinContracts, 5),
      inverseMaxContractsInput: fields.positionSizingFields.inverseMaxContractsInput,
      costFields: fields.costFields,
    },
    selectedStrategy.name,
  )
}

export function backtestRequestTiming(fields: BacktestConfigFields) {
  return {
    start: startOfDay(fields.startDate).toISOString(),
    end: endOfDay(fields.endDate).toISOString(),
  }
}
