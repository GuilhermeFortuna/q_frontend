import { formatDistanceToNow } from 'date-fns'
import { Loader2, Play, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  useDeleteOptimization,
  useOptimizationHistory,
  useOptimizationResults,
  useOptimizationStatus,
} from '@/api/queries/optimize'
import { OptimizationResultsTabs } from '@/components/optimize/OptimizationResultsTabs'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatDisplayDateTime } from '@/lib/formatDate'
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
  onSelect,
  onDelete,
  deleting,
}: {
  study: OptimizationStudySummary
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div
      className={cn(
        'border-carbon-600/60 hover:border-brass-500/40 relative w-full rounded-lg border transition-colors',
        selected ? 'border-brass-500/60 bg-brass-500/5' : 'bg-carbon-900/30',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full p-3 pr-9 text-left"
        aria-label={`Select study ${study.name}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-silver-100 truncate font-medium">{study.name}</p>
            <p className="text-silver-400 mt-0.5 text-xs">
              {study.completed_trials}/{study.n_trials} trials ·{' '}
              {formatDistanceToNow(new Date(study.created_at), { addSuffix: true })}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              statusStyles[study.status],
            )}
          >
            {study.status}
          </span>
        </div>

        <div className="text-silver-300 mt-2 text-xs tabular-nums">
          Best objective <span className="text-brass-400">{formatBestValue(study.best_value)}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        disabled={deleting}
        className="text-silver-500 absolute top-2 right-2 rounded p-1 transition-colors hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
        aria-label={`Delete study ${study.name}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
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
  const deleteOptimization = useDeleteOptimization()
  const status = statusQuery.data
  const setPendingOptimizationConfig = useAppStore((s) => s.setPendingOptimizationConfig)
  const [pendingDeleteStudyId, setPendingDeleteStudyId] = useState<string | null>(null)

  useEffect(() => {
    if (status?.optimization_config) {
      setPendingOptimizationConfig(status.optimization_config)
    }
  }, [status?.optimization_config, setPendingOptimizationConfig])

  const hasTerminalResults = status?.status === 'done' || status?.status === 'cancelled'
  const resultsQuery = useOptimizationResults(selectedStudyId, hasTerminalResults)

  const studies = historyQuery.data?.items ?? []
  const pendingDeleteStudy = studies.find((study) => study.study_id === pendingDeleteStudyId)

  const handleConfirmDelete = () => {
    if (!pendingDeleteStudyId) return
    deleteOptimization.mutate(pendingDeleteStudyId, {
      onSuccess: () => {
        if (selectedStudyId === pendingDeleteStudyId) {
          onSelectStudy(null)
        }
        setPendingDeleteStudyId(null)
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
            <h3 className="text-silver-100 font-medium">Past Studies</h3>
            <p className="text-silver-400 mt-0.5 text-xs">
              {historyQuery.isLoading
                ? 'Loading…'
                : `${historyQuery.data?.total ?? studies.length} saved stud${(historyQuery.data?.total ?? studies.length) === 1 ? 'y' : 'ies'}`}
            </p>
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
                No saved studies yet. Run an optimization to build history.
              </p>
            )}

            {studies.map((study) => (
              <StudyListItem
                key={study.study_id}
                study={study}
                selected={selectedStudyId === study.study_id}
                onSelect={() => onSelectStudy(study.study_id)}
                onDelete={() => setPendingDeleteStudyId(study.study_id)}
                deleting={deleteOptimization.isPending && pendingDeleteStudyId === study.study_id}
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
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
                {status.error ?? 'Optimization failed.'}
              </div>
              {canContinue && (
                <div className="border-carbon-600/40 bg-brass-500/5 mt-4 rounded-lg border p-4">
                  <p className="text-silver-300 text-sm">
                    The saved configuration has been loaded into the optimizer form. Adjust
                    parameters and run again to retry this study.
                  </p>
                  <Button
                    type="button"
                    variant="brass"
                    className="mt-3"
                    onClick={() =>
                      onContinueStudy(selectedStudyId, status.optimization_config!, status.status)
                    }
                  >
                    <Play className="h-4 w-4" />
                    Continue optimization
                  </Button>
                </div>
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
                statusLabel={
                  status.status === 'cancelled'
                    ? 'Study cancelled — showing partial results'
                    : undefined
                }
              />
              {canContinue && (
                <div className="border-carbon-600/40 bg-brass-500/5 mt-4 shrink-0 rounded-lg border p-4">
                  <p className="text-silver-300 text-sm">
                    {isActiveStudy
                      ? 'This study is still running. Resume monitoring or adjust the loaded config in the workbench.'
                      : 'The saved configuration has been loaded into the optimizer form. Adjust trial count or search space, then run again to continue exploring.'}
                  </p>
                  <Button
                    type="button"
                    variant="brass"
                    className="mt-3"
                    onClick={() =>
                      onContinueStudy(selectedStudyId, status.optimization_config!, status.status)
                    }
                  >
                    <Play className="h-4 w-4" />
                    {isActiveStudy ? 'Resume monitoring' : 'Continue optimization'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingDeleteStudyId != null}
        title="Delete optimization study?"
        description={
          pendingDeleteStudy
            ? `Remove "${pendingDeleteStudy.name}" from history? This cannot be undone.`
            : 'Remove this study from history? This cannot be undone.'
        }
        confirmLabel="Delete"
        loading={deleteOptimization.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteStudyId(null)}
      />
    </>
  )
}
