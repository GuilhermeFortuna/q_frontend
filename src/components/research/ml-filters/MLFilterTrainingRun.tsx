import { Loader2, Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  getMlFilterErrorMessage,
  isMlFilterJobTerminal,
  useMlFilterModel,
  useMlFilterTrainingJob,
} from '@/api/queries/mlFilters'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/Callout'
import { Panel } from '@/components/ui/Panel'
import { algorithmLabel } from '@/lib/mlFilters/mlFilterForm'
import {
  formatNullableMetric,
  humanizeKey,
  numericCounts,
  shortMlFilterId,
} from '@/lib/mlFilters/mlFilterFormat'
import type { MlFilterTrainingRequest } from '../../../../contracts/api'

const STAGES = [
  {
    key: 'dataset',
    label: 'Prepare trades',
    description: 'Build examples from the frozen source backtest.',
  },
  {
    key: 'fitting',
    label: 'Fit models',
    description: 'Train the selected algorithms on the first period.',
  },
  { key: 'validation', label: 'Validate', description: 'Score models on the validation period.' },
  {
    key: 'persisting',
    label: 'Save versions',
    description: 'Store fitted models and their exact settings.',
  },
] as const

export function MLFilterTrainingRun({
  jobId,
  request,
  onCompleted,
  onCompare,
  onDismiss,
  compact = false,
}: {
  jobId: string
  request: MlFilterTrainingRequest | null
  onCompleted: (datasetId: string, modelVersionIds: string[]) => void
  onCompare: (datasetId: string) => void
  onDismiss: () => void
  compact?: boolean
}) {
  const job = useMlFilterTrainingJob(jobId)
  const status = job.data
  const terminal = isMlFilterJobTerminal(status?.status)
  const [observedSeconds, setObservedSeconds] = useState(0)
  const completedRef = useRef(false)
  useEffect(() => {
    if (terminal) return
    const timer = window.setInterval(() => setObservedSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [terminal])
  useEffect(() => {
    if (status?.status === 'completed' && status.dataset_id && !completedRef.current) {
      completedRef.current = true
      onCompleted(status.dataset_id, status.model_version_ids ?? [])
    }
  }, [status, onCompleted])
  const stageIndex = STAGES.findIndex((stage) => stage.key === status?.stage)
  const progress = status?.progress
  const counts = numericCounts(status?.rejections)
  const queued = status?.status === 'queued'

  return (
    <Panel className="space-y-4 p-5" data-testid="ml-filter-training-progress">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div role="status" aria-live="polite">
          <h3 className="text-silver-100 flex items-center gap-2 font-semibold">
            {!terminal ? (
              <Loader2 className="text-brass-400 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {status?.status === 'completed' ? (
              <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            ) : null}
            {status?.status === 'completed'
              ? 'Models ready'
              : status?.status === 'failed'
                ? 'Training failed'
                : queued
                  ? 'Waiting for a training worker'
                  : status
                    ? 'Training in progress'
                    : 'Checking training job'}
          </h3>
          <p className="text-silver-400 mt-1 text-xs">
            <span data-testid="ml-filter-training-status">{status?.status ?? 'loading'}</span>
            {!terminal ? ` · monitoring for ${observedSeconds}s · checks every 0.8s` : null}
          </p>
        </div>
        {terminal ? (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>
      {job.isError ? (
        <Callout type="error" title="Progress connection interrupted">
          {getMlFilterErrorMessage(job.error)} Your job may still be running. Automatic checks
          continue.
          <Button variant="outline" size="sm" onClick={() => void job.refetch()}>
            Check again
          </Button>
        </Callout>
      ) : null}
      {queued ? (
        <p className="text-silver-300 text-sm">
          The server accepted your request. Training has not started yet.
        </p>
      ) : null}
      {queued && observedSeconds >= 30 ? (
        <Callout type="warning" title="Still waiting for the worker">
          No training progress has been reported. The worker may be busy or unavailable. Check
          Research worker logs if this continues; submitting again can create another queued job.
        </Callout>
      ) : null}
      {!terminal ? (
        <div>
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Training stages">
            {STAGES.map((stage, index) => (
              <li
                key={stage.key}
                aria-current={!queued && index === stageIndex ? 'step' : undefined}
                className="surface-well rounded-lg p-3"
              >
                <p
                  className={
                    index === stageIndex && !queued
                      ? 'text-brass-400 text-sm font-semibold'
                      : 'text-silver-300 text-sm'
                  }
                >
                  {index < stageIndex && !queued ? '✓' : index + 1} · {stage.label}
                </p>
                <p className="text-silver-400 mt-1 text-xs leading-relaxed">{stage.description}</p>
              </li>
            ))}
          </ol>
          <p className="text-silver-300 mt-3 text-xs">
            {queued
              ? 'Queued'
              : stageIndex >= 0
                ? STAGES[stageIndex].label
                : 'Waiting for server progress'}
            {progress
              ? ` · ${progress.current}${progress.total ? ` of ${progress.total}` : ''}`
              : ''}
          </p>
          <div
            role="progressbar"
            aria-label="Training progress"
            aria-valuemin={0}
            aria-valuemax={progress?.total ?? undefined}
            aria-valuenow={progress?.total ? progress.current : undefined}
            aria-valuetext={
              queued
                ? 'Queued, training has not started'
                : `${status?.stage ?? 'Awaiting status'}${progress ? ` · ${progress.current} of ${progress.total ?? 'unknown'}` : ''}`
            }
            className="bg-carbon-800 mt-2 h-2 overflow-hidden rounded-full"
          >
            {progress?.total ? (
              <div
                className="bg-brass-500 h-full"
                style={{
                  width: `${Math.min(100, Math.max(0, (progress.current / progress.total) * 100))}%`,
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      {counts.length > 0 ? (
        <p className="text-silver-400 text-xs" data-testid="ml-filter-rejection-counts">
          Rejected candidates:{' '}
          {counts.map(([key, value]) => `${humanizeKey(key)} ${value}`).join(' · ')}
        </p>
      ) : null}
      {status?.status === 'failed' ? (
        <Callout type="error" title="Training failed" data-testid="ml-filter-training-failed">
          {status.error?.message ?? 'The server reported a failure without details.'}{' '}
          {status.error?.code ? `(${status.error.code})` : ''} Correct the issue, then use Train
          models to retry.
        </Callout>
      ) : null}
      {status?.status === 'completed' && !compact ? (
        <section className="space-y-3" aria-label="Training results">
          <Callout
            type="success"
            title="Training complete"
            data-testid="ml-filter-training-complete"
          >
            Saved {status.model_version_ids?.length ?? 0} model version(s). The reserved tail has
            not been used.
          </Callout>
          <div className="space-y-2">
            {(status.model_version_ids ?? []).map((id) => (
              <TrainingModel key={id} modelVersionId={id} />
            ))}
          </div>
          <p className="text-silver-400 text-xs">
            Next, compare trading P&amp;L, drawdown and accepted trades against the unfiltered
            strategy. Choose a model and threshold before final evaluation.
          </p>
          <Button
            variant="brass"
            disabled={!status.dataset_id}
            onClick={() => status.dataset_id && onCompare(status.dataset_id)}
          >
            Review validation results
          </Button>
        </section>
      ) : null}
      <details className="text-silver-400 text-xs">
        <summary className="cursor-pointer">Job details</summary>
        <p className="mt-2 break-words">
          Job {jobId}
          {request
            ? ` · source ${request.source_run_id} · ${request.algorithms.map(algorithmLabel).join(', ')} · ${request.selected_features.length} inputs`
            : ''}
        </p>
      </details>
    </Panel>
  )
}

function TrainingModel({ modelVersionId }: { modelVersionId: string }) {
  const query = useMlFilterModel(modelVersionId)
  const auc = formatNullableMetric(query.data?.validation_metrics?.roc_auc)
  return (
    <div
      className="surface-well flex flex-wrap justify-between gap-2 rounded-lg p-3 text-sm"
      data-testid="ml-filter-training-model-result"
    >
      <div>
        <p className="text-silver-100">
          {query.data ? algorithmLabel(query.data.algorithm) : 'Saved model'}
        </p>
        <p className="text-silver-400 mt-1 text-xs" title={modelVersionId}>
          {shortMlFilterId(modelVersionId)}
        </p>
      </div>
      <p className="text-silver-300 text-xs">
        {query.isLoading
          ? 'Loading validation score…'
          : query.isError
            ? 'Validation score unavailable'
            : `Validation ROC AUC: ${auc.text}${auc.reason ? ` · ${auc.reason}` : ''}`}
      </p>
    </div>
  )
}
