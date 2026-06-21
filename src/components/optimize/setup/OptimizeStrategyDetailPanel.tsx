import { StrategySearchSpaceFields } from '@/components/optimize/StrategySearchSpaceFields'
import type { SearchSpaceFieldState } from '@/lib/strategies/strategyParams'
import { strategyThesis } from '@/lib/strategies/strategyPresentation'
import type { ExitRuleInfo, StrategyInfo, StrategyParamSpec } from '@/types/strategies'
import { groupExitParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'

type OptimizeStrategyDetailPanelProps = {
  strategy: StrategyInfo | undefined
  entryParamSpecs: StrategyParamSpec[]
  candidateExitParamSpecs: StrategyParamSpec[]
  applicableExitRules: ExitRuleInfo[]
  searchSpace: Record<string, SearchSpaceFieldState>
  onSearchSpaceChange: (name: string, field: SearchSpaceFieldState) => void
}

export function OptimizeStrategyDetailPanel({
  strategy,
  entryParamSpecs,
  candidateExitParamSpecs,
  applicableExitRules,
  searchSpace,
  onSearchSpaceChange,
}: OptimizeStrategyDetailPanelProps) {
  if (!strategy) {
    return (
      <div className="border-carbon-600/50 bg-carbon-950/30 text-silver-400 flex h-full items-center justify-center rounded-xl border p-6 text-sm">
        Select a strategy to view its thesis and search space.
      </div>
    )
  }

  const thesis = strategyThesis(strategy)
  const strongIn = strategy.strong_in?.trim()
  const weakIn = strategy.weak_in?.trim()
  const exitGroups = groupExitParamSpecs(candidateExitParamSpecs)
  const showSearchSpace =
    entryParamSpecs.length > 0 ||
    candidateExitParamSpecs.length > 0 ||
    applicableExitRules.length > 0

  return (
    <div className="border-carbon-600/50 bg-carbon-950/30 flex h-full min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border p-4">
      <div>
        <h3 className="text-brass-400 text-lg font-bold">{strategy.label}</h3>
        <p className="text-silver-300 mt-2 text-sm leading-relaxed">{thesis}</p>
      </div>

      {strongIn || weakIn ? (
        <div className="space-y-2 text-sm">
          {strongIn ? (
            <p>
              <span className="text-brass-400/90 font-semibold">Strong in: </span>
              <span className="text-silver-300">{strongIn}</span>
            </p>
          ) : null}
          {weakIn ? (
            <p>
              <span className="font-semibold text-rose-400/80">Weak in: </span>
              <span className="text-silver-300">{weakIn}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {showSearchSpace ? (
        <div className="space-y-4">
          <h4 className="text-silver-200 text-sm font-medium">Search Space</h4>
          {entryParamSpecs.length > 0 ? (
            <StrategySearchSpaceFields
              params={entryParamSpecs}
              state={searchSpace}
              onChange={onSearchSpaceChange}
            />
          ) : null}
          {exitGroups.map(({ group, label, specs }) => (
            <div key={group} className="space-y-2">
              <h5 className="text-silver-400 text-xs font-semibold tracking-wide uppercase">
                {label}
              </h5>
              <StrategySearchSpaceFields
                params={specs}
                state={searchSpace}
                onChange={onSearchSpaceChange}
              />
            </div>
          ))}
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
