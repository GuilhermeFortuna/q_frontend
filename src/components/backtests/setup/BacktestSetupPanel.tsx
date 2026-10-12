import { useState } from 'react'

import { useStorageInventory } from '@/api/queries/storage'
import { Button, Callout } from '@/components/ui'
import { MLFilterConfig } from '@/components/backtests/setup/MLFilterConfig'
import { MarketConfigBand } from '@/components/backtests/setup/MarketConfigBand'
import { StrategyStudio } from '@/components/backtests/setup/StrategyStudio'
import { TickCoverageNotice } from '@/components/backtests/setup/TickCoverageNotice'
import { requiresTickData, resolveTickCoverage } from '@/lib/backtesting/tickCoverage'
import type { TickCoverage } from '@/lib/backtesting/tickCoverage'
import type { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import type { BacktestRequest } from '@/types/backtesting'

type BacktestConfig = ReturnType<typeof useBacktestConfig>

type BacktestSetupPanelProps = {
  config: BacktestConfig
  loading: boolean
  error: string | null
  onSubmit: (request: BacktestRequest) => void
  aiWorkflowBlocker?: string | null
}

export function BacktestSetupPanel({
  config,
  loading,
  error,
  onSubmit,
  aiWorkflowBlocker = null,
}: BacktestSetupPanelProps) {
  const [pending, setPending] = useState<{
    request: BacktestRequest
    coverage: Extract<TickCoverage, { status: 'clamped' }>
  } | null>(null)
  const request = config.buildRequest()
  const { data: inventory } = useStorageInventory({ enabled: requiresTickData(request) })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (config.validation.formInvalid) return
    if (aiWorkflowBlocker) return
    const ticks = inventory?.items.find(
      (item) => item.kind === 'ticks' && item.symbol === request.symbol,
    )
    const coverage = resolveTickCoverage(request, ticks)
    if (coverage.status === 'clamped') {
      setPending({ request, coverage })
      return
    }
    onSubmit(request)
  }

  const confirmClamped = () => {
    if (!pending) return
    const { request: original, coverage } = pending
    setPending(null)
    config.setters.setStartDate(new Date(coverage.used.start))
    config.setters.setEndDate(new Date(coverage.used.end))
    onSubmit({ ...original, start: coverage.used.start, end: coverage.used.end })
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4" noValidate>
      <MarketConfigBand
        fields={config.fields}
        setters={config.setters}
        validation={config.validation}
      />

      <MLFilterConfig config={config} />

      <StrategyStudio config={config} />

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
          <Callout
            type="warning"
            title="Simulation Blocked"
            className="mt-3"
            data-testid="run-simulation-ai-blocker"
          >
            {aiWorkflowBlocker}
          </Callout>
        ) : null}

        {error ? (
          <Callout type="error" title="Simulation Failed" className="mt-4">
            {error}
          </Callout>
        ) : null}
      </div>
      {pending ? (
        <TickCoverageNotice
          open
          symbol={pending.coverage.symbol}
          requested={pending.coverage.requested}
          used={pending.coverage.used}
          onConfirm={confirmClamped}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </form>
  )
}
