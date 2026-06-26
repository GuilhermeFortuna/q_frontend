import { ExitStrategyCards } from '@/components/backtests/setup/ExitStrategyCards'
import { EntryManagerSelector } from '@/components/backtests/setup/EntryManagerSelector'
import { StrategyLibrary } from '@/components/backtests/setup/StrategyLibrary'
import { useSignalManagers } from '@/api/queries/strategies'
import { OptimizeMarketConfigBand } from '@/components/optimize/setup/OptimizeMarketConfigBand'
import { OptimizeStrategyDetailPanel } from '@/components/optimize/setup/OptimizeStrategyDetailPanel'
import { OptimizeStudyBand } from '@/components/optimize/setup/OptimizeStudyBand'
import { Button, Callout } from '@/components/ui'
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
  const { data: signalManagersData } = useSignalManagers()
  const signalManagers = signalManagersData?.managers ?? []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (config.validation.formInvalid || disabled || config.entries.length === 0) return
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
            multiSelect
            instanceCounts={config.instanceCounts}
            onAddEntry={(name) => {
              if (config.customStrategyNames.has(name)) {
                config.setters.handleStrategyChange(name)
                return
              }
              config.setters.addEntry(name)
            }}
            onSelectCustom={(custom) => config.setters.handleStrategyChange(custom.name)}
            loading={config.strategiesLoading}
            loadingSaved={config.customStrategiesLoading}
          />
          <EntryManagerSelector
            managers={signalManagers}
            value={config.entryManager}
            onChange={config.setters.setEntryManager}
            instanceCount={config.entries.length}
            showParams={false}
          />
          <ExitStrategyCards
            rules={config.applicableExitRules}
            exitParamSpecs={config.exitParamSpecs}
            isEnabled={(rule) => config.candidateExitRuleIds.has(rule.id)}
            onToggle={(rule) => config.toggleExitRule(rule.id)}
            heading="Exit Strategies"
            subheading="Selected exits are searched (on/off + magnitude)."
          />
        </div>
        <OptimizeStrategyDetailPanel
          entries={config.entries}
          strategies={config.strategies}
          customStrategies={config.customStrategies}
          entrySearchSpaces={config.entrySearchSpaces}
          exitSearchSpace={config.exitSearchSpace}
          managerSearchSpace={config.managerSearchSpace}
          entryManager={config.entryManager}
          managerParamSpecs={config.managerParamSpecs}
          candidateExitParamSpecs={config.candidateExitParamSpecs}
          applicableExitRules={config.applicableExitRules}
          resolveEntryParamSpecs={config.resolveEntryParamSpecs}
          onEntrySearchSpaceChange={config.setters.handleEntrySearchSpaceChange}
          onExitSearchSpaceChange={config.setters.handleExitSearchSpaceChange}
          onManagerSearchSpaceChange={config.setters.handleManagerSearchSpaceChange}
          onRemoveEntry={config.setters.removeEntry}
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
          <Callout type="error" title="Optimization Failed" className="mt-4">
            {error}
          </Callout>
        ) : null}
      </div>
    </form>
  )
}
