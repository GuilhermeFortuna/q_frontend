import { Button } from '@/components/ui/button'
import { MarketConfigBand } from '@/components/backtests/setup/MarketConfigBand'
import { StrategyStudio } from '@/components/backtests/setup/StrategyStudio'
import type { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import type { BacktestRequest } from '@/types/backtesting'

type BacktestConfig = ReturnType<typeof useBacktestConfig>

type BacktestSetupPanelProps = {
  config: BacktestConfig
  loading: boolean
  error: string | null
  onSubmit: (request: BacktestRequest) => void
  onAiWorkflowBlockerChange?: (blocker: string | null) => void
  aiWorkflowBlocker?: string | null
}

export function BacktestSetupPanel({
  config,
  loading,
  error,
  onSubmit,
  onAiWorkflowBlockerChange,
  aiWorkflowBlocker = null,
}: BacktestSetupPanelProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (config.validation.formInvalid) return
    if (aiWorkflowBlocker) return
    onSubmit(config.buildRequest())
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4" noValidate>
      <MarketConfigBand
        fields={config.fields}
        setters={config.setters}
        validation={config.validation}
      />

      <StrategyStudio
        config={config}
        onRunBacktest={onSubmit}
        onAiWorkflowBlockerChange={onAiWorkflowBlockerChange}
      />

      <div className="border-carbon-600/50 shrink-0 border-t pt-4">
        <Button
          type="submit"
          disabled={
            loading ||
            config.validation.formInvalid ||
            config.strategiesLoading ||
            Boolean(aiWorkflowBlocker)
          }
          variant="brass"
          className="min-w-[12rem]"
          data-testid="run-simulation-button"
        >
          {loading ? 'Running…' : 'Run Simulation'}
        </Button>

        {aiWorkflowBlocker ? (
          <div
            className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100"
            data-testid="run-simulation-ai-blocker"
          >
            {aiWorkflowBlocker}
          </div>
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
