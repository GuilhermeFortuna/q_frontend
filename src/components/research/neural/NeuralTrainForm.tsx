import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useFeatureList } from '@/api/queries/features'
import { useStartNeuralTraining } from '@/api/queries/neural'
import { FeatureLabFeaturePicker } from '@/components/research/FeatureLabFeaturePicker'
import { FeatureLabInstrumentFields } from '@/components/research/FeatureLabInstrumentFields'
import { TARGET_FAMILY_OPTIONS } from '@/components/research/featureLabUtils'
import { NeuralTrainingProgress } from '@/components/research/neural/NeuralTrainingProgress'
import {
  buildNeuralTrainRequest,
  DEFAULT_NEURAL_INPUT_FEATURES,
  isNeuralTrainFormValid,
  neuralTrainMissingFields,
  neuralTrainRunLabel,
  type NeuralTrainFormState,
} from '@/components/research/neural/neuralTrainUtils'
import { Button } from '@/components/ui/button'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { defaultNeuralTrainEnd, defaultNeuralTrainStart } from '@/lib/backtesting/dateRange'
import type { NeuralEncoderKind } from '@/types/neural'

type NeuralTrainFormProps = {
  activeJobId: string | null
  onTrainingStarted: (jobId: string, label: string) => void
  onTrainingCompleted: (modelHash: string) => void
  onClearJob: () => void
}

function defaultFormState(): NeuralTrainFormState {
  return {
    kind: 'autoencoder',
    symbol: '',
    timeframe: 'H1',
    trainStart: defaultNeuralTrainStart,
    trainEnd: defaultNeuralTrainEnd,
    nLatents: 8,
    selectedFeatures: new Set(DEFAULT_NEURAL_INPUT_FEATURES),
    runGate: true,
    targetName: 'fwd_return',
    horizon: 5,
  }
}

export function NeuralTrainForm({
  activeJobId,
  onTrainingStarted,
  onTrainingCompleted,
  onClearJob,
}: NeuralTrainFormProps) {
  const [formState, setFormState] = useState<NeuralTrainFormState>(defaultFormState)
  const [formError, setFormError] = useState<string | null>(null)

  const featureListQuery = useFeatureList()
  const startTraining = useStartNeuralTraining()

  const features = featureListQuery.data?.features ?? []
  const isValid = isNeuralTrainFormValid(formState)
  const isBusy = startTraining.isPending
  const missingFields = useMemo(() => neuralTrainMissingFields(formState), [formState])

  const updateForm = (patch: Partial<NeuralTrainFormState>) => {
    setFormState((current) => ({ ...current, ...patch }))
    setFormError(null)
  }

  const handleSubmit = async () => {
    if (!isValid) {
      return
    }

    setFormError(null)
    try {
      const request = buildNeuralTrainRequest(formState)
      const response = await startTraining.mutateAsync(request)
      onTrainingStarted(response.job_id, neuralTrainRunLabel(formState))
    } catch (error: unknown) {
      const detail =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { detail?: string } } }).response?.data?.detail ===
          'string'
          ? (error as { response: { data: { detail: string } } }).response.data.detail
          : null
      setFormError(detail ?? 'Failed to start neural training.')
    }
  }

  return (
    <Panel className="flex flex-col gap-4 p-4" data-testid="neural-train-form">
      <SectionHeader title="Train encoder" />
      <p className="text-silver-400 text-sm">
        Fit a PCA or autoencoder on classical features, optionally run the latent IC gate when
        training finishes.
      </p>

      {activeJobId ? (
        <NeuralTrainingProgress
          jobId={activeJobId}
          onCompleted={onTrainingCompleted}
          onDismiss={onClearJob}
        />
      ) : (
        <>
          <LabeledField label="Encoder kind" htmlFor="neural-train-kind">
            <select
              id="neural-train-kind"
              value={formState.kind}
              onChange={(event) => updateForm({ kind: event.target.value as NeuralEncoderKind })}
              className="border-carbon-700 bg-carbon-900 text-silver-100 w-full rounded-lg border px-3 py-2 text-sm"
              data-testid="neural-train-kind"
            >
              <option value="autoencoder">Autoencoder (primary)</option>
              <option value="pca">PCA (linear control)</option>
            </select>
          </LabeledField>
          <p className="text-silver-500 -mt-2 text-xs">
            PCA is the cheap linear baseline; autoencoder is the primary nonlinear encoder.
          </p>

          <div className="grid gap-4 xl:grid-cols-2">
            <FeatureLabInstrumentFields
              symbol={formState.symbol}
              onSymbolChange={(symbol) => updateForm({ symbol })}
              timeframe={formState.timeframe}
              onTimeframeChange={(timeframe) => updateForm({ timeframe })}
              startDate={formState.trainStart}
              onStartDateChange={(trainStart) => updateForm({ trainStart })}
              endDate={formState.trainEnd}
              onEndDateChange={(trainEnd) => updateForm({ trainEnd })}
            />

            <div className="space-y-4">
              <LabeledField label="Latent dimensions (n_latents)" htmlFor="neural-train-n-latents">
                <NumberInput
                  id="neural-train-n-latents"
                  value={formState.nLatents}
                  onChange={(nLatents) => updateForm({ nLatents })}
                  min="1"
                  data-testid="neural-train-n-latents"
                />
              </LabeledField>

              <label className="text-silver-300 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formState.runGate}
                  onChange={(event) => updateForm({ runGate: event.target.checked })}
                  data-testid="neural-train-run-gate"
                />
                Run IC gate after training
              </label>

              {formState.runGate ? (
                <p className="text-silver-500 text-xs">
                  The gate scores latents out-of-sample, so leave ≥100 bars of data <em>after</em>{' '}
                  train end — otherwise it can&apos;t run.
                </p>
              ) : null}

              {formState.runGate ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <LabeledField label="Gate target" htmlFor="neural-train-target">
                    <select
                      id="neural-train-target"
                      value={formState.targetName}
                      onChange={(event) =>
                        updateForm({
                          targetName: event.target.value as typeof formState.targetName,
                        })
                      }
                      className="border-carbon-700 bg-carbon-900 text-silver-100 w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      {TARGET_FAMILY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </LabeledField>
                  <LabeledField label="Horizon (bars)" htmlFor="neural-train-horizon">
                    <NumberInput
                      id="neural-train-horizon"
                      value={formState.horizon}
                      onChange={(horizon) => updateForm({ horizon })}
                      min="1"
                      data-testid="neural-train-horizon"
                    />
                  </LabeledField>
                </div>
              ) : null}
            </div>
          </div>

          <FeatureLabFeaturePicker
            features={features}
            selectedFeatures={formState.selectedFeatures}
            onChange={(selectedFeatures) => updateForm({ selectedFeatures })}
            recommendedFeatureNames={[...DEFAULT_NEURAL_INPUT_FEATURES]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="brass"
              disabled={!isValid || isBusy}
              onClick={() => void handleSubmit()}
              data-testid="neural-train-submit"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Train encoder
            </Button>
          </div>

          {!isValid && missingFields.length > 0 ? (
            <p className="text-silver-400 text-xs" data-testid="neural-train-missing-fields">
              Set {missingFields.join(', ')} to enable training.
            </p>
          ) : null}

          {formError ? (
            <p className="text-sm text-rose-400" data-testid="neural-train-error">
              {formError}
            </p>
          ) : null}
        </>
      )}
    </Panel>
  )
}
