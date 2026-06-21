import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { ReaderWindowShell } from '@/components/layout/ReaderWindowShell'
import { BacktestStrategyChart } from '@/components/backtests/BacktestStrategyChart'
import { fetchBacktestResult, backtestKeys } from '@/api/queries/backtests'

type StandaloneChartWindowProps = {
  runId: string
}

export function StandaloneChartWindow({ runId }: StandaloneChartWindowProps) {
  const params = useMemo(() => {
    if (typeof window === 'undefined') return { symbol: '', timeframe: '' }
    const p = new URLSearchParams(window.location.search)
    return {
      symbol: p.get('symbol') || '',
      timeframe: p.get('timeframe') || '',
    }
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: backtestKeys.jobResult(runId),
    queryFn: () => fetchBacktestResult(runId),
    enabled: !!runId,
    staleTime: Infinity,
  })

  if (error) {
    return (
      <ReaderWindowShell title="Quant Chart" tag="Error">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="max-w-md rounded-lg border border-rose-500/10 bg-rose-500/5 p-6 font-mono text-rose-400 shadow-lg">
            <h2 className="mb-2 text-base font-bold tracking-wider uppercase">
              Error Loading Chart
            </h2>
            <p className="text-sm opacity-95">
              {error instanceof Error ? error.message : 'Failed to load chart data.'}
            </p>
          </div>
        </div>
      </ReaderWindowShell>
    )
  }

  if (isLoading || !data) {
    return (
      <ReaderWindowShell title="Quant Chart" tag="Loading">
        <div className="flex h-full items-center justify-center">
          <div className="border-brass-600/15 bg-carbon-900/50 text-silver-300 flex items-center gap-3 rounded-lg border px-5 py-3 font-mono text-sm shadow-md">
            <span className="bg-brass-400 h-2 w-2 animate-ping rounded-full" />
            Loading chart data...
          </div>
        </div>
      </ReaderWindowShell>
    )
  }

  return (
    <ReaderWindowShell
      title={`Quant Chart - ${params.symbol || 'Simulation'}`}
      tag="Trade Chart"
      mainClassName="animate-fade-in-up relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden px-6 pb-6 pt-4"
    >
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <BacktestStrategyChart
          bars={data.bars}
          indicators={data.indicators}
          trades={data.trades}
          symbol={params.symbol}
          timeframe={data.run_id ? undefined : params.timeframe} // timeframe is inferred if not provided
          runId={data.run_id || runId}
        />
      </div>
    </ReaderWindowShell>
  )
}
