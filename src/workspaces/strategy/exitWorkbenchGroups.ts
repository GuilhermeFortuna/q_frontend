import type { ExitGroup, StrategyParamSpec } from '@/types/strategies'

export const EXIT_GROUP_ORDER: readonly ExitGroup[] = ['stop_loss', 'trailing', 'target', 'time']

export const EXIT_GROUP_LABELS: Record<ExitGroup, string> = {
  stop_loss: 'Stop Loss',
  trailing: 'Trailing Stops',
  target: 'Profit Targets',
  time: 'Time Exits',
}

export const EXIT_GROUP_OTHER_LABEL = 'Other Exits'

export type ExitParamGroup = ExitGroup | 'other'

export type GroupedExitParamSpecs = {
  group: ExitParamGroup
  label: string
  specs: StrategyParamSpec[]
}

const KNOWN_EXIT_GROUPS = new Set<string>(EXIT_GROUP_ORDER)

export function partitionStrategyParamSpecs(specs: StrategyParamSpec[]) {
  return {
    entryParamSpecs: specs.filter((spec) => spec.exit_group == null),
    exitParamSpecs: specs.filter((spec) => spec.exit_group != null),
  }
}

export function groupExitParamSpecs(exitParamSpecs: StrategyParamSpec[]): GroupedExitParamSpecs[] {
  const buckets = new Map<ExitParamGroup, StrategyParamSpec[]>()

  for (const spec of exitParamSpecs) {
    const rawGroup = spec.exit_group
    if (rawGroup == null) {
      continue
    }

    const group: ExitParamGroup = KNOWN_EXIT_GROUPS.has(rawGroup) ? rawGroup : 'other'
    const bucket = buckets.get(group) ?? []
    bucket.push(spec)
    buckets.set(group, bucket)
  }

  const grouped: GroupedExitParamSpecs[] = []

  for (const group of EXIT_GROUP_ORDER) {
    const specs = buckets.get(group)
    if (specs && specs.length > 0) {
      grouped.push({ group, label: EXIT_GROUP_LABELS[group], specs })
    }
  }

  const otherSpecs = buckets.get('other')
  if (otherSpecs && otherSpecs.length > 0) {
    grouped.push({ group: 'other', label: EXIT_GROUP_OTHER_LABEL, specs: otherSpecs })
  }

  return grouped
}
