import { Trash2 } from 'lucide-react'

import { StrategySearchSpaceFields } from '@/components/optimize/StrategySearchSpaceFields'
import type { EntryInstanceState, EntryManagerState } from '@/lib/backtesting/entryInstances'
import type { SearchSpaceFieldState } from '@/lib/strategies/strategyParams'
import type {
  CustomStrategy,
  ExitRuleInfo,
  StrategyInfo,
  StrategyParamSpec,
} from '@/types/strategies'
import { groupExitParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'

type OptimizeStrategyDetailPanelProps = {
  entries: EntryInstanceState[]
  strategies: StrategyInfo[]
  customStrategies: CustomStrategy[]
  entrySearchSpaces: Record<string, Record<string, SearchSpaceFieldState>>
  exitSearchSpace: Record<string, SearchSpaceFieldState>
  managerSearchSpace: Record<string, SearchSpaceFieldState>
  entryManager: EntryManagerState
  managerParamSpecs: StrategyParamSpec[]
  candidateExitParamSpecs: StrategyParamSpec[]
  applicableExitRules: ExitRuleInfo[]
  resolveEntryParamSpecs: (strategyName: string) => StrategyParamSpec[]
  onEntrySearchSpaceChange: (slotId: string, name: string, field: SearchSpaceFieldState) => void
  onExitSearchSpaceChange: (name: string, field: SearchSpaceFieldState) => void
  onManagerSearchSpaceChange: (name: string, field: SearchSpaceFieldState) => void
  onRemoveEntry: (slotId: string) => void
}

function resolveStrategyLabel(
  strategyName: string,
  strategies: StrategyInfo[],
  customStrategies: CustomStrategy[],
): string {
  const custom = customStrategies.find((entry) => entry.name === strategyName)
  if (custom) return custom.name
  return strategies.find((entry) => entry.name === strategyName)?.label ?? strategyName
}

export function OptimizeStrategyDetailPanel({
  entries,
  strategies,
  customStrategies,
  entrySearchSpaces,
  exitSearchSpace,
  managerSearchSpace,
  entryManager,
  managerParamSpecs,
  candidateExitParamSpecs,
  applicableExitRules,
  resolveEntryParamSpecs,
  onEntrySearchSpaceChange,
  onExitSearchSpaceChange,
  onManagerSearchSpaceChange,
  onRemoveEntry,
}: OptimizeStrategyDetailPanelProps) {
  if (entries.length === 0) {
    return (
      <div className="border-carbon-600/50 bg-carbon-950/30 text-silver-400 flex h-full items-center justify-center rounded-xl border p-6 text-sm">
        Add an entry strategy to configure its search ranges.
      </div>
    )
  }

  const exitGroups = groupExitParamSpecs(candidateExitParamSpecs)
  const showSearchSpace =
    entries.some((entry) => resolveEntryParamSpecs(entry.strategy).length > 0) ||
    candidateExitParamSpecs.length > 0 ||
    applicableExitRules.length > 0 ||
    (entryManager.kind === 'majority' && managerParamSpecs.length > 0)

  return (
    <div className="border-carbon-600/50 bg-carbon-950/30 flex h-full min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border p-4">
      {showSearchSpace ? (
        <div className="space-y-4">
          <h4 className="text-silver-200 text-sm font-medium">Search Space</h4>

          {entries.map((entry, index) => {
            const entryParamSpecs = resolveEntryParamSpecs(entry.strategy)
            const label = resolveStrategyLabel(entry.strategy, strategies, customStrategies)
            const searchSpace = entrySearchSpaces[entry.slotId] ?? {}

            return (
              <section key={entry.slotId} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-brass-400 text-sm font-semibold">
                    e{index} · {label}
                  </h5>
                  {entries.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveEntry(entry.slotId)}
                      className="text-silver-400 rounded p-1 transition-colors hover:text-rose-300"
                      aria-label={`Remove ${label} instance`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
                {entryParamSpecs.length > 0 ? (
                  <StrategySearchSpaceFields
                    params={entryParamSpecs}
                    state={searchSpace}
                    onChange={(name, field) => onEntrySearchSpaceChange(entry.slotId, name, field)}
                  />
                ) : (
                  <p className="text-silver-500 text-xs">No searchable entry params.</p>
                )}
              </section>
            )
          })}

          {exitGroups.map(({ group, label, specs }) => (
            <div key={group} className="space-y-2">
              <h5 className="text-silver-400 text-xs font-semibold tracking-wide uppercase">
                {label}
              </h5>
              <StrategySearchSpaceFields
                params={specs}
                state={exitSearchSpace}
                onChange={onExitSearchSpaceChange}
              />
            </div>
          ))}

          {entryManager.kind === 'majority' && managerParamSpecs.length > 0 ? (
            <section className="space-y-2">
              <h5 className="text-silver-400 text-xs font-semibold tracking-wide uppercase">
                Manager
              </h5>
              <StrategySearchSpaceFields
                params={managerParamSpecs.map((spec) =>
                  spec.name === 'vote_threshold'
                    ? { ...spec, max: Math.max(entries.length, 1) }
                    : spec,
                )}
                state={managerSearchSpace}
                onChange={onManagerSearchSpaceChange}
              />
            </section>
          ) : null}

          {applicableExitRules.length > 0 && candidateExitParamSpecs.length === 0 ? (
            <p className="text-silver-500 text-xs">
              Select an exit strategy to include it in the search (on/off and magnitude).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
