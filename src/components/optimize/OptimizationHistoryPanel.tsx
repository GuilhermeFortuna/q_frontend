import { formatDistanceToNow } from 'date-fns'
import { Loader2, Play, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  useBulkDeleteOptimizations,
  useOptimizationHistory,
  useOptimizationResults,
  useOptimizationStatus,
} from '@/api/queries/optimize'
import { OptimizationResultsTabs } from '@/components/optimize/OptimizationResultsTabs'
import {
  formatBulkDeleteDescription,
  HistorySelectionToolbar,
} from '@/components/shared/HistorySelectionToolbar'
import { Button, ConfirmDialog, Callout, HistoryCard } from '@/components/ui'
import { useHistorySelection } from '@/hooks/useHistorySelection'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { buildResultsFromStatus } from '@/lib/optimize/buildResultsFromStatus'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type {
  JobStatus,
  OptimizationBacktestConfig,
  OptimizationConfig,
  OptimizationStudySummary,
} from '@/types/optimization'

type OptimizationHistoryPanelProps = {
  selectedStudyId: string | null
  onSelectStudy: (studyId: string | null) => void
  studyBacktestConfigs: Record<string, OptimizationBacktestConfig>
  onContinueStudy: (studyId: string, config: OptimizationConfig, status: JobStatus) => void
}

const statusStyles: Record<JobStatus, string> = {
  done: 'bg-emerald-500/10 text-emerald-400',
  error: 'bg-rose-500/10 text-rose-400',
  cancelled: 'bg-silver-500/10 text-silver-400',
  running: 'bg-brass-500/10 text-brass-400',
  pending: 'bg-silver-500/10 text-silver-400',
}

function formatBestValue(value: number | null): string {
  if (value == null) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(3)
}

function StudyListItem({
  study,
  selected,
  selectionMode,
  checked,
  onSelect,
  onToggleCheck,
}: {
  study: OptimizationStudySummary
  selected: boolean
  selectionMode: boolean
  checked: boolean
  onSelect: () => void
  onToggleCheck: () => void
}) {
  const metricsContent = (
    <div className="flex items-center justify-between text-[10px]">
      <div className="flex flex-col">
        <span className="text-silver-500 text-[8px] font-medium tracking-wider uppercase">
          Trials Progress
        </span>
        <span className="text-silver-200 mt-0.5 text-[11px] font-semibold">
          {study.completed_trials} / {study.n_trials} trials
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-silver-500 text-[8px] font-medium tracking-wider uppercase">
          Best Objective
        </span>
        <span className="text-brass-400 mt-0.5 font-mono text-[11px] font-bold">
          {formatBestValue(study.best_value)}
        </span>
      </div>
    </div>
  )

  return (
    <HistoryCard
      title={study.name}
      subtitle={formatDistanceToNow(new Date(study.created_at), { addSuffix: true })}
      status={study.status}
      statusClassName={statusStyles[study.status]}
      selectionMode={selectionMode}
      checked={checked}
      onToggleCheck={onToggleCheck}
      selected={selected}
      onSelect={onSelect}
      metrics={metricsContent}
    />
  )
}

export function OptimizationHistoryPanel({
  selectedStudyId,
  onSelectStudy,
  studyBacktestConfigs,
  onContinueStudy,
}: OptimizationHistoryPanelProps) {
  const historyQuery = useOptimizationHistory()
  const statusQuery = useOptimizationStatus(selectedStudyId)
  const bulkDelete = useBulkDeleteOptimizations()
  const selection = useHistorySelection()
  const status = statusQuery.data
  const setPendingOptimizationConfig = useAppStore((s) => s.setPendingOptimizationConfig)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  useEffect(() => {
    if (status?.optimization_config) {
      setPendingOptimizationConfig(status.optimization_config)
    }
  }, [status?.optimization_config, setPendingOptimizationConfig])

  const hasTerminalResults = status?.status === 'done' || status?.status === 'cancelled'
  const resultsQuery = useOptimizationResults(selectedStudyId, hasTerminalResults)

  const studies = historyQuery.data?.items ?? []
  const pageStudyIds = studies.map((study) => study.study_id)
  const selectedLabels = studies
    .filter((study) => selection.selectedIds.has(study.study_id))
    .map((study) => study.name)

  const handleConfirmBulkDelete = () => {
    const ids = [...selection.selectedIds]
    if (ids.length === 0) return

    bulkDelete.mutate(ids, {
      onSuccess: () => {
        if (selectedStudyId && ids.includes(selectedStudyId)) {
          onSelectStudy(null)
        }
        selection.exitSelectionMode()
        setConfirmBulkDelete(false)
      },
    })
  }
  const backtest =
    selectedStudyId != null
      ? (studyBacktestConfigs[selectedStudyId] ?? status?.backtest_config ?? null)
      : null

  const canContinue = status?.optimization_config != null
  const isActiveStudy = status?.status === 'pending' || status?.status === 'running'

  return (
    <>
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div className="bg-carbon-900/50 border-carbon-600/60 flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border">
          <div className="border-carbon-600/60 shrink-0 border-b px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-silver-100 font-medium">Past Studies</h3>
                <p className="text-silver-400 mt-0.5 text-xs">
                  {historyQuery.isLoading
                    ? 'Loading…'
                    : `${historyQuery.data?.total ?? studies.length} stud${(historyQuery.data?.total ?? studies.length) === 1 ? 'y' : 'ies'}`}
                </p>
              </div>
              <HistorySelectionToolbar
                selectionMode={selection.selectionMode}
                selectedCount={selection.selectedCount}
                pageItemCount={studies.length}
                onEnterSelection={selection.enterSelectionMode}
                onExitSelection={selection.exitSelectionMode}
                onSelectAllPage={() => selection.selectAll(pageStudyIds)}
                onDeleteSelected={() => setConfirmBulkDelete(true)}
                deleting={bulkDelete.isPending}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {historyQuery.isLoading && (
              <div className="text-silver-400 flex items-center justify-center gap-2 py-8 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading history…
              </div>
            )}

            {historyQuery.isError && (
              <p className="px-1 py-4 text-sm text-rose-400">
                Failed to load optimization history.
              </p>
            )}

            {!historyQuery.isLoading && studies.length === 0 && (
              <p className="text-silver-400 px-1 py-8 text-center text-sm">
                No studies yet. Run an optimization to build history.
              </p>
            )}

            {studies.map((study) => (
              <StudyListItem
                key={study.study_id}
                study={study}
                selected={selectedStudyId === study.study_id}
                selectionMode={selection.selectionMode}
                checked={selection.isSelected(study.study_id)}
                onSelect={() => onSelectStudy(study.study_id)}
                onToggleCheck={() => selection.toggle(study.study_id)}
              />
            ))}
          </div>
        </div>

        <div className="bg-carbon-900/50 border-carbon-600/60 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border">
          {!selectedStudyId ? (
            <div className="text-silver-400 flex flex-1 flex-col items-center justify-center px-6 text-center">
              <RotateCcw className="text-silver-500 mb-3 h-8 w-8" />
              <p className="text-silver-200 font-medium">Select a study</p>
              <p className="mt-1 max-w-sm text-sm">
                Choose a past optimization to review trials, Pareto front, and best parameters. Load
                a trial into Backtest from the results view.
              </p>
            </div>
          ) : statusQuery.isLoading ? (
            <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading study status…
            </div>
          ) : statusQuery.isError || !status ? (
            <div className="flex flex-1 items-center justify-center text-sm text-rose-400">
              Failed to load study status.
            </div>
          ) : status.status === 'error' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-silver-100 text-lg font-semibold">
                    {studies.find((s) => s.study_id === selectedStudyId)?.name ?? selectedStudyId}
                  </h3>
                  <p className="text-silver-400 mt-1 text-sm">
                    {formatDisplayDateTime(
                      studies.find((s) => s.study_id === selectedStudyId)?.created_at ??
                        new Date().toISOString(),
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium capitalize',
                    statusStyles.error,
                  )}
                >
                  error
                </span>
              </div>
              <Callout type="error" title="Study Failed" className="mb-4">
                {status.error ?? 'Optimization failed.'}
              </Callout>
              {canContinue && (
                <Callout
                  type="info"
                  title="Optimizer Config Loaded"
                  action={
                    <Button
                      type="button"
                      variant="brass"
                      onClick={() =>
                        onContinueStudy(selectedStudyId, status.optimization_config!, status.status)
                      }
                    >
                      <Play className="h-4 w-4" />
                      Continue optimization
                    </Button>
                  }
                >
                  The saved configuration has been loaded into the optimizer form. Adjust parameters
                  and run again to retry this study.
                </Callout>
              )}
            </div>
          ) : isActiveStudy && status && backtest ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
              <div className="mb-4 shrink-0">
                <h3 className="text-silver-100 text-lg font-semibold">
                  {studies.find((s) => s.study_id === selectedStudyId)?.name ?? selectedStudyId}
                </h3>
                <p className="text-silver-400 mt-1 text-sm">
                  {backtest.symbol} · {backtest.timeframe} ·{' '}
                  {formatDisplayDateTime(
                    studies.find((s) => s.study_id === selectedStudyId)?.created_at ??
                      new Date().toISOString(),
                  )}
                </p>
              </div>
              <OptimizationResultsTabs
                results={buildResultsFromStatus(status)}
                backtest={backtest}
                status={status.status}
                statusLabel="Study running — live analytics available"
              />
              {canContinue && (
                <Callout
                  type="info"
                  title="Study In Progress"
                  className="mt-4 shrink-0"
                  action={
                    <Button
                      type="button"
                      variant="brass"
                      onClick={() =>
                        onContinueStudy(selectedStudyId, status.optimization_config!, status.status)
                      }
                    >
                      <Play className="h-4 w-4" />
                      Resume monitoring
                    </Button>
                  }
                >
                  This study is still running. Resume monitoring or adjust the loaded config in the
                  workbench.
                </Callout>
              )}
            </div>
          ) : resultsQuery.isLoading ? (
            <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading study results…
            </div>
          ) : resultsQuery.isError || !resultsQuery.data ? (
            <div className="flex flex-1 items-center justify-center text-sm text-rose-400">
              Failed to load study results.
            </div>
          ) : !backtest ? (
            <div className="text-silver-400 flex flex-1 items-center justify-center px-6 text-center text-sm">
              Study backtest configuration is unavailable for this saved study.
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
              <div className="mb-4 shrink-0">
                <h3 className="text-silver-100 text-lg font-semibold">
                  {studies.find((s) => s.study_id === selectedStudyId)?.name ?? selectedStudyId}
                </h3>
                <p className="text-silver-400 mt-1 text-sm">
                  {backtest.symbol} · {backtest.timeframe} ·{' '}
                  {formatDisplayDateTime(
                    studies.find((s) => s.study_id === selectedStudyId)?.created_at ??
                      new Date().toISOString(),
                  )}
                </p>
              </div>
              <OptimizationResultsTabs
                results={resultsQuery.data}
                backtest={backtest}
                status={status.status}
                statusLabel={
                  status.status === 'cancelled'
                    ? 'Study cancelled — showing partial results'
                    : undefined
                }
              />
              {canContinue && (
                <Callout
                  type="info"
                  title={isActiveStudy ? 'Study In Progress' : 'Optimizer Config Loaded'}
                  className="mt-4 shrink-0"
                  action={
                    <Button
                      type="button"
                      variant="brass"
                      onClick={() =>
                        onContinueStudy(selectedStudyId, status.optimization_config!, status.status)
                      }
                    >
                      <Play className="h-4 w-4" />
                      {isActiveStudy ? 'Resume monitoring' : 'Continue optimization'}
                    </Button>
                  }
                >
                  {isActiveStudy
                    ? 'This study is still running. Resume monitoring or adjust the loaded config in the workbench.'
                    : 'The saved configuration has been loaded into the optimizer form. Adjust trial count or search space, then run again to continue exploring.'}
                </Callout>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selection.selectedCount} optimization stud${selection.selectedCount === 1 ? 'y' : 'ies'}?`}
        description={formatBulkDeleteDescription(selectedLabels, 'studies')}
        confirmLabel="Delete"
        loading={bulkDelete.isPending}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </>
  )
}
