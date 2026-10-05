import { Loader2, Check, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'

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
import { cn } from '@/lib/utils'
import type {
  MlFilterAlgorithm,
  MlFilterFeatureName,
  MlFilterTrainingRequest,
} from '../../../../contracts/api'

const INPUT_CLASS =
  'surface-well text-silver-100 w-full min-w-0 rounded-lg px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass-500'

type MLFilterTrainFormProps = {
  source: MlFilterSourceDetail
  activeJobId: string | null
  onTrainingStarted: (jobId: string, request: MlFilterTrainingRequest) => void
}

export function MLFilterTrainForm({
  source,
  activeJobId,
  onTrainingStarted,
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
  const [advancedOpen, setAdvancedOpen] = useState(false)
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

  const advancedInvalid = Boolean(featureError || seedError) || Object.keys(paramErrors).length > 0
  const algorithmDescriptions: Record<MlFilterAlgorithm, string> = {
    lightgbm: 'Boosted trees for nonlinear relationships.',
    random_forest: 'An ensemble of independent decision trees.',
    logistic_regression: 'A simple, scaled linear baseline.',
  }
  const totalDuration = ranges
    ? Date.parse(ranges.reservedTail.end ?? '') - Date.parse(ranges.train.start ?? '')
    : 0

  return (
    <Panel overflowVisible className="flex flex-col" data-testid="ml-filter-train-form">
      <div className="border-carbon-600/30 bg-carbon-950 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b px-5 py-4">
        <div>
          <SectionHeader title="Training setup" />
          <p className="text-silver-400 mt-1 text-xs">
            {advancedInvalid
              ? 'Correct advanced settings before training.'
              : `${features.length} inputs · ${algorithms.length} models · closed signal candles`}
          </p>
        </div>
        <Button
          type="submit"
          form="ml-filter-training-form"
          variant="brass"
          disabled={submitDisabled}
          data-testid="ml-filter-train-submit"
        >
          {startTraining.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Starting…
            </>
          ) : jobRunning ? (
            'Training…'
          ) : (
            'Train models'
          )}
        </Button>
      </div>
      <div className="space-y-5 p-5">
        {startTraining.isPending ? (
          <Callout type="info" title="Submitting training request">
            Waiting for the server to accept this run. Keep this view open until a job is created.
          </Callout>
        ) : null}
        {submitError ? (
          <Callout type="error" title="Training not started" data-testid="ml-filter-submit-error">
            {submitError}
          </Callout>
        ) : null}
        <form id="ml-filter-training-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
          <fieldset className="space-y-3">
            <legend className="text-silver-200 text-sm font-medium">Models to train</legend>
            <div className="grid gap-2 xl:grid-cols-3">
              {ML_FILTER_ALGORITHMS.map((algorithm) => {
                const selected = algorithms.includes(algorithm.value)
                return (
                  <label
                    key={algorithm.value}
                    htmlFor={`ml-algorithm-${algorithm.value}`}
                    className={cn(
                      'surface-control flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors',
                      selected && 'accent-state',
                    )}
                  >
                    <input
                      id={`ml-algorithm-${algorithm.value}`}
                      type="checkbox"
                      className="accent-brass-500 mt-0.5 h-4 w-4 shrink-0"
                      checked={selected}
                      onChange={(event) => toggleAlgorithm(algorithm.value, event.target.checked)}
                      aria-label={algorithm.label}
                    />
                    <span>
                      <span className="text-silver-100 block text-sm font-medium">
                        {algorithm.label}
                      </span>
                      <span className="text-silver-400 mt-1 block text-xs leading-relaxed">
                        {algorithmDescriptions[algorithm.value]}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
            {algorithmError ? <p className="text-xs text-rose-400">{algorithmError}</p> : null}
          </fieldset>
          <section aria-label="Chronological data split" className="space-y-3">
            <div>
              <h3 className="text-silver-200 text-sm font-medium">Data split</h3>
              <p className="text-silver-400 mt-1 text-xs">
                Learn from the first period, compare on the next, reserve the last for final
                evaluation.
              </p>
            </div>
            {ranges ? (
              <div data-testid="ml-filter-split-ranges" className="space-y-3">
                <div
                  aria-hidden="true"
                  className="bg-carbon-800 flex h-2 overflow-hidden rounded-full"
                >
                  {[
                    { range: ranges.train, tone: 'bg-brass-500' },
                    { range: ranges.validation, tone: 'bg-silver-400' },
                    { range: ranges.reservedTail, tone: 'bg-carbon-600' },
                  ].map(({ range, tone }, index) => (
                    <div
                      key={index}
                      className={tone}
                      style={{
                        width: `${totalDuration > 0 ? ((Date.parse(range.end ?? '') - Date.parse(range.start ?? '')) / totalDuration) * 100 : 0}%`,
                      }}
                    />
                  ))}
                </div>
                <dl className="grid gap-3 text-xs sm:grid-cols-3">
                  {[
                    { label: 'Train', range: ranges.train },
                    { label: 'Validation', range: ranges.validation },
                    { label: 'Reserved tail', range: ranges.reservedTail },
                  ].map(({ label, range }) => (
                    <div key={label}>
                      <dt className="text-silver-200 font-medium">{label}</dt>
                      <dd className="text-silver-400 mt-1 leading-relaxed">
                        {formatExchangeLabel(range.start)}
                        <br />
                        to {formatExchangeLabel(range.end)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledField
                label="Training end (exchange time)"
                htmlFor="ml-filter-train-end"
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
          </section>
          <details
            open={advancedOpen || advancedInvalid}
            onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
            className="border-carbon-600/30 border-t pt-3"
          >
            <summary className="text-silver-200 cursor-pointer py-2 text-sm font-medium">
              <SlidersHorizontal
                className="text-silver-400 mr-2 inline h-4 w-4"
                aria-hidden="true"
              />
              Advanced settings{' '}
              <span className="text-silver-400 ml-2 text-xs font-normal">
                Features, seed & model parameters
              </span>
            </summary>
            <div className="mt-4 space-y-6">
              <fieldset className="space-y-3">
                <legend className="text-silver-200 text-sm font-medium">Features</legend>
                <p className="text-silver-400 text-xs leading-relaxed">
                  Each input is taken from the closed signal candle. Models learn whether the
                  resulting source trade finished with a net profit.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {ML_FILTER_FEATURE_ORDER.map((feature) => {
                    const isAvailable = available.includes(feature)
                    const mandatory = feature === ML_FILTER_MANDATORY_FEATURE
                    const id = `ml-feature-${feature}`
                    return (
                      <label
                        key={feature}
                        htmlFor={id}
                        className={cn(
                          'text-silver-200 flex items-center gap-2 text-xs',
                          !isAvailable && 'text-silver-400',
                        )}
                      >
                        <input
                          id={id}
                          type="checkbox"
                          className="accent-brass-500 h-4 w-4"
                          checked={mandatory ? true : features.includes(feature)}
                          disabled={!isAvailable || mandatory}
                          onChange={(event) => toggleFeature(feature, event.target.checked)}
                          aria-describedby={!isAvailable ? `${id}-reason` : undefined}
                        />
                        <span>{ML_FILTER_FEATURE_LABELS[feature]}</span>
                        {!isAvailable ? (
                          <span id={`${id}-reason`} className="text-silver-400 text-xs">
                            Unavailable
                          </span>
                        ) : null}
                      </label>
                    )
                  })}
                </div>
                {source.volume_readiness ? (
                  <p className="text-silver-400 text-xs" data-testid="ml-filter-volume-readiness">
                    {source.volume_readiness}
                  </p>
                ) : null}
                {featureError ? <p className="text-xs text-rose-400">{featureError}</p> : null}
              </fieldset>
              <div className="max-w-xs">
                <LabeledField
                  label="Seed"
                  htmlFor="ml-filter-seed"
                  hint="Use the same seed to reproduce model fitting."
                  error={seedError ?? undefined}
                >
                  <NumberInput
                    id="ml-filter-seed"
                    integer
                    value={seed}
                    onChange={setSeed}
                    className={INPUT_CLASS}
                  />
                </LabeledField>
              </div>
              {algorithms.map((algorithm) => (
                <fieldset key={algorithm} className="space-y-3">
                  <legend className="text-silver-200 text-sm font-medium">
                    {ML_FILTER_ALGORITHMS.find((item) => item.value === algorithm)?.label}{' '}
                    parameters
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                            onChange={(value: number | null) =>
                              setParam(algorithm, spec.key, value)
                            }
                            className={INPUT_CLASS}
                          />
                        </LabeledField>
                      )
                    })}
                  </div>
                </fieldset>
              ))}
              <p className="text-silver-400 text-xs break-words">
                UTC boundaries: {trainEndUtc ?? 'Choose training end'} ·{' '}
                {validationEndUtc ?? 'Choose validation end'}
              </p>
            </div>
          </details>
          {advancedInvalid ? (
            <Callout type="warning" title="Check advanced settings">
              Correct the highlighted feature, seed or model parameter errors before training.
            </Callout>
          ) : null}
          {!source.eligible ? (
            <Callout type="warning" title="Source not eligible">
              {source.eligibility_reason ?? 'This source cannot be used for ML filter training.'}
            </Callout>
          ) : null}
          <p className="text-silver-400 flex items-center gap-2 text-xs">
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Uses frozen backtest data. Saved models retain their exact settings and version.
          </p>
        </form>
      </div>
    </Panel>
  )
}
