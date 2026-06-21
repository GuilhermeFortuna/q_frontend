import { ExitStrategyCards } from '@/components/backtests/setup/ExitStrategyCards'
import { StrategyLibrary } from '@/components/backtests/setup/StrategyLibrary'
import { OptimizeMarketConfigBand } from '@/components/optimize/setup/OptimizeMarketConfigBand'
import { OptimizeStrategyDetailPanel } from '@/components/optimize/setup/OptimizeStrategyDetailPanel'
import { OptimizeStudyBand } from '@/components/optimize/setup/OptimizeStudyBand'
import { Button } from '@/components/ui/button'
import type { useOptimizeConfig } from '@/lib/optimize/useOptimizeConfig'
import type { OptimizationConfig } from '@/types/optimization'

type OptimizeConfig = ReturnType<typeof useOptimizeConfig>

type OptimizeSetupPanelProps = {
  config: OptimizeConfig
  loading: boolean
  error: string | null
  disabled?: boolean
  onSubmit: (config: OptimizationConfig) => void
}

export function OptimizeSetupPanel({
  config,
  loading,
  error,
  disabled = false,
  onSubmit,
}: OptimizeSetupPanelProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (config.validation.formInvalid || disabled || !config.selectedStrategy) return
    onSubmit(config.buildOptimizationConfig())
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4" noValidate>
      <OptimizeMarketConfigBand
        fields={config.fields}
        setters={config.setters}
        validation={config.validation}
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <StrategyLibrary
            strategies={config.strategies}
            customStrategies={config.customStrategies}
            engine={config.fields.engine}
            selectedStrategyName={config.selectedStrategy?.name}
            onSelectBuiltIn={config.setters.handleStrategyChange}
            loading={config.strategiesLoading}
          />
          <ExitStrategyCards
            rules={config.applicableExitRules}
            isEnabled={(rule) => config.enabledExitRuleIds.has(rule.id)}
            onToggle={(rule) => config.toggleExitRule(rule.id)}
          />
        </div>
        <OptimizeStrategyDetailPanel
          strategy={config.selectedStrategy}
          entryParamSpecs={config.entryParamSpecs}
          enabledExitParamSpecs={config.enabledExitParamSpecs}
          applicableExitRules={config.applicableExitRules}
          searchSpace={config.fields.strategySearchSpace}
          onSearchSpaceChange={config.setters.handleSearchSpaceChange}
        />
      </div>

      <OptimizeStudyBand
        fields={config.fields}
        setters={config.setters}
        validation={config.validation}
      />

      <div className="border-carbon-600/50 shrink-0 border-t pt-4">
        <Button
          type="submit"
          disabled={
            loading || config.validation.formInvalid || disabled || config.strategiesLoading
          }
          variant="brass"
          className="min-w-[12rem]"
        >
          {loading ? 'Starting…' : disabled ? 'Study in progress…' : 'Run Optimization'}
        </Button>

        {disabled && !loading ? (
          <p className="text-silver-400 mt-2 text-xs">
            Wait for the current study to finish before starting another.
          </p>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs break-words text-rose-400">
            {error}
          </div>
        ) : null}
      </div>
    </form>
  )
}
