import type { StrategyParamValue } from '@/lib/strategies/strategyParams'
import type { ExitGroup, ExitRuleInfo, StrategyParamSpec } from '@/types/strategies'
import {
  EXIT_GROUP_LABELS,
  EXIT_GROUP_ORDER,
  EXIT_GROUP_OTHER_LABEL,
} from '@/workspaces/strategy/exitWorkbenchGroups'

const RULE_GROUP_ORDER = EXIT_GROUP_ORDER.filter(
  (group): group is Exclude<ExitGroup, 'general'> => group !== 'general',
)

export type GroupedExitRules = {
  group: ExitGroup | 'other'
  label: string
  rules: ExitRuleInfo[]
}

export function isExitRuleEnabled(
  rule: ExitRuleInfo,
  paramValues: Record<string, StrategyParamValue>,
): boolean {
  return Number(paramValues[rule.enable_param] ?? 0) > 0
}

/** Non-zero default when toggling a rule on: spec default if > 0, else midpoint of min..max. */
export function defaultEnableValue(spec: StrategyParamSpec): number {
  const defaultVal = Number(spec.default)
  if (defaultVal > 0) {
    return defaultVal
  }

  const min = spec.min ?? 0
  const max = spec.max ?? (spec.type === 'int' ? 100 : 1)

  if (spec.type === 'int') {
    return Math.max(1, Math.round((min + max) / 2))
  }

  const step = spec.step != null && spec.step > 0 ? spec.step : 0.01
  const mid = (min + max) / 2
  const rounded = Math.round(mid / step) * step
  return Math.max(step, rounded)
}

export function resolveRuleParamSpecs(
  rule: ExitRuleInfo,
  allSpecs: StrategyParamSpec[],
): StrategyParamSpec[] {
  const specByName = new Map(allSpecs.map((spec) => [spec.name, spec]))
  return rule.param_names
    .map((name) => specByName.get(name))
    .filter((spec): spec is StrategyParamSpec => spec != null)
}

type RuleExitGroup = Exclude<ExitGroup, 'general'>

function isRuleExitGroup(group: ExitGroup): group is RuleExitGroup {
  return group !== 'general'
}

export function groupExitRules(rules: ExitRuleInfo[]): GroupedExitRules[] {
  const buckets = new Map<ExitGroup | 'other', ExitRuleInfo[]>()

  for (const rule of rules) {
    const group: ExitGroup | 'other' = isRuleExitGroup(rule.exit_group) ? rule.exit_group : 'other'
    const bucket = buckets.get(group) ?? []
    bucket.push(rule)
    buckets.set(group, bucket)
  }

  const grouped: GroupedExitRules[] = []

  for (const group of RULE_GROUP_ORDER) {
    const groupRules = buckets.get(group)
    if (groupRules && groupRules.length > 0) {
      grouped.push({ group, label: EXIT_GROUP_LABELS[group], rules: groupRules })
    }
  }

  const otherRules = buckets.get('other')
  if (otherRules && otherRules.length > 0) {
    grouped.push({ group: 'other', label: EXIT_GROUP_OTHER_LABEL, rules: otherRules })
  }

  return grouped
}

export function getEnabledExitRules(
  rules: ExitRuleInfo[],
  paramValues: Record<string, StrategyParamValue>,
): ExitRuleInfo[] {
  return rules.filter((rule) => isExitRuleEnabled(rule, paramValues))
}

export function getVisibleSharedParamNames(
  rules: ExitRuleInfo[],
  paramValues: Record<string, StrategyParamValue>,
  sharedExitParams: string[],
): string[] {
  const enabledRules = getEnabledExitRules(rules, paramValues)
  const required = new Set<string>()
  for (const rule of enabledRules) {
    for (const name of rule.required_param_names) {
      required.add(name)
    }
  }
  return sharedExitParams.filter((name) => required.has(name))
}

export function buildClearAllExitUpdates(
  rules: ExitRuleInfo[],
): Record<string, StrategyParamValue> {
  return Object.fromEntries(rules.map((rule) => [rule.enable_param, 0]))
}

/** Patch for enabling or disabling an exit rule's enable_param. */
export function exitRuleEnableUpdate(
  rule: ExitRuleInfo,
  enabled: boolean,
  exitParamSpecs: StrategyParamSpec[],
): Record<string, StrategyParamValue> {
  if (!enabled) {
    return { [rule.enable_param]: 0 }
  }

  const enableSpec = exitParamSpecs.find((spec) => spec.name === rule.enable_param)
  const enableValue =
    typeof rule.enable_value === 'number' && rule.enable_value > 0
      ? rule.enable_value
      : enableSpec != null
        ? defaultEnableValue(enableSpec)
        : 1

  return { [rule.enable_param]: enableValue }
}

export function toggleExitRuleParam(
  rule: ExitRuleInfo,
  paramValues: Record<string, StrategyParamValue>,
  onChange: (name: string, value: StrategyParamValue) => void,
  exitParamSpecs: StrategyParamSpec[],
): void {
  const enabled = isExitRuleEnabled(rule, paramValues)
  const update = exitRuleEnableUpdate(rule, !enabled, exitParamSpecs)
  onChange(rule.enable_param, update[rule.enable_param])
}
