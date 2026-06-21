import {
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

export function initialCandidateExitRuleIds(
  rules: ExitRuleInfo[],
  exitParamSpecs: StrategyParamSpec[],
): Set<string> {
  const specByName = new Map(exitParamSpecs.map((spec) => [spec.name, spec]))
  const candidates = new Set<string>()
  for (const rule of rules) {
    const enableSpec = specByName.get(rule.enable_param)
    if (enableSpec != null && Number(enableSpec.default) > 0) {
      candidates.add(rule.id)
    }
  }
  return candidates
}

export function buildCandidateExitParamSpecs(
  candidateRules: ExitRuleInfo[],
  exitParamSpecs: StrategyParamSpec[],
  sharedExitParams: string[],
): StrategyParamSpec[] {
  const specByName = new Map(exitParamSpecs.map((spec) => [spec.name, spec]))
  const seen = new Set<string>()
  const result: StrategyParamSpec[] = []

  for (const rule of candidateRules) {
    for (const spec of resolveRuleParamSpecs(rule, exitParamSpecs)) {
      if (!seen.has(spec.name)) {
        seen.add(spec.name)
        result.push(spec)
      }
    }
  }

  const syntheticValues = Object.fromEntries(candidateRules.map((rule) => [rule.enable_param, 1]))
  for (const name of getVisibleSharedParamNames(
    candidateRules,
    syntheticValues,
    sharedExitParams,
  )) {
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
  exitParamSpecs: StrategyParamSpec[],
): SearchParam {
  const enableSpec = exitParamSpecs.find((spec) => spec.name === rule.enable_param)

  if (enableSpec?.type === 'categorical') {
    return { type: 'categorical', choices: ['0'] }
  }

  if (enableSpec?.type === 'int') {
    return { type: 'int', low: 0, high: 0, step: 1 }
  }

  return { type: 'float', low: 0, high: 0, step: null }
}

function forceEnableParamRangeIncludesOff(param: SearchParam): SearchParam {
  if (param.type === 'categorical') {
    return param
  }
  if (param.type === 'int') {
    return { ...param, low: 0, step: param.step ?? 1 }
  }
  if (param.type === 'log-float') {
    return { ...param, low: 0 }
  }
  return {
    ...param,
    low: 0,
    step: param.step != null && param.step > 0 ? param.step : null,
  }
}

export function buildStrategyParamsSearchSpacePayload(
  strategySearchSpace: Record<string, SearchSpaceFieldState>,
  entryParamSpecs: StrategyParamSpec[],
  exitParamSpecs: StrategyParamSpec[],
  applicableExitRules: ExitRuleInfo[],
  candidateExitRuleIds: Set<string>,
  sharedExitParams: string[],
): Record<string, SearchParam> {
  const candidateRules = applicableExitRules.filter((rule) => candidateExitRuleIds.has(rule.id))
  const nonCandidateRules = applicableExitRules.filter((rule) => !candidateExitRuleIds.has(rule.id))
  const candidateExitSpecs = buildCandidateExitParamSpecs(
    candidateRules,
    exitParamSpecs,
    sharedExitParams,
  )
  const tunableSpecs = [...entryParamSpecs, ...candidateExitSpecs]

  const payload = searchSpaceToPayload(strategySearchSpace, tunableSpecs)

  for (const rule of candidateRules) {
    const enableParam = payload[rule.enable_param]
    if (enableParam != null) {
      payload[rule.enable_param] = forceEnableParamRangeIncludesOff(enableParam)
    }
  }
  for (const rule of nonCandidateRules) {
    payload[rule.enable_param] = pinEnableParamSearchParam(rule, exitParamSpecs)
  }

  return payload
}
