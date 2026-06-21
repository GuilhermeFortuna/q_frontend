import { memo } from 'react'

import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import type { StrategyParamValue } from '@/lib/strategies/strategyParams'
import { strategyThesis } from '@/lib/strategies/strategyPresentation'
import type { StrategyInfo } from '@/types/strategies'

type StrategyDetailPanelProps = {
  strategy: StrategyInfo | undefined
  values: Record<string, StrategyParamValue>
  onParamChange: (name: string, value: StrategyParamValue) => void
}

export const StrategyDetailPanel = memo(function StrategyDetailPanel({
  strategy,
  values,
  onParamChange,
}: StrategyDetailPanelProps) {
  if (!strategy) {
    return (
      <div className="border-carbon-600/50 bg-carbon-950/30 text-silver-400 flex h-full items-center justify-center rounded-xl border p-6 text-sm">
        Select a strategy to view its thesis and parameters.
      </div>
    )
  }

  const thesis = strategyThesis(strategy)
  const strongIn = strategy.strong_in?.trim()
  const weakIn = strategy.weak_in?.trim()

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

      {strategy.params.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-silver-200 text-sm font-medium">Parameters</h4>
          <StrategyParamFields
            params={strategy.params}
            values={values}
            onChange={onParamChange}
            showHints
            className="border-carbon-600/40 space-y-3 rounded-lg border p-3"
          />
        </div>
      ) : null}
    </div>
  )
})
