import { CheckCircle2, Loader2, RefreshCw, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  getNeuralStatusErrorMessage,
  useNeuralVersion,
  useSetNeuralModelStatus,
} from '@/api/queries/neural'
import {
  formatNeuralMetric,
  legalNextNeuralStatuses,
  neuralPromoteActionLabel,
  neuralStatusChipClass,
  neuralStatusLabel,
} from '@/components/research/neural/neuralUtils'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/Callout'
import { LabeledField } from '@/components/ui/LabeledField'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatTile } from '@/components/ui/StatTile'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { cn } from '@/lib/utils'
import type { LatentGateResult, NeuralModelStatus } from '@/types/neural'
import { NeuralArchitectureVisualizer } from '@/components/research/neural/NeuralArchitectureVisualizer'

type NeuralModelDetailProps = {
  modelHash: string
  onClose?: () => void
}

function GateVerdictSection({ gateResult }: { gateResult: LatentGateResult | null | undefined }) {
  if (!gateResult) {
    return (
      <p className="text-silver-400 text-sm" data-testid="neural-gate-not-evaluated">
        Gate not evaluated yet.
      </p>
    )
  }

  return (
    <div className="space-y-3" data-testid="neural-gate-verdict">
      <div className="flex items-center gap-2">
        {gateResult.passed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />
        ) : (
          <XCircle className="h-4 w-4 text-rose-400" aria-hidden />
        )}
        <span
          className={cn(
            'text-sm font-semibold',
            gateResult.passed ? 'text-emerald-300' : 'text-rose-300',
          )}
          data-testid="neural-gate-pass-fail"
        >
          {gateResult.passed ? 'Gate passed' : 'Gate failed'}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          label="Best latent IC"
          value={formatNeuralMetric(gateResult.best_latent_ic)}
          highlight
        />
        <StatTile label="Baseline IC" value={formatNeuralMetric(gateResult.baseline_ic)} />
        <StatTile
          label="Latents beating baseline"
          value={String(gateResult.n_latents_beating_baseline)}
        />
        <StatTile
          label="Target"
          value={
            gateResult.target_name
              ? `${gateResult.target_name}(${gateResult.target_horizon ?? '?'})`
              : '—'
          }
        />
      </div>
    </div>
  )
}

export function NeuralModelDetail({ modelHash, onClose }: NeuralModelDetailProps) {
  const detailQuery = useNeuralVersion(modelHash)
  const setStatus = useSetNeuralModelStatus()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  useEffect(() => {
    setStatusMessage(null)
    setStatusError(null)
  }, [modelHash])

  const handleStatusChange = (nextStatus: NeuralModelStatus) => {
    if (nextStatus === 'production') {
      const confirmed = window.confirm(
        'Promote this model to Production? Any other production model for the same instrument will be demoted to Candidate.',
      )
      if (!confirmed) {
        return
      }
    }

    setStatusMessage(null)
    setStatusError(null)

    setStatus.mutate(
      { modelHash, status: nextStatus },
      {
        onSuccess: () => {
          setStatusMessage(`Status updated to ${neuralStatusLabel(nextStatus)}.`)
        },
        onError: (error) => {
          setStatusError(getNeuralStatusErrorMessage(error))
        },
      },
    )
  }

  if (detailQuery.isLoading) {
    return (
      <Panel
        className="flex h-full w-full max-w-md shrink-0 flex-col p-4 lg:w-96"
        data-testid="neural-model-detail"
      >
        <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading model detail…
        </div>
      </Panel>
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Panel
        className="flex h-full w-full max-w-md shrink-0 flex-col p-4 lg:w-96"
        data-testid="neural-model-detail"
      >
        <PanelHeader title="Model Detail" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-rose-400">Failed to load model detail.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </Panel>
    )
  }

  const model = detailQuery.data
  const nextStatuses = legalNextNeuralStatuses(model.status)
  const valMetrics = model.val_metrics
  const hasValMetrics =
    valMetrics.reconstruction_r2 != null || valMetrics.reconstruction_mse != null

  return (
    <Panel
      className="flex h-full w-full max-w-md shrink-0 flex-col overflow-hidden lg:w-96"
      data-testid="neural-model-detail"
    >
      <PanelHeader
        title="Model Detail"
        right={
          onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close detail panel"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null
        }
      />

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          <h2 className="text-cream-100 font-mono text-base font-semibold">{model.model_key}</h2>
          <div className="text-silver-400 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono">
              {model.symbol} · {model.timeframe}
            </span>
            <span>v{model.version}</span>
            <span
              className={neuralStatusChipClass(model.status)}
              data-testid="neural-detail-status"
            >
              {neuralStatusLabel(model.status)}
            </span>
          </div>
          <p className="text-silver-500 font-mono text-[10px] break-all">{model.model_hash}</p>
        </div>

        {statusMessage ? (
          <Callout type="success" data-testid="neural-status-message">
            {statusMessage}
          </Callout>
        ) : null}
        {statusError ? (
          <Callout type="error" data-testid="neural-status-error">
            {statusError}
          </Callout>
        ) : null}

        <section className="space-y-3">
          <SectionHeader title="Validation metrics" />
          {hasValMetrics ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile
                label="Reconstruction R²"
                value={formatNeuralMetric(
                  valMetrics.reconstruction_r2 as number | null | undefined,
                )}
              />
              <StatTile
                label="Reconstruction MSE"
                value={formatNeuralMetric(
                  valMetrics.reconstruction_mse as number | null | undefined,
                )}
              />
            </div>
          ) : (
            <p className="text-silver-400 text-sm" data-testid="neural-val-not-evaluated">
              Validation metrics not evaluated.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeader title="Activation flow map" />
          <NeuralArchitectureVisualizer />
        </section>

        <section className="space-y-3">
          <SectionHeader title="Training window" />
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledField label="Train start">
              <p className="text-silver-200 text-xs">{formatDisplayDateTime(model.train_start)}</p>
            </LabeledField>
            <LabeledField label="Train end">
              <p className="text-silver-200 text-xs">{formatDisplayDateTime(model.train_end)}</p>
            </LabeledField>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader title="Latent names" />
          <p className="text-silver-300 font-mono text-xs">
            {model.latent_names.length > 0 ? model.latent_names.join(', ') : '—'}
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeader title="Gate verdict" />
          <GateVerdictSection gateResult={model.gate_result} />
        </section>

        {nextStatuses.length > 0 ? (
          <section className="space-y-3" data-testid="neural-promote-controls">
            <SectionHeader title="Status actions" />
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((nextStatus) => (
                <Button
                  key={nextStatus}
                  type="button"
                  variant={nextStatus === 'production' ? 'default' : 'outline'}
                  size="sm"
                  disabled={setStatus.isPending}
                  onClick={() => handleStatusChange(nextStatus)}
                  data-testid={`neural-promote-${nextStatus}`}
                >
                  {neuralPromoteActionLabel(nextStatus)}
                </Button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Panel>
  )
}
