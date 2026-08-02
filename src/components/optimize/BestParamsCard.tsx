import { useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { GlowCard } from '@/components/ui/spotlight-card'
import { formatMultiObjectiveTrialValues } from '@/lib/optimize/multiObjectiveMetrics'
import { buildBacktestRequestFromTrial } from '@/lib/optimization/bridge'
import { useAppStore } from '@/store/useAppStore'
import type {
  OptimizationBacktestConfig,
  OptimizationResults,
  OptimizationTrial,
} from '@/types/optimization'

type BestParamsCardProps = {
  results: OptimizationResults
  backtest: OptimizationBacktestConfig
  trial?: OptimizationTrial | null
  title?: string
  onLoad?: () => void
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(4)
  }
  return String(value)
}

export function BestParamsCard({ results, backtest, trial, title, onLoad }: BestParamsCardProps) {
  const navigate = useNavigate()
  const setPendingBacktestConfig = useAppStore((s) => s.setPendingBacktestConfig)
  const patchBacktestSession = useAppStore((s) => s.patchBacktestSession)

  const displayTrial = trial ?? results.best_trial
  const strategyParams = displayTrial?.user_attrs.strategy_params ?? {}
  const riskParams = displayTrial?.user_attrs.risk_params ?? {}

  const handleLoad = () => {
    if (!displayTrial) return
    setPendingBacktestConfig(buildBacktestRequestFromTrial(displayTrial, backtest))
    patchBacktestSession({
      workflowMode: 'backtest',
      focus: 'setup',
      rightPanelTab: 'results',
    })
    onLoad?.()
    const onBacktestsPage =
      typeof window !== 'undefined' && window.location.pathname === '/backtests'
    if (!onBacktestsPage) {
      void navigate({ to: '/backtests' })
    }
  }

  const heading =
    title ??
    (displayTrial === results.best_trial
      ? `Best Trial${displayTrial ? ` #${displayTrial.number}` : ''}`
      : `Trial #${displayTrial?.number ?? '—'}`)

  return (
    <GlowCard intensity="card" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-brass-400 text-sm font-medium">{heading}</h4>
        <Button
          type="button"
          variant="brass"
          size="sm"
          onClick={handleLoad}
          disabled={!displayTrial}
        >
          Load into Backtest
        </Button>
      </div>

      {displayTrial?.values && (
        <p className="text-silver-300 text-xs">
          {results.is_multi_objective && displayTrial.values.length >= 2 ? (
            <>
              Objectives:{' '}
              <span className="text-silver-100">
                {formatMultiObjectiveTrialValues(displayTrial.values)}
              </span>
            </>
          ) : (
            <>
              Objective ({results.objective_mode}):{' '}
              <span className="text-silver-100">
                {displayTrial.values.map((v) => v.toFixed(4)).join(', ')}
              </span>
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {Object.entries(strategyParams).map(([key, value]) => (
          <div key={`strategy-${key}`} className="flex justify-between">
            <span className="text-silver-400">{key}</span>
            <span className="text-silver-100">{formatValue(value)}</span>
          </div>
        ))}
        {Object.entries(riskParams).map(([key, value]) => (
          <div key={`risk-${key}`} className="flex justify-between">
            <span className="text-silver-400">{key}</span>
            <span className="text-silver-100">{formatValue(value)}</span>
          </div>
        ))}
      </div>
    </GlowCard>
  )
}
