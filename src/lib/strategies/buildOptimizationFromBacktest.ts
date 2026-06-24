import { endOfDay, startOfDay } from 'date-fns'

import type { BacktestConfigFields } from '@/lib/backtesting/useBacktestConfig'
import { buildOptimizationConfig } from '@/lib/optimize/useOptimizeConfig'
import {
  buildMultiEntryStrategyParamsSearchSpacePayload,
  buildStrategyParamsSearchSpacePayload,
  isNamespacedMultiEntryPayload,
} from '@/lib/optimize/exitSearchSpace'
import {
  defaultEntrySearchSpaceFromSpecs,
  defaultExitSearchSpaceFromSpecs,
} from '@/lib/optimize/multiEntrySearchSpace'
import { withResolvedCustomStrategyParams } from '@/lib/strategies/resolveCustomStrategyParams'
import type { OptimizationConfig } from '@/types/optimization'
import type { StrategyInfo } from '@/types/strategies'
import { partitionStrategyParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'

export function buildOptimizationConfigFromBacktestFields(
  fields: BacktestConfigFields,
  selectedStrategy: StrategyInfo | undefined,
): OptimizationConfig | null {
  if (!selectedStrategy || fields.entries.length === 0) return null

  const entrySearchSpaces = Object.fromEntries(
    fields.entries.map((entry) => {
      const info =
        selectedStrategy.name === entry.strategy
          ? selectedStrategy
          : withResolvedCustomStrategyParams(
              { ...selectedStrategy, name: entry.strategy, params: selectedStrategy.params },
              [selectedStrategy],
              [],
            )
      return [entry.slotId, defaultEntrySearchSpaceFromSpecs(info.params)]
    }),
  )

  const exitSearchSpace = defaultExitSearchSpaceFromSpecs(selectedStrategy.params)
  const multiEntry = isNamespacedMultiEntryPayload(fields.entries, fields.entryManager)

  const optimizeFields = {
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
    objective: 'maximize_return_drawdown' as const,
    sampler: 'tpe' as const,
    nTrials: 50,
    seed: 42,
    pruner: 'median' as const,
    continueOnTrialError: true,
    maxWorkersInput: '',
    strategy: fields.entries[0]?.strategy ?? fields.strategy,
    entries: fields.entries,
    entryManager: fields.entryManager,
    entrySearchSpaces,
    exitSearchSpace,
    managerSearchSpace: {},
    riskMode:
      fields.sizingMode === 'fixed_safety_margin'
        ? ('fixed_safety_margin' as const)
        : fields.sizingMode === 'inverse_volatility'
          ? ('inverse_volatility' as const)
          : ('fixed_quantity' as const),
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
  }

  const primaryStrategyName = fields.entries[0].strategy
  const config = buildOptimizationConfig(
    optimizeFields,
    primaryStrategyName,
    multiEntry
      ? {
          entries: fields.entries,
          entryManager: fields.entryManager,
          exitParams: fields.strategyParams,
        }
      : undefined,
  )

  const { exitParamSpecs } = partitionStrategyParamSpecs(selectedStrategy.params)
  const resolveEntryParamSpecs = (strategyName: string) => {
    if (strategyName === selectedStrategy.name) {
      return partitionStrategyParamSpecs(selectedStrategy.params).entryParamSpecs
    }
    return partitionStrategyParamSpecs(selectedStrategy.params).entryParamSpecs
  }

  if (multiEntry) {
    config.search_space.strategy_params = buildMultiEntryStrategyParamsSearchSpacePayload(
      fields.entries,
      entrySearchSpaces,
      exitSearchSpace,
      resolveEntryParamSpecs,
      exitParamSpecs,
      [],
      new Set(),
      [],
    )
  } else {
    const singleSlotId = fields.entries[0].slotId
    config.search_space.strategy_params = buildStrategyParamsSearchSpacePayload(
      { ...entrySearchSpaces[singleSlotId], ...exitSearchSpace },
      resolveEntryParamSpecs(primaryStrategyName),
      exitParamSpecs,
      [],
      new Set(),
      [],
    )
  }

  return config
}

export function backtestRequestTiming(fields: BacktestConfigFields) {
  return {
    start: startOfDay(fields.startDate).toISOString(),
    end: endOfDay(fields.endDate).toISOString(),
  }
}
