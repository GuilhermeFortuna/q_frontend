import { hydratePositionSizingFields } from '@/lib/backtesting/positionSizing'
import type { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { hydrateStrategyParamsFromPending } from '@/lib/strategies/strategyParams'
import type { CompiledStrategy, StrategySpec } from '@/types/strategyBuilder'

type BacktestConfig = ReturnType<typeof useBacktestConfig>

export type ApplyCompiledStrategyOptions = {
  draftName?: string
  draftDescription?: string
}

export function applyCompiledStrategyToConfig(
  compiled: CompiledStrategy,
  config: Pick<BacktestConfig, 'strategies' | 'setters' | 'authoring'>,
  options: ApplyCompiledStrategyOptions = {},
) {
  const { backtest_config: backtestConfig } = compiled
  const { setters, strategies, authoring } = config

  authoring.newDraft()
  authoring.setCustomName(options.draftName ?? compiled.summary.name)
  authoring.setDescription(options.draftDescription ?? compiled.summary.entry_summary)

  setters.setSymbol(backtestConfig.symbol)
  setters.setTimeframe(backtestConfig.timeframe)
  setters.handleStrategyChange(backtestConfig.strategy)

  const strategyInfo = strategies.find((entry) => entry.name === backtestConfig.strategy)
  if (strategyInfo) {
    setters.setStrategyParams(
      hydrateStrategyParamsFromPending(strategyInfo.params, backtestConfig.strategy_params),
    )
  } else {
    setters.setStrategyParams(backtestConfig.strategy_params as Record<string, string | number>)
  }

  const sizing = hydratePositionSizingFields(
    backtestConfig.position_sizing as Parameters<typeof hydratePositionSizingFields>[0],
  )
  setters.setSizingMode(sizing.mode)
  setters.setPositionSizingFields(sizing.fields)
}

export function updateStrategySpecField<K extends keyof StrategySpec>(
  spec: StrategySpec,
  key: K,
  value: StrategySpec[K],
): StrategySpec {
  return { ...spec, [key]: value }
}

export function updateStrategySpecRisk(
  spec: StrategySpec,
  updates: Partial<StrategySpec['risk']>,
): StrategySpec {
  return {
    ...spec,
    risk: {
      ...spec.risk,
      ...updates,
    },
  }
}

export function updateExitConditionValue(
  spec: StrategySpec,
  group: 'entry' | 'exit',
  index: number,
  value: number,
): StrategySpec {
  const conditionGroup = spec[group]
  const branchKey = conditionGroup.all ? 'all' : 'any'
  const conditions = [...(conditionGroup[branchKey] ?? [])]
  const current = conditions[index]
  if (!current || !('type' in current)) return spec

  conditions[index] = { ...current, value }
  return {
    ...spec,
    [group]: {
      [branchKey]: conditions,
    },
  }
}
