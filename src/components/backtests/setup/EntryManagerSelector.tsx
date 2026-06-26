import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import type { EntryManagerState } from '@/lib/backtesting/entryInstances'
import type { StrategyParamValue } from '@/lib/strategies/strategyParams'
import type { SignalManagerInfo } from '@/types/strategies'

type EntryManagerSelectorProps = {
  managers: SignalManagerInfo[]
  value: EntryManagerState
  onChange: (manager: EntryManagerState) => void
  instanceCount: number
  /** When false, only render kind buttons (optimize uses search ranges in the detail panel). */
  showParams?: boolean
}

export function EntryManagerSelector({
  managers,
  value,
  onChange,
  instanceCount,
  showParams = true,
}: EntryManagerSelectorProps) {
  const activeManager = managers.find((manager) => manager.id === value.kind) ?? managers[0]
  const majoritySpecs =
    value.kind === 'majority'
      ? (activeManager?.params ?? []).map((spec) =>
          spec.name === 'vote_threshold'
            ? {
                ...spec,
                max: Math.max(instanceCount, 1),
              }
            : spec,
        )
      : []

  const handleKindChange = (kind: EntryManagerState['kind']) => {
    const manager = managers.find((entry) => entry.id === kind)
    const nextParams: Record<string, StrategyParamValue> = {}
    if (kind === 'majority') {
      const voteSpec = manager?.params.find((spec) => spec.name === 'vote_threshold')
      const defaultVote = Number(voteSpec?.default ?? 2)
      nextParams.vote_threshold = Math.min(Math.max(defaultVote, 1), Math.max(instanceCount, 1))
    }
    onChange({ kind, params: nextParams })
  }

  const handleManagerParamChange = (name: string, paramValue: StrategyParamValue) => {
    if (name !== 'vote_threshold') {
      onChange({ ...value, params: { ...value.params, [name]: paramValue } })
      return
    }
    const clamped = Math.min(Math.max(Number(paramValue), 1), Math.max(instanceCount, 1))
    onChange({ ...value, params: { ...value.params, [name]: clamped } })
  }

  if (managers.length === 0) {
    return null
  }

  return (
    <Panel living className="space-y-3 p-3" data-testid="entry-manager-selector">
      <PanelHeader title="Manager" />
      <SegmentedToggle
        aria-label="Entry manager"
        options={managers.map((manager) => ({
          value: manager.id as EntryManagerState['kind'],
          label: manager.label,
        }))}
        value={value.kind}
        onChange={handleKindChange}
      />
      {showParams && majoritySpecs.length > 0 ? (
        <StrategyParamFields
          params={majoritySpecs}
          values={value.params}
          onChange={handleManagerParamChange}
          className="grid gap-3 sm:grid-cols-2"
          showHints
          hintMode="compact"
        />
      ) : null}
    </Panel>
  )
}
