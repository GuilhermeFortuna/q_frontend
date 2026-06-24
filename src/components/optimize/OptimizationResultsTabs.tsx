import { memo, useEffect, useMemo, useState } from 'react'

import { BestParamsCard } from '@/components/optimize/BestParamsCard'
import { OptimizationAnalyticsTab } from '@/components/optimize/OptimizationAnalyticsTab'
import { OptimizationLogs } from '@/components/optimize/OptimizationLogs'
import { OptimizationMetricsBar } from '@/components/optimize/OptimizationMetricsBar'
import { OptimizationProgress } from '@/components/optimize/OptimizationProgress'
import { OptimizationScatter } from '@/components/optimize/OptimizationScatter'
import { LazyOptimizationTerrain3D } from '@/components/optimize/LazyOptimizationTerrain3D'
import { TrialsTable } from '@/components/optimize/TrialsTable'
import { cn } from '@/lib/utils'
import type {
  JobStatus,
  OptimizationBacktestConfig,
  OptimizationResults,
  OptimizationStatus,
} from '@/types/optimization'

type TabId = 'overview' | 'chart' | 'terrain' | 'trials' | 'analytics' | 'logs'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'chart', label: 'Chart' },
  { id: 'terrain', label: '3D Landscape' },
  { id: 'trials', label: 'Trials' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'logs', label: 'Logs' },
]

type OptimizationResultsTabsProps = {
  results: OptimizationResults
  backtest: OptimizationBacktestConfig
  status: JobStatus
  statusLabel?: string
  liveStatus?: OptimizationStatus
  onCancel?: () => void
  cancelling?: boolean
  cancelError?: string | null
}

export const OptimizationResultsTabs = memo(function OptimizationResultsTabs({
  results,
  backtest,
  status,
  statusLabel,
  liveStatus,
  onCancel,
  cancelling,
  cancelError,
}: OptimizationResultsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [selectedTrialNumber, setSelectedTrialNumber] = useState<number | null>(
    results.best_trial?.number ?? null,
  )

  useEffect(() => {
    setSelectedTrialNumber(results.best_trial?.number ?? null)
  }, [results.study_id, results.best_trial?.number])

  const selectedTrial = useMemo(
    () => results.trials.find((t) => t.number === selectedTrialNumber) ?? results.best_trial,
    [results.trials, results.best_trial, selectedTrialNumber],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="border-carbon-600/60 flex gap-1 rounded-lg border p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-brass-600/20 text-brass-400'
                  : 'text-silver-400 hover:text-silver-200',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {statusLabel && <span className="text-silver-400 text-xs">{statusLabel}</span>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === 'overview' && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            {liveStatus && (status === 'running' || status === 'pending') && onCancel ? (
              <div className="shrink-0">
                <OptimizationProgress
                  status={liveStatus}
                  onCancel={onCancel}
                  cancelling={cancelling ?? false}
                  cancelError={cancelError}
                />
              </div>
            ) : (
              <>
                <div className="shrink-0">
                  <OptimizationMetricsBar results={results} />
                </div>
                <div className="shrink-0">
                  <BestParamsCard
                    results={results}
                    backtest={backtest}
                    trial={selectedTrial}
                    title={
                      selectedTrial?.number === results.best_trial?.number
                        ? undefined
                        : `Selected Trial #${selectedTrial?.number ?? '—'}`
                    }
                  />
                </div>
                <OptimizationScatter
                  results={results}
                  selectedTrialNumber={selectedTrialNumber}
                  onSelectTrial={setSelectedTrialNumber}
                  className="min-h-0 flex-1"
                />
              </>
            )}
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <OptimizationScatter
              results={results}
              selectedTrialNumber={selectedTrialNumber}
              onSelectTrial={setSelectedTrialNumber}
              className="min-h-0 flex-1"
            />
          </div>
        )}

        {activeTab === 'terrain' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <LazyOptimizationTerrain3D
              results={results}
              selectedTrialNumber={selectedTrialNumber}
              onSelectTrial={setSelectedTrialNumber}
            />
          </div>
        )}

        {activeTab === 'trials' && (
          <TrialsTable
            results={results}
            selectedTrialNumber={selectedTrialNumber}
            onSelectTrial={setSelectedTrialNumber}
          />
        )}

        {activeTab === 'analytics' && (
          <OptimizationAnalyticsTab studyId={results.study_id} status={status} />
        )}

        {activeTab === 'logs' && <OptimizationLogs results={results} />}
      </div>
    </div>
  )
})
