import {
  defaultEnableValue,
  getVisibleSharedParamNames,
  resolveRuleParamSpecs,
} from '@/workspaces/strategy/exitRuleSemantics'
import { searchSpaceToPayload, type SearchSpaceFieldState } from '@/lib/strategies/strategyParams'
import type { ExitRuleInfo, StrategyParamSpec } from '@/types/strategies'
import type { SearchParam } from '@/types/optimization'

export function filterApplicableExitRules(
  exitRules: ExitRuleInfo[],
  exitParamSpecs: StrategyParamSpec[],
): ExitRuleInfo[] {
  const enableParams = new Set(exitParamSpecs.map((spec) => spec.name))
  return exitRules.filter((rule) => enableParams.has(rule.enable_param))
}

export function initialEnabledExitRuleIds(
  rules: ExitRuleInfo[],
  exitParamSpecs: StrategyParamSpec[],
): Set<string> {
  const specByName = new Map(exitParamSpecs.map((spec) => [spec.name, spec]))
  const enabled = new Set<string>()
  for (const rule of rules) {
    const enableSpec = specByName.get(rule.enable_param)
    if (enableSpec != null && Number(enableSpec.default) > 0) {
      enabled.add(rule.id)
    }
  }
  return enabled
}

export function getTunableRuleParamSpecs(
  rule: ExitRuleInfo,
  exitParamSpecs: StrategyParamSpec[],
): StrategyParamSpec[] {
  return resolveRuleParamSpecs(rule, exitParamSpecs).filter(
    (spec) => spec.name !== rule.enable_param,
  )
}

export function buildEnabledExitParamSpecs(
  enabledRules: ExitRuleInfo[],
  exitParamSpecs: StrategyParamSpec[],
  sharedExitParams: string[],
): StrategyParamSpec[] {
  const specByName = new Map(exitParamSpecs.map((spec) => [spec.name, spec]))
  const seen = new Set<string>()
  const result: StrategyParamSpec[] = []

  for (const rule of enabledRules) {
    for (const spec of getTunableRuleParamSpecs(rule, exitParamSpecs)) {
      if (!seen.has(spec.name)) {
        seen.add(spec.name)
        result.push(spec)
      }
    }
  }

  const syntheticValues = Object.fromEntries(enabledRules.map((rule) => [rule.enable_param, 1]))
  for (const name of getVisibleSharedParamNames(enabledRules, syntheticValues, sharedExitParams)) {
    const spec = specByName.get(name)
    if (spec != null && !seen.has(name)) {
      seen.add(name)
      result.push(spec)
    }
  }

  return result
}

export function pinEnableParamSearchParam(
  rule: ExitRuleInfo,
  enabled: boolean,
  exitParamSpecs: StrategyParamSpec[],
): SearchParam {
  const enableSpec = exitParamSpecs.find((spec) => spec.name === rule.enable_param)
  const value = enabled
    ? typeof rule.enable_value === 'number' && rule.enable_value > 0
      ? rule.enable_value
      : enableSpec != null
        ? defaultEnableValue(enableSpec)
        : 1
    : 0

  if (enableSpec?.type === 'categorical') {
    return { type: 'categorical', choices: [String(value)] }
  }

  if (enableSpec?.type === 'int') {
    return { type: 'int', low: value, high: value, step: 1 }
  }

  return { type: 'float', low: value, high: value, step: null }
}

export function buildStrategyParamsSearchSpacePayload(
  strategySearchSpace: Record<string, SearchSpaceFieldState>,
  entryParamSpecs: StrategyParamSpec[],
  exitParamSpecs: StrategyParamSpec[],
  applicableExitRules: ExitRuleInfo[],
  enabledExitRuleIds: Set<string>,
  sharedExitParams: string[],
): Record<string, SearchParam> {
  const enabledRules = applicableExitRules.filter((rule) => enabledExitRuleIds.has(rule.id))
  const disabledRules = applicableExitRules.filter((rule) => !enabledExitRuleIds.has(rule.id))
  const enabledExitSpecs = buildEnabledExitParamSpecs(
    enabledRules,
    exitParamSpecs,
    sharedExitParams,
  )
  const tunableSpecs = [...entryParamSpecs, ...enabledExitSpecs]

  const payload = searchSpaceToPayload(strategySearchSpace, tunableSpecs)

  for (const rule of enabledRules) {
    payload[rule.enable_param] = pinEnableParamSearchParam(rule, true, exitParamSpecs)
  }
  for (const rule of disabledRules) {
    payload[rule.enable_param] = pinEnableParamSearchParam(rule, false, exitParamSpecs)
  }

  return payload
}
