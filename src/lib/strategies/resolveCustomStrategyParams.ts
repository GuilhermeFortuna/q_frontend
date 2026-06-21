import type { CustomStrategy, StrategyInfo, StrategyParamSpec } from '@/types/strategies'

function hasOptimizableSpecs(params: StrategyParamSpec[]): boolean {
  return params.some(
    (param) =>
      param.min != null || param.max != null || (param.choices != null && param.choices.length > 0),
  )
}

/** Ensure a custom strategy has full param specs (entry + exit) from its base strategy. */
export function resolveCustomStrategyParams(
  strategy: StrategyInfo,
  allStrategies: StrategyInfo[],
  customStrategies: CustomStrategy[],
): StrategyParamSpec[] {
  const custom = customStrategies.find((entry) => entry.name === strategy.name)
  if (!custom) return strategy.params

  const registered = allStrategies.find((entry) => entry.name === strategy.name)
  if (
    registered &&
    registered.params.length > strategy.params.length &&
    hasOptimizableSpecs(registered.params)
  ) {
    return registered.params.map((spec) => {
      const savedValue = custom.parameters[spec.name]
      return savedValue != null ? { ...spec, default: savedValue } : spec
    })
  }

  const base = allStrategies.find((entry) => entry.name === custom.base_strategy)
  if (!base || base.params.length === 0) return strategy.params

  if (strategy.params.length >= base.params.length && hasOptimizableSpecs(strategy.params)) {
    return strategy.params
  }

  const specsByName = new Map(strategy.params.map((param) => [param.name, param]))

  return base.params.map((spec) => {
    const fromStrategy = specsByName.get(spec.name)
    const savedValue = custom.parameters[spec.name]
    const defaultValue = fromStrategy?.default ?? savedValue ?? spec.default
    return { ...spec, default: defaultValue }
  })
}

export function withResolvedCustomStrategyParams(
  strategy: StrategyInfo,
  allStrategies: StrategyInfo[],
  customStrategies: CustomStrategy[],
): StrategyInfo {
  const params = resolveCustomStrategyParams(strategy, allStrategies, customStrategies)
  if (params === strategy.params) return strategy
  return { ...strategy, params }
}
