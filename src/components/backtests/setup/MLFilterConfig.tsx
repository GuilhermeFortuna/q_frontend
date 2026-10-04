import type { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { Callout } from '@/components/ui/Callout'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { algorithmLabel, formatExchangeLabel } from '@/lib/mlFilters/mlFilterForm'
import { ML_FILTER_STRATEGY } from '@/lib/strategies/strategyCapabilities'

type BacktestConfig = ReturnType<typeof useBacktestConfig>

type MLFilterConfigProps = {
  config: BacktestConfig
}

const SELECT_CLASS =
  'border-carbon-700 bg-carbon-900 text-silver-100 w-full rounded-lg border px-3 py-2 text-sm'

/** Model-version selector and threshold editor for MA Crossover · ML Filter. */
export function MLFilterConfig({ config }: MLFilterConfigProps) {
  const { fields, mlFilter } = config
  if (fields.strategy !== ML_FILTER_STRATEGY) return null

  const { form, validation, context, models, modelsLoading, baselineError } = mlFilter
  const selectedId = form.modelVersionId ?? ''
  const selectedListed = models.some((item) => item.model_version_id === selectedId)
  const ready = models.filter((item) => item.ready)
  const unusable = models.filter((item) => !item.ready)
  const errors = Object.entries(validation.errors).filter((entry): entry is [string, string] =>
    Boolean(entry[1]),
  )

  return (
    <section
      aria-label="ML filter"
      className="border-carbon-600/50 bg-carbon-950/30 flex flex-col gap-3 rounded-xl border p-4"
      data-testid="ml-filter-config"
    >
      <SectionHeader title="ML filter" />
      <p className="text-silver-400 text-xs leading-relaxed">
        Entries are the MA crossover signals. The selected model approves or rejects each new entry
        on its own; an opposite crossover still closes an open position. Model and threshold are
        separate from the MA parameters.
      </p>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <LabeledField
          label="Model version"
          htmlFor="ml-filter-model"
          hint="Selecting a version loads its baseline symbol, timeframe, MA, exits, costs, sizing and day-trade settings into this form."
        >
          <select
            id="ml-filter-model"
            value={selectedId}
            onChange={(event) => {
              if (event.target.value) void mlFilter.selectModel(event.target.value)
            }}
            className={SELECT_CLASS}
            aria-invalid={Boolean(validation.errors.model)}
            aria-describedby={validation.errors.model ? 'ml-filter-model-error' : undefined}
          >
            <option value="" disabled>
              {modelsLoading ? 'Loading model versions…' : 'Select a model version'}
            </option>
            {selectedId && !selectedListed && !modelsLoading ? (
              <option value={selectedId}>{selectedId} (unavailable)</option>
            ) : null}
            {ready.map((item) => (
              <option key={item.model_version_id} value={item.model_version_id}>
                {algorithmLabel(item.algorithm)} · trained through{' '}
                {formatExchangeLabel(item.train_end)} · {item.symbol} {item.timeframe} ·{' '}
                {item.model_version_id}
              </option>
            ))}
            {unusable.map((item) => (
              <option key={item.model_version_id} value={item.model_version_id} disabled>
                {algorithmLabel(item.algorithm)} · {item.model_version_id} (incompatible)
              </option>
            ))}
          </select>
        </LabeledField>

        <LabeledField
          label="Acceptance threshold"
          htmlFor="ml-filter-threshold"
          hint="Entries scoring at or above this value are accepted (0 to 1)."
          error={validation.errors.threshold}
        >
          <NumberInput
            id="ml-filter-threshold"
            value={form.threshold}
            step={0.05}
            onChange={mlFilter.setThreshold}
            className={SELECT_CLASS}
          />
        </LabeledField>
      </div>

      {!modelsLoading && models.length === 0 ? (
        <p className="text-silver-500 text-xs" data-testid="ml-filter-config-empty">
          No saved model versions yet. Train one in Research → ML Filters.
        </p>
      ) : null}

      {unusable.length > 0 ? (
        <ul
          className="text-silver-500 space-y-0.5 text-xs"
          aria-label="Incompatible model versions"
        >
          {unusable.map((item) => (
            <li key={item.model_version_id}>
              {item.model_version_id}:{' '}
              {(item.compatibility_reasons ?? []).join(' ') || 'artifact unavailable'}
            </li>
          ))}
        </ul>
      ) : null}

      {context.status === 'ready' && context.summary ? (
        <p className="text-silver-400 text-xs" data-testid="ml-filter-selected-summary">
          {algorithmLabel(context.summary.algorithm)} version {context.summary.model_version_id},
          trained through {formatExchangeLabel(context.summary.train_end)}. Backtest dates must
          start on or after that point.
        </p>
      ) : null}

      {baselineError ? (
        <Callout type="warning" title="Baseline not applied" data-testid="ml-filter-baseline-error">
          {baselineError} The selected model is unchanged; correct the configuration manually or
          choose another version.
        </Callout>
      ) : null}

      {errors.length > 0 ? (
        <ul role="alert" className="space-y-1 text-xs font-medium text-rose-400">
          {errors.map(([key, message]) => (
            <li key={key} id={key === 'model' ? 'ml-filter-model-error' : undefined}>
              {message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
