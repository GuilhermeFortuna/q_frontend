import {
  defaultSearchSpaceFromSpecs,
  hydrateSearchSpaceFromPayload,
  searchSpaceToPayload,
  type SearchSpaceFieldState,
} from '@/lib/strategies/strategyParams'
import type { SearchParam } from '@/types/optimization'
import type { StrategyParamSpec } from '@/types/strategies'
import { partitionStrategyParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'

export function entryIndexKey(index: number): string {
  return `e${index}`
}

export function namespacedEntryParamKey(index: number, paramName: string): string {
  return `${entryIndexKey(index)}__${paramName}`
}

export function defaultEntrySearchSpaceFromSpecs(
  specs: StrategyParamSpec[],
): Record<string, SearchSpaceFieldState> {
  const { entryParamSpecs } = partitionStrategyParamSpecs(specs)
  return defaultSearchSpaceFromSpecs(entryParamSpecs)
}

export function defaultExitSearchSpaceFromSpecs(
  specs: StrategyParamSpec[],
): Record<string, SearchSpaceFieldState> {
  const { exitParamSpecs } = partitionStrategyParamSpecs(specs)
  return defaultSearchSpaceFromSpecs(exitParamSpecs)
}

export function entrySearchSpaceToPayload(
  index: number,
  searchSpace: Record<string, SearchSpaceFieldState>,
  entryParamSpecs: StrategyParamSpec[],
): Record<string, SearchParam> {
  const payload = searchSpaceToPayload(searchSpace, entryParamSpecs)
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [namespacedEntryParamKey(index, key), value]),
  )
}

export function hydrateEntrySearchSpacesFromPayload(
  entries: Array<{ slotId: string; strategy: string }>,
  payload: Record<string, SearchParam>,
  resolveSpecs: (strategyName: string) => StrategyParamSpec[],
): Record<string, Record<string, SearchSpaceFieldState>> {
  const result: Record<string, Record<string, SearchSpaceFieldState>> = {}

  entries.forEach((entry, index) => {
    const prefix = `${entryIndexKey(index)}__`
    const sliced: Record<string, SearchParam> = {}
    for (const [key, value] of Object.entries(payload)) {
      if (key.startsWith(prefix)) {
        sliced[key.slice(prefix.length)] = value
      }
    }
    const { entryParamSpecs } = partitionStrategyParamSpecs(resolveSpecs(entry.strategy))
    result[entry.slotId] = hydrateSearchSpaceFromPayload(sliced, entryParamSpecs)
  })

  return result
}

export function mergeExitSearchSpaceDefaults(
  current: Record<string, SearchSpaceFieldState>,
  specs: StrategyParamSpec[],
): Record<string, SearchSpaceFieldState> {
  const defaults = defaultExitSearchSpaceFromSpecs(specs)
  return { ...defaults, ...current }
}
