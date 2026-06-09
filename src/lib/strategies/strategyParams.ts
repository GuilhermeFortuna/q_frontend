import type { StrategyParamSpec } from '@/types/strategies'
import type { SearchParam } from '@/types/optimization'

export type StrategyParamValue = string | number

export type NumericSearchRange = { kind: 'numeric'; low: number; high: number }
export type CategoricalSearchChoices = { kind: 'categorical'; choices: string[] }
export type SearchSpaceFieldState = NumericSearchRange | CategoricalSearchChoices

export function defaultParamsFromSpecs(
  specs: StrategyParamSpec[],
): Record<string, StrategyParamValue> {
  return Object.fromEntries(specs.map((spec) => [spec.name, spec.default]))
}

export function mergeParamValues(
  specs: StrategyParamSpec[],
  values: Record<string, unknown> | undefined,
): Record<string, StrategyParamValue> {
  const merged = defaultParamsFromSpecs(specs)
  if (!values) return merged

  for (const spec of specs) {
    if (values[spec.name] == null) continue
    if (spec.type === 'int') {
      merged[spec.name] = Number(values[spec.name])
    } else if (spec.type === 'float') {
      merged[spec.name] = Number(values[spec.name])
    } else {
      merged[spec.name] = String(values[spec.name])
    }
  }
  return merged
}

export function defaultSearchSpaceFromSpecs(
  specs: StrategyParamSpec[],
): Record<string, SearchSpaceFieldState> {
  const result: Record<string, SearchSpaceFieldState> = {}
  for (const spec of specs) {
    if (spec.type === 'categorical') {
      result[spec.name] = { kind: 'categorical', choices: [String(spec.default)] }
      continue
    }
    result[spec.name] = {
      kind: 'numeric',
      low: spec.min ?? Number(spec.default),
      high: spec.max ?? Number(spec.default),
    }
  }
  return result
}

export function searchSpaceToPayload(
  state: Record<string, SearchSpaceFieldState>,
  specs: StrategyParamSpec[],
): Record<string, SearchParam> {
  const result: Record<string, SearchParam> = {}
  for (const spec of specs) {
    const field = state[spec.name]
    if (!field) continue
    if (field.kind === 'categorical') {
      result[spec.name] = { type: 'categorical', choices: field.choices }
    } else if (spec.type === 'int') {
      result[spec.name] = { type: 'int', low: field.low, high: field.high }
    } else {
      result[spec.name] = { type: 'float', low: field.low, high: field.high }
    }
  }
  return result
}

export function hydrateSearchSpaceFromPayload(
  payload: Record<string, SearchParam>,
  specs: StrategyParamSpec[],
): Record<string, SearchSpaceFieldState> {
  const result = defaultSearchSpaceFromSpecs(specs)
  for (const spec of specs) {
    const param = payload[spec.name]
    if (!param) continue
    if (param.type === 'categorical') {
      result[spec.name] = { kind: 'categorical', choices: param.choices.map(String) }
    } else if (param.type === 'int' || param.type === 'float') {
      result[spec.name] = { kind: 'numeric', low: param.low, high: param.high }
    }
  }
  return result
}

export function validateSearchSpace(state: Record<string, SearchSpaceFieldState>): boolean {
  for (const field of Object.values(state)) {
    if (field.kind === 'numeric' && field.low > field.high) return false
    if (field.kind === 'categorical' && field.choices.length === 0) return false
  }
  return true
}
