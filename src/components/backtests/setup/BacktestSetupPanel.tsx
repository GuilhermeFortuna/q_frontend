import { Button } from '@/components/ui/button'
import { MarketConfigBand } from '@/components/backtests/setup/MarketConfigBand'
import { StrategyDetailPanel } from '@/components/backtests/setup/StrategyDetailPanel'
import { StrategyLibrary } from '@/components/backtests/setup/StrategyLibrary'
import type { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import type { BacktestRequest } from '@/types/backtesting'

type BacktestConfig = ReturnType<typeof useBacktestConfig>

type BacktestSetupPanelProps = {
  config: BacktestConfig
  loading: boolean
  error: string | null
  onSubmit: (request: BacktestRequest) => void
}

export function BacktestSetupPanel({ config, loading, error, onSubmit }: BacktestSetupPanelProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (config.validation.formInvalid) return
    onSubmit(config.buildRequest())
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4" noValidate>
      <MarketConfigBand
        fields={config.fields}
        setters={config.setters}
        validation={config.validation}
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <StrategyLibrary
          strategies={config.strategies}
          engine={config.fields.engine}
          selectedStrategyName={config.selectedStrategy?.name}
          onSelectStrategy={config.setters.handleStrategyChange}
          loading={config.strategiesLoading}
        />
        <StrategyDetailPanel
          strategy={config.selectedStrategy}
          values={config.fields.strategyParams}
          onParamChange={config.setters.handleParamChange}
        />
      </div>

      <div className="border-carbon-600/50 shrink-0 border-t pt-4">
        <Button
          type="submit"
          disabled={loading || config.validation.formInvalid || config.strategiesLoading}
          variant="brass"
          className="min-w-[12rem]"
        >
          {loading ? 'Running…' : 'Run Simulation'}
        </Button>

        {error ? (
          <div className="mt-4 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs break-words text-rose-400">
            {error}
          </div>
        ) : null}
      </div>
    </form>
  )
}
