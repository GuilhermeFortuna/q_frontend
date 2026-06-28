import { CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useNeuralTrainingRun } from '@/api/queries/neural'
import {
  isNeuralTrainingJobActive,
  NEURAL_TRAINING_PHASE_LABELS,
} from '@/components/research/neural/neuralTrainUtils'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/Callout'
import { cn } from '@/lib/utils'

const PHASE_ORDER = ['queued', 'building_window', 'training', 'evaluating', 'done'] as const

type NeuralTrainingProgressProps = {
  jobId: string
  onCompleted: (modelHash: string) => void
  onDismiss: () => void
}

function phaseIndex(progress: string | null | undefined): number {
  if (!progress) return -1
  return PHASE_ORDER.indexOf(progress as (typeof PHASE_ORDER)[number])
}

export function NeuralTrainingProgress({
  jobId,
  onCompleted,
  onDismiss,
}: NeuralTrainingProgressProps) {
  const [isPolling, setIsPolling] = useState(true)
  const runQuery = useNeuralTrainingRun(jobId, { isRunning: isPolling })
  const [completedNotified, setCompletedNotified] = useState(false)

  useEffect(() => {
    if (runQuery.data) {
      setIsPolling(isNeuralTrainingJobActive(runQuery.data.status))
    }
  }, [runQuery.data])

  useEffect(() => {
    if (runQuery.data?.status === 'completed' && runQuery.data.model_hash && !completedNotified) {
      setCompletedNotified(true)
      onCompleted(runQuery.data.model_hash)
    }
  }, [completedNotified, onCompleted, runQuery.data])

  const run = runQuery.data
  const activeProgress = run?.progress ?? 'queued'
  const activeIndex = phaseIndex(activeProgress)

  if (runQuery.isLoading && !run) {
    return (
      <div
        className="text-silver-400 flex items-center gap-2 text-sm"
        data-testid="neural-training-progress-loading"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading training status…
      </div>
    )
  }

  if (runQuery.isError || !run) {
    return (
      <div className="space-y-3" data-testid="neural-training-progress-error">
        <Callout type="error">Failed to load training status.</Callout>
        <Button type="button" variant="outline" size="sm" onClick={() => runQuery.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  if (run.status === 'failed') {
    return (
      <div className="space-y-3" data-testid="neural-training-progress-failed">
        <Callout type="error">{run.error ?? 'Training job failed.'}</Callout>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDismiss}
          data-testid="neural-training-try-again"
        >
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="neural-training-progress">
      <div className="flex items-center gap-2">
        {run.status === 'completed' ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />
        ) : (
          <Loader2 className="text-brass-400 h-4 w-4 animate-spin" aria-hidden />
        )}
        <span className="text-silver-200 text-sm font-medium" data-testid="neural-training-phase">
          {NEURAL_TRAINING_PHASE_LABELS[activeProgress] ?? activeProgress}
        </span>
      </div>

      <ol className="grid gap-2 sm:grid-cols-5">
        {PHASE_ORDER.map((phase, index) => {
          const isDone = run.status === 'completed' || activeIndex > index
          const isCurrent = activeIndex === index && run.status !== 'completed'
          return (
            <li
              key={phase}
              className={cn(
                'rounded-lg border px-2 py-2 text-center text-[10px] font-semibold tracking-wide uppercase',
                isDone && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
                isCurrent && 'border-brass-500/40 bg-brass-500/10 text-brass-300',
                !isDone && !isCurrent && 'border-carbon-800/60 text-silver-500',
              )}
              data-testid={`neural-training-phase-${phase}`}
            >
              {NEURAL_TRAINING_PHASE_LABELS[phase]}
            </li>
          )
        })}
      </ol>

      {run.status === 'completed' && run.model_hash ? (
        <Callout type="success" data-testid="neural-training-completed">
          Training complete — model <span className="font-mono">{run.model_hash}</span> registered.
          {run.gate ? (
            <span>
              {' '}
              Gate {run.gate.passed ? 'passed' : 'failed'} (best latent IC{' '}
              {run.gate.best_latent_ic.toFixed(3)} vs baseline {run.gate.baseline_ic.toFixed(3)}).
            </span>
          ) : run.gate_error ? (
            <span>
              {' '}
              Gate skipped: {run.gate_error} The model is registered as Trained — widen the data
              after train end and retrain to gate it.
            </span>
          ) : null}
        </Callout>
      ) : null}

      {run.status === 'completed' ? (
        <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      ) : null}
    </div>
  )
}
