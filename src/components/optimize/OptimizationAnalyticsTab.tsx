import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { useOptimizationAnalytics } from '@/api/queries/optimize'
import { ParallelCoordinatePanel } from '@/components/optimize/ParallelCoordinatePanel'
import { ParamImportancePanel } from '@/components/optimize/ParamImportancePanel'
import { ParetoFrontPanel } from '@/components/optimize/ParetoFrontPanel'
import { cn } from '@/lib/utils'
import type { JobStatus } from '@/types/optimization'

type OptimizationAnalyticsTabProps = {
  studyId: string
  status: JobStatus
}

export function OptimizationAnalyticsTab({ studyId, status }: OptimizationAnalyticsTabProps) {
  const isRunning = status === 'running' || status === 'pending'
  const analyticsQuery = useOptimizationAnalytics(studyId, { isRunning })
  const [selectedTrialNumber, setSelectedTrialNumber] = useState<number | null>(null)

  if (analyticsQuery.isLoading) {
    return (
      <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading analytics…
      </div>
    )
  }

  if (analyticsQuery.isError || !analyticsQuery.data) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-rose-400">
        Failed to load optimization analytics.
      </div>
    )
  }

  const analytics = analyticsQuery.data

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-silver-400 text-xs">
          {analytics.is_multi_objective
            ? 'Return vs drawdown diagnostics'
            : 'Objective diagnostics'}
        </p>
        {isRunning ? (
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase',
              'bg-brass-500/10 text-brass-400',
            )}
          >
            Live · {analytics.n_complete_trials} trial{analytics.n_complete_trials === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-2">
        <ParetoFrontPanel
          analytics={analytics}
          selectedTrialNumber={selectedTrialNumber}
          onSelectTrial={setSelectedTrialNumber}
          className="min-h-[320px]"
        />
        <ParallelCoordinatePanel
          payload={analytics.parallel_coordinate}
          className="min-h-[320px]"
        />
      </div>

      <ParamImportancePanel analytics={analytics} />
    </div>
  )
}
