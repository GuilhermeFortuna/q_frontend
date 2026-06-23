import type { StrategyParamSpec } from '@/types/strategies'
import type { SearchParam } from '@/types/optimization'

export type StrategyParamValue = string | number

// `step` is the optimizer sampling grid for this parameter. A non-null value
// constrains Optuna to discrete points (e.g. 0.1, 0.2, …) which keeps results
// readable and curbs overfitting to noise; `null` means a continuous float range.
export type NumericSearchRange = {
  kind: 'numeric'
  low: number
  high: number
  step?: number | null
}
export type CategoricalSearchChoices = { kind: 'categorical'; choices: string[] }
export type SearchSpaceFieldState = NumericSearchRange | CategoricalSearchChoices

function searchBoundsForSpec(spec: StrategyParamSpec): {
  low: number
  high: number
  step: number | null
} {
  const low = spec.search_min ?? spec.min ?? Number(spec.default)
  const high = spec.search_max ?? spec.max ?? Number(spec.default)
  const step =
    spec.search_step ??
    spec.step ??
    (spec.type === 'int' ? 1 : spec.search_scale === 'log' ? null : null)
  return { low, high, step }
}

// Optuna requires an integer step for int params; fall back to a coarse grid of 1.
function defaultStepForSpec(spec: StrategyParamSpec): number | null {
  if (spec.search_step != null) return spec.search_step
  if (spec.step != null) return spec.step
  return spec.type === 'int' ? 1 : null
}

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

/** Hydrate form params from a staged backtest config. Spec-less strategies (e.g. CompositeStrategy) pass through as-is so genome JSON is preserved. */
export function hydrateStrategyParamsFromPending(
  specs: StrategyParamSpec[],
  values: Record<string, unknown> | undefined,
): Record<string, StrategyParamValue> {
  if (!values) return defaultParamsFromSpecs(specs)
  if (specs.length === 0) return values as Record<string, StrategyParamValue>
  return mergeParamValues(specs, values)
}

export function defaultSearchSpaceFromSpecs(
  specs: StrategyParamSpec[],
): Record<string, SearchSpaceFieldState> {
  const result: Record<string, SearchSpaceFieldState> = {}
  for (const spec of specs) {
    if (spec.searchable === false) continue
    if (spec.type === 'categorical') {
      result[spec.name] = { kind: 'categorical', choices: [String(spec.default)] }
      continue
    }
    const { low, high } = searchBoundsForSpec(spec)
    result[spec.name] = {
      kind: 'numeric',
      low,
      high,
      step: defaultStepForSpec(spec),
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
    if (spec.searchable === false) continue
    const field = state[spec.name]
    if (!field) continue
    if (field.kind === 'categorical') {
      result[spec.name] = { type: 'categorical', choices: field.choices }
    } else if (spec.type === 'int') {
      // Optuna's int step must be a positive integer; coerce and default to 1.
      const step = field.step != null && field.step >= 1 ? Math.round(field.step) : 1
      result[spec.name] = { type: 'int', low: field.low, high: field.high, step }
    } else if (spec.search_scale === 'log' && field.low > 0) {
      result[spec.name] = { type: 'log-float', low: field.low, high: field.high }
    } else {
      const step = field.step != null && field.step > 0 ? field.step : null
      result[spec.name] = { type: 'float', low: field.low, high: field.high, step }
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
    } else if (param.type === 'int') {
      result[spec.name] = {
        kind: 'numeric',
        low: param.low,
        high: param.high,
        step: param.step ?? 1,
      }
    } else if (param.type === 'log-float') {
      result[spec.name] = {
        kind: 'numeric',
        low: param.low,
        high: param.high,
        step: null,
      }
    } else if (param.type === 'float') {
      result[spec.name] = {
        kind: 'numeric',
        low: param.low,
        high: param.high,
        step: param.step ?? null,
      }
    }
  }
  return result
}

export function validateSearchSpace(state: Record<string, SearchSpaceFieldState>): boolean {
  for (const field of Object.values(state)) {
    if (field.kind === 'numeric' && field.low > field.high) return false
    if (field.kind === 'numeric' && field.step != null && field.step <= 0) return false
    if (field.kind === 'categorical' && field.choices.length === 0) return false
  }
  return true
}
