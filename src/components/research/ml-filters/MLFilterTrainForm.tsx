import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  getMlFilterErrorMessage,
  isMlFilterJobTerminal,
  useMlFilterTrainingJob,
  useStartMlFilterTraining,
  type MlFilterSourceDetail,
} from '@/api/queries/mlFilters'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/Callout'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { formatExchangeLabel } from '@/lib/mlFilters/mlFilterForm'
import {
  ML_FILTER_ALGORITHMS,
  ML_FILTER_DEFAULT_ALGORITHMS,
  ML_FILTER_DEFAULT_SEED,
  ML_FILTER_FEATURE_LABELS,
  ML_FILTER_FEATURE_ORDER,
  ML_FILTER_MANDATORY_FEATURE,
  ML_FILTER_PARAM_SPECS,
  buildSplitRanges,
  buildTrainingRequest,
  defaultFeatures,
  defaultHyperparamDraft,
  exchangeInputToUtc,
  hyperparamErrorKey,
  orderFeatures,
  utcToExchangeInput,
  validateFeatures,
  validateHyperparams,
  validateSeed,
  validateSplit,
  type HyperparamDraft,
} from '@/lib/mlFilters/mlFilterForm'
import { humanizeKey, numericCounts } from '@/lib/mlFilters/mlFilterFormat'
import type {
  MlFilterAlgorithm,
  MlFilterFeatureName,
  MlFilterTrainingRequest,
} from '../../../../contracts/api'

const STAGES = ['dataset', 'fitting', 'validation', 'persisting'] as const

const INPUT_CLASS =
  'border-carbon-700 bg-carbon-900 text-silver-100 w-full rounded-lg border px-3 py-2 text-sm'

type MLFilterTrainFormProps = {
  source: MlFilterSourceDetail
  activeJobId: string | null
  submittedRequest: MlFilterTrainingRequest | null
  onTrainingStarted: (jobId: string, request: MlFilterTrainingRequest) => void
  onTrainingCompleted: (datasetId: string, modelVersionIds: string[]) => void
  onClearJob: () => void
}

export function MLFilterTrainForm({
  source,
  activeJobId,
  submittedRequest,
  onTrainingStarted,
  onTrainingCompleted,
  onClearJob,
}: MLFilterTrainFormProps) {
  const available = useMemo(() => source.available_features ?? [], [source.available_features])
  const [features, setFeatures] = useState<MlFilterFeatureName[]>(() => defaultFeatures(available))
  const [algorithms, setAlgorithms] = useState<MlFilterAlgorithm[]>(ML_FILTER_DEFAULT_ALGORITHMS)
  const [seed, setSeed] = useState(ML_FILTER_DEFAULT_SEED)
  const [trainEndInput, setTrainEndInput] = useState(() =>
    source.split_suggestion ? utcToExchangeInput(source.split_suggestion.train_end) : '',
  )
  const [validationEndInput, setValidationEndInput] = useState(() =>
    source.split_suggestion ? utcToExchangeInput(source.split_suggestion.validation_end) : '',
  )
  const [hyperparams, setHyperparams] = useState<HyperparamDraft>(defaultHyperparamDraft)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const startTraining = useStartMlFilterTraining()
  const job = useMlFilterTrainingJob(activeJobId)
  const jobStatus = job.data
  const jobRunning = Boolean(activeJobId) && !isMlFilterJobTerminal(jobStatus?.status)

  const trainEndUtc = exchangeInputToUtc(trainEndInput)
  const validationEndUtc = exchangeInputToUtc(validationEndInput)
  const splitErrors = validateSplit({
    trainEndUtc,
    validationEndUtc,
    sourceStart: source.date_range_start,
    sourceEnd: source.date_range_end,
  })
  const featureError = validateFeatures(features)
  const algorithmError = algorithms.length === 0 ? 'Select at least one algorithm.' : null
  const seedError = validateSeed(seed)
  const paramErrors = validateHyperparams(algorithms, hyperparams)
  const formInvalid =
    Boolean(splitErrors.trainEnd || splitErrors.validationEnd) ||
    Boolean(featureError || algorithmError || seedError) ||
    Object.keys(paramErrors).length > 0
  const submitDisabled = formInvalid || startTraining.isPending || jobRunning || !source.eligible

  const completedRef = useRef<string | null>(null)
  useEffect(() => {
    if (
      jobStatus?.status === 'completed' &&
      jobStatus.dataset_id &&
      completedRef.current !== jobStatus.job_id
    ) {
      completedRef.current = jobStatus.job_id
      onTrainingCompleted(jobStatus.dataset_id, jobStatus.model_version_ids ?? [])
    }
  }, [jobStatus, onTrainingCompleted])

  const toggleFeature = (feature: MlFilterFeatureName, checked: boolean) => {
    setFeatures((current) =>
      orderFeatures(checked ? [...current, feature] : current.filter((item) => item !== feature)),
    )
    setSubmitError(null)
  }

  const toggleAlgorithm = (algorithm: MlFilterAlgorithm, checked: boolean) => {
    setAlgorithms((current) =>
      checked ? [...current, algorithm] : current.filter((item) => item !== algorithm),
    )
    setSubmitError(null)
  }

  const setParam = (algorithm: MlFilterAlgorithm, key: string, value: number | null) => {
    setHyperparams((current) => ({
      ...current,
      [algorithm]: { ...current[algorithm], [key]: value },
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitDisabled || !trainEndUtc || !validationEndUtc) return
    setSubmitError(null)
    const request = buildTrainingRequest({
      sourceRunId: source.run_id,
      features,
      algorithms,
      seed,
      trainEndUtc,
      validationEndUtc,
      hyperparams,
    })
    try {
      const response = await startTraining.mutateAsync(request)
      onTrainingStarted(response.job_id, request)
    } catch (error) {
      setSubmitError(getMlFilterErrorMessage(error, 'Failed to start ML filter training.'))
    }
  }

  const ranges =
    trainEndUtc && validationEndUtc && !splitErrors.trainEnd && !splitErrors.validationEnd
      ? buildSplitRanges(
          trainEndUtc,
          validationEndUtc,
          source.date_range_start,
          source.date_range_end,
        )
      : null

  return (
    <Panel className="flex flex-col gap-4 p-4" data-testid="ml-filter-train-form">
      <SectionHeader title="Train entry filters" />
      <p className="text-silver-400 text-sm">
        Inputs are measured on the closed signal candle. The target is whether the source trade
        finished with a net profit. Features come from a fixed allowlist; there is no
        feature-engineering editor or data upload.
      </p>

      {activeJobId ? (
        <TrainingProgress
          jobId={activeJobId}
          status={jobStatus}
          loading={job.isLoading}
          loadError={job.isError ? getMlFilterErrorMessage(job.error) : null}
          request={submittedRequest}
          onDismiss={onClearJob}
        />
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <fieldset className="space-y-2">
          <legend className="accent-wayfinding text-xs font-medium">Features</legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {ML_FILTER_FEATURE_ORDER.map((feature) => {
              const isAvailable = available.includes(feature)
              const mandatory = feature === ML_FILTER_MANDATORY_FEATURE
              const id = `ml-feature-${feature}`
              return (
                <label
                  key={feature}
                  htmlFor={id}
                  className="text-silver-200 flex items-center gap-2 text-sm"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={mandatory ? true : features.includes(feature)}
                    disabled={!isAvailable || mandatory}
                    onChange={(event) => toggleFeature(feature, event.target.checked)}
                    aria-describedby={!isAvailable ? `${id}-reason` : undefined}
                  />
                  <span>{ML_FILTER_FEATURE_LABELS[feature]}</span>
                  {!isAvailable ? (
                    <span id={`${id}-reason`} className="text-silver-500 text-xs">
                      Unavailable
                    </span>
                  ) : null}
                </label>
              )
            })}
          </div>
          {source.volume_readiness ? (
            <p className="text-brass-400 text-xs" data-testid="ml-filter-volume-readiness">
              {source.volume_readiness}
            </p>
          ) : null}
          {featureError ? (
            <p className="text-xs font-medium text-rose-400">{featureError}</p>
          ) : null}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="accent-wayfinding text-xs font-medium">Algorithms</legend>
          <div className="flex flex-wrap gap-4">
            {ML_FILTER_ALGORITHMS.map((algorithm) => (
              <label
                key={algorithm.value}
                htmlFor={`ml-algorithm-${algorithm.value}`}
                className="text-silver-200 flex items-center gap-2 text-sm"
              >
                <input
                  id={`ml-algorithm-${algorithm.value}`}
                  type="checkbox"
                  checked={algorithms.includes(algorithm.value)}
                  onChange={(event) => toggleAlgorithm(algorithm.value, event.target.checked)}
                />
                {algorithm.label}
              </label>
            ))}
          </div>
          {algorithmError ? (
            <p className="text-xs font-medium text-rose-400">{algorithmError}</p>
          ) : null}
        </fieldset>

        <div className="grid gap-4 md:grid-cols-3">
          <LabeledField label="Seed" htmlFor="ml-filter-seed" error={seedError ?? undefined}>
            <NumberInput
              id="ml-filter-seed"
              integer
              value={seed}
              onChange={setSeed}
              className={INPUT_CLASS}
            />
          </LabeledField>
          <LabeledField
            label="Training end (exchange time)"
            htmlFor="ml-filter-train-end"
            hint={trainEndUtc ? `Request: ${trainEndUtc}` : undefined}
            error={splitErrors.trainEnd}
          >
            <input
              id="ml-filter-train-end"
              type="datetime-local"
              value={trainEndInput}
              onChange={(event) => setTrainEndInput(event.target.value)}
              className={INPUT_CLASS}
            />
          </LabeledField>
          <LabeledField
            label="Validation end (exchange time)"
            htmlFor="ml-filter-validation-end"
            hint={validationEndUtc ? `Request: ${validationEndUtc}` : undefined}
            error={splitErrors.validationEnd}
          >
            <input
              id="ml-filter-validation-end"
              type="datetime-local"
              value={validationEndInput}
              onChange={(event) => setValidationEndInput(event.target.value)}
              className={INPUT_CLASS}
            />
          </LabeledField>
        </div>

        {ranges ? (
          <dl className="grid gap-2 text-xs sm:grid-cols-3" data-testid="ml-filter-split-ranges">
            <div>
              <dt className="text-silver-500">Train</dt>
              <dd className="text-silver-200">
                {formatExchangeLabel(ranges.train.start)} → {formatExchangeLabel(ranges.train.end)}
              </dd>
            </div>
            <div>
              <dt className="text-silver-500">Validation</dt>
              <dd className="text-silver-200">
                {formatExchangeLabel(ranges.validation.start)} →{' '}
                {formatExchangeLabel(ranges.validation.end)}
              </dd>
            </div>
            <div>
              <dt className="text-silver-500">Reserved tail (final evaluation only)</dt>
              <dd className="text-silver-200">
                {formatExchangeLabel(ranges.reservedTail.start)} →{' '}
                {formatExchangeLabel(ranges.reservedTail.end)}
              </dd>
            </div>
          </dl>
        ) : null}

        {algorithms.map((algorithm) => (
          <fieldset key={algorithm} className="space-y-2">
            <legend className="accent-wayfinding text-xs font-medium">
              {ML_FILTER_ALGORITHMS.find((item) => item.value === algorithm)?.label} parameters
            </legend>
            <div className="grid gap-4 md:grid-cols-3">
              {ML_FILTER_PARAM_SPECS[algorithm].map((spec) => {
                const id = `ml-param-${algorithm}-${spec.key}`
                return (
                  <LabeledField
                    key={spec.key}
                    label={spec.label}
                    htmlFor={id}
                    error={paramErrors[hyperparamErrorKey(algorithm, spec.key)]}
                  >
                    <NumberInput
                      id={id}
                      nullable
                      integer={spec.integer}
                      value={hyperparams[algorithm][spec.key] ?? null}
                      onChange={(value: number | null) => setParam(algorithm, spec.key, value)}
                      className={INPUT_CLASS}
                    />
                  </LabeledField>
                )
              })}
            </div>
          </fieldset>
        ))}

        {!source.eligible ? (
          <Callout type="warning" title="Source not eligible">
            {source.eligibility_reason ?? 'This source cannot be used for ML filter training.'}
          </Callout>
        ) : null}
        {submitError ? (
          <Callout type="error" title="Training not started" data-testid="ml-filter-submit-error">
            {submitError}
          </Callout>
        ) : null}

        <div>
          <Button
            type="submit"
            variant="brass"
            disabled={submitDisabled}
            data-testid="ml-filter-train-submit"
          >
            {startTraining.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Starting…
              </>
            ) : (
              'Train models'
            )}
          </Button>
        </div>
      </form>
    </Panel>
  )
}

type TrainingProgressProps = {
  jobId: string
  status: ReturnType<typeof useMlFilterTrainingJob>['data']
  loading: boolean
  loadError: string | null
  request: MlFilterTrainingRequest | null
  onDismiss: () => void
}

function TrainingProgress({
  jobId,
  status,
  loading,
  loadError,
  request,
  onDismiss,
}: TrainingProgressProps) {
  const terminal = isMlFilterJobTerminal(status?.status)
  const counts = numericCounts(status?.rejections)
  const stageIndex = status?.stage ? STAGES.indexOf(status.stage as (typeof STAGES)[number]) : -1
  const progress = status?.progress

  return (
    <section
      aria-label="Training job"
      className="border-carbon-700 space-y-3 rounded-lg border p-3"
      data-testid="ml-filter-training-progress"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-silver-200 text-sm">
          Job <code>{jobId}</code> ·{' '}
          <span data-testid="ml-filter-training-status">{status?.status ?? 'loading'}</span>
        </p>
        {terminal ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>

      {request ? (
        <p className="text-silver-500 text-xs">
          Pinned request: source {request.source_run_id} · {request.selected_features.join(', ')} ·{' '}
          {request.algorithms.join(', ')}
        </p>
      ) : null}

      {loading && !status ? <p className="text-silver-400 text-sm">Loading job state…</p> : null}
      {loadError ? (
        <Callout type="error" title="Could not read job state">
          {loadError}
        </Callout>
      ) : null}

      {status && !terminal ? (
        <div>
          <ol className="text-silver-400 flex flex-wrap gap-3 text-xs" aria-label="Training stages">
            {STAGES.map((stage, index) => (
              <li
                key={stage}
                aria-current={index === stageIndex ? 'step' : undefined}
                className={index === stageIndex ? 'text-brass-400 font-semibold' : undefined}
              >
                {humanizeKey(stage)}
              </li>
            ))}
          </ol>
          <div
            role="progressbar"
            aria-label="Training progress"
            aria-valuemin={0}
            aria-valuemax={progress?.total ?? undefined}
            aria-valuenow={progress?.total ? progress.current : undefined}
            aria-valuetext={
              progress
                ? `${progress.current}${progress.total ? ` of ${progress.total}` : ''} · ${status.stage ?? 'queued'}`
                : 'Queued'
            }
            className="bg-carbon-800 mt-2 h-1.5 overflow-hidden rounded"
          >
            {progress?.total ? (
              <div
                className="bg-brass-500 h-full"
                style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
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
          {status.error?.message ?? 'The server reported a failure without details.'}
          {status.error?.code ? ` (${status.error.code})` : ''}
        </Callout>
      ) : null}
      {status?.status === 'completed' ? (
        <Callout type="success" title="Training complete" data-testid="ml-filter-training-complete">
          Saved {status.model_version_ids?.length ?? 0} model version(s). Compare them below.
        </Callout>
      ) : null}
    </section>
  )
}
