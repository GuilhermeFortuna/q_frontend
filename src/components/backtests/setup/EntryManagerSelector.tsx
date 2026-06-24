import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import { cn } from '@/lib/utils'
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
    <section
      className="bg-carbon-900/20 border-carbon-800/40 space-y-3 rounded-lg border p-3"
      data-testid="entry-manager-selector"
    >
      <h5 className="text-silver-400 text-xs font-semibold tracking-wide uppercase">Manager</h5>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Entry manager">
        {managers.map((manager) => (
          <button
            key={manager.id}
            type="button"
            aria-pressed={value.kind === manager.id}
            onClick={() => handleKindChange(manager.id as EntryManagerState['kind'])}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
              value.kind === manager.id
                ? 'border-brass-500/50 bg-brass-600/15 text-brass-400'
                : 'border-carbon-600/40 bg-carbon-900/40 text-silver-300 hover:border-brass-500/30 hover:text-brass-400',
            )}
          >
            {manager.label}
          </button>
        ))}
      </div>
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
    </section>
  )
}
