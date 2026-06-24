import {
  defaultParamsFromSpecs,
  mergeParamValues,
  type StrategyParamValue,
} from '@/lib/strategies/strategyParams'
import type { EntryInstance, EntryManagerConfig } from '@/types/backtesting'
import type { StrategyParamSpec } from '@/types/strategies'
import { partitionStrategyParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'

export type EntryInstanceState = {
  slotId: string
  strategy: string
  params: Record<string, StrategyParamValue>
}

export type EntryManagerState = {
  kind: 'or' | 'and' | 'majority'
  params: Record<string, StrategyParamValue>
}

let slotCounter = 0

export function createEntrySlotId(): string {
  slotCounter += 1
  return `entry-${slotCounter}`
}

export function defaultEntryManager(): EntryManagerState {
  return { kind: 'or', params: {} }
}

export function splitParamsByPartition(
  specs: StrategyParamSpec[],
  values: Record<string, unknown> | undefined,
): {
  entryParams: Record<string, StrategyParamValue>
  exitParams: Record<string, StrategyParamValue>
} {
  const { entryParamSpecs, exitParamSpecs } = partitionStrategyParamSpecs(specs)
  const merged = mergeParamValues(specs, values)
  const entryNames = new Set(entryParamSpecs.map((spec) => spec.name))
  const exitNames = new Set(exitParamSpecs.map((spec) => spec.name))

  const entryParams: Record<string, StrategyParamValue> = {}
  const exitParams: Record<string, StrategyParamValue> = {}

  for (const [key, value] of Object.entries(merged)) {
    if (entryNames.has(key)) {
      entryParams[key] = value
    } else if (exitNames.has(key)) {
      exitParams[key] = value
    }
  }

  return { entryParams, exitParams }
}

export function entryDefaultsFromSpecs(
  specs: StrategyParamSpec[],
): Record<string, StrategyParamValue> {
  const { entryParamSpecs } = partitionStrategyParamSpecs(specs)
  return defaultParamsFromSpecs(entryParamSpecs)
}

export function exitDefaultsFromSpecs(
  specs: StrategyParamSpec[],
): Record<string, StrategyParamValue> {
  const { exitParamSpecs } = partitionStrategyParamSpecs(specs)
  return defaultParamsFromSpecs(exitParamSpecs)
}

export function instanceCountByStrategy(entries: EntryInstanceState[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const entry of entries) {
    counts[entry.strategy] = (counts[entry.strategy] ?? 0) + 1
  }
  return counts
}

export function toEntryPayload(entries: EntryInstanceState[]): EntryInstance[] {
  return entries.map(({ strategy, params }) => ({ strategy, params }))
}

export function toEntryManagerPayload(manager: EntryManagerState): EntryManagerConfig {
  return {
    kind: manager.kind,
    params: manager.params,
  }
}
