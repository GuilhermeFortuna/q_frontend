import { shortMlFilterId } from '@/lib/mlFilters/mlFilterFormat'
import { useMemo, useState } from 'react'

import {
  getMlFilterErrorMessage,
  isMlFilterJobTerminal,
  useMlFilterComparisonJob,
  useMlFilterModels,
  useStartMlFilterComparison,
} from '@/api/queries/mlFilters'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/Callout'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import {
  ML_FILTER_DEFAULT_THRESHOLD,
  algorithmLabel,
  formatExchangeLabel,
  validateThreshold,
} from '@/lib/mlFilters/mlFilterForm'
import {
  formatMoney,
  formatNullableMetric,
  formatThreshold,
  numericCounts,
  humanizeKey,
} from '@/lib/mlFilters/mlFilterFormat'
import type {
  MlFilterComparisonResultEntry,
  MlFilterModelSummary,
  MlFilterNullableFloat,
} from '../../../../contracts/api'

type MLFilterComparisonProps = {
  datasetId: string | null
  jobId: string | null
  onJobStarted: (jobId: string) => void
}

export function MLFilterComparison({ datasetId, jobId, onJobStarted }: MLFilterComparisonProps) {
  const modelsQuery = useMlFilterModels(datasetId ? { dataset_id: datasetId } : {})
  const readyModels = useMemo(
    () =>
      (modelsQuery.data?.items ?? []).filter((item) => item.ready && item.dataset_id === datasetId),
    [modelsQuery.data, datasetId],
  )
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [threshold, setThreshold] = useState(ML_FILTER_DEFAULT_THRESHOLD)
  const [startError, setStartError] = useState<string | null>(null)

  const start = useStartMlFilterComparison()
  const job = useMlFilterComparisonJob(jobId)
  const running = Boolean(jobId) && !isMlFilterJobTerminal(job.data?.status)
  const thresholdError = validateThreshold(threshold)
  const selectedIds = readyModels
    .map((item) => item.model_version_id)
    .filter((id) => !excluded.has(id))
  const submitDisabled =
    !datasetId || selectedIds.length === 0 || Boolean(thresholdError) || start.isPending || running

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitDisabled || !datasetId) return
    setStartError(null)
    try {
      const response = await start.mutateAsync({
        dataset_id: datasetId,
        model_version_ids: selectedIds,
        threshold,
      })
      onJobStarted(response.job_id)
    } catch (error) {
      setStartError(getMlFilterErrorMessage(error, 'Failed to start the comparison.'))
    }
  }

  const results = job.data?.results ?? []
  const resultThreshold = results[0]?.threshold
  const modelById = new Map(readyModels.map((item) => [item.model_version_id, item]))
  const staleThreshold =
    resultThreshold !== undefined && !thresholdError && resultThreshold !== threshold

  return (
    <Panel className="flex flex-col gap-4 p-4" data-testid="ml-filter-comparison">
      <div className="space-y-4">
        <SectionHeader title="Validation comparison" />
        <p className="text-silver-400 text-xs">
          Compares saved versions that share one dataset and split on validation data only. The
          reserved tail is never used here.
        </p>

        {!datasetId ? (
          <p className="text-silver-400 text-sm" data-testid="ml-filter-comparison-empty">
            Select a dataset in the saved versions list, or finish a training job, to compare
            models.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
            <fieldset className="space-y-1">
              <legend className="accent-wayfinding text-xs font-medium">Models to compare</legend>
              {readyModels.length === 0 ? (
                <p className="text-silver-400 text-sm">No ready model versions for this dataset.</p>
              ) : null}
              {readyModels.map((item) => (
                <label
                  key={item.model_version_id}
                  htmlFor={`ml-compare-${item.model_version_id}`}
                  className="text-silver-200 flex flex-wrap items-center gap-2 text-sm"
                >
                  <input
                    id={`ml-compare-${item.model_version_id}`}
                    aria-label={`${algorithmLabel(item.algorithm)} · ${item.model_version_id}`}
                    type="checkbox"
                    className="accent-brass-500 h-4 w-4"
                    checked={!excluded.has(item.model_version_id)}
                    onChange={(event) =>
                      setExcluded((current) => {
                        const next = new Set(current)
                        if (event.target.checked) next.delete(item.model_version_id)
                        else next.add(item.model_version_id)
                        return next
                      })
                    }
                  />
                  <span>{algorithmLabel(item.algorithm)}</span>
                  <span className="text-silver-400 text-xs" title={item.model_version_id}>
                    {shortMlFilterId(item.model_version_id)}
                  </span>
                </label>
              ))}
            </fieldset>

            <LabeledField
              label="Acceptance threshold"
              htmlFor="ml-compare-threshold"
              hint="Candidates with a score at or above the threshold are accepted (0 to 1)."
              error={thresholdError ?? undefined}
            >
              <NumberInput
                id="ml-compare-threshold"
                value={threshold}
                step={0.05}
                onChange={setThreshold}
                className="surface-well text-silver-100 w-32 rounded-lg px-3 py-2 text-sm"
              />
            </LabeledField>

            {startError ? (
              <Callout
                type="error"
                title="Comparison not started"
                data-testid="ml-filter-compare-error"
              >
                {startError}
              </Callout>
            ) : null}

            <div>
              <Button
                type="submit"
                variant="brass"
                disabled={submitDisabled}
                data-testid="ml-filter-compare-submit"
              >
                {start.isPending ? 'Starting…' : running ? 'Comparing…' : 'Run comparison'}
              </Button>
            </div>
          </form>
        )}

        {jobId && job.isLoading ? (
          <p className="text-silver-400 text-sm">Loading comparison…</p>
        ) : null}
        {job.isError ? (
          <Callout type="error" title="Could not read comparison">
            {getMlFilterErrorMessage(job.error)}
          </Callout>
        ) : null}
        {running ? (
          <p
            role="status"
            className="text-silver-400 text-sm"
            data-testid="ml-filter-compare-running"
          >
            Comparison {job.data?.status ?? 'queued'}…
          </p>
        ) : null}
        {job.data?.status === 'failed' ? (
          <Callout type="error" title="Comparison failed" data-testid="ml-filter-compare-failed">
            {job.data.error?.message ?? 'The server reported a failure without details.'}
          </Callout>
        ) : null}

        {job.data?.status === 'completed' && results.length > 0 ? (
          <>
            {staleThreshold ? (
              <Callout
                type="info"
                title="Threshold changed"
                data-testid="ml-filter-stale-threshold"
              >
                The results below used threshold {formatThreshold(resultThreshold)}. Run a new
                comparison to apply {formatThreshold(threshold)}.
              </Callout>
            ) : null}
            <ResultsTable results={results} modelById={modelById} />
            <details>
              <summary className="text-silver-400 cursor-pointer py-2 text-xs">
                Classification diagnostics
              </summary>
              <ClassificationTable results={results} modelById={modelById} />
            </details>
          </>
        ) : null}
      </div>
    </Panel>
  )
}

function MetricCell({ metric }: { metric: MlFilterNullableFloat | undefined }) {
  const formatted = formatNullableMetric(metric)
  return (
    <td className="py-1 pr-2 text-right">
      {formatted.text}
      {formatted.reason ? (
        <span className="text-silver-400 block text-[11px]">{formatted.reason}</span>
      ) : null}
    </td>
  )
}

function ResultsTable({
  results,
  modelById,
}: {
  results: MlFilterComparisonResultEntry[]
  modelById: Map<string, MlFilterModelSummary>
}) {
  const baseline = results[0]?.baseline
  return (
    <div className="surface-well overflow-x-auto rounded-lg">
      <table
        className="[&_tbody_tr]:border-carbon-600/30 w-full text-left text-xs tabular-nums [&_tbody_tr]:border-t [&_td]:px-3 [&_td]:py-3 [&_td:nth-child(4)]:text-right [&_td:nth-child(5)]:text-right [&_td:nth-child(6)]:text-right [&_td:nth-child(7)]:text-right [&_td:nth-child(8)]:text-right [&_th]:px-3 [&_th]:py-3 [&_th]:font-medium [&_thead_th:nth-child(4)]:text-right [&_thead_th:nth-child(5)]:text-right [&_thead_th:nth-child(6)]:text-right [&_thead_th:nth-child(7)]:text-right [&_thead_th:nth-child(8)]:text-right"
        data-testid="ml-filter-comparison-table"
      >
        <caption className="text-silver-400 pb-1 text-left">Validation results</caption>
        <thead className="text-silver-400">
          <tr>
            {[
              'Algorithm',
              'Features',
              'Training end',
              'Threshold',
              'Net PnL',
              'Max drawdown',
              'Profit factor',
              'Trades',
              'Candidates',
            ].map((heading) => (
              <th key={heading} scope="col" className="py-1 pr-2">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baseline ? (
            <tr data-testid="ml-filter-baseline-row">
              <th scope="row" colSpan={3} className="text-silver-200 text-left font-medium">
                Unfiltered MA Crossover
              </th>
              <td className="text-right">—</td>
              <td className="text-right">{formatMoney(baseline.net_pnl)}</td>
              <td className="text-right">{formatMoney(baseline.max_drawdown)}</td>
              <MetricCell metric={baseline.profit_factor} />
              <td className="text-right">{baseline.trade_count}</td>
              <td className="!text-left">All original entries</td>
            </tr>
          ) : null}
          {results.map((entry) => {
            const model = modelById.get(entry.model_version_id)
            const counts = numericCounts(entry.acceptance_counts)
            return (
              <tr key={entry.model_version_id} data-testid="ml-filter-comparison-row">
                <td className="py-1 pr-2">
                  {model ? algorithmLabel(model.algorithm) : entry.model_version_id}
                </td>
                <td className="py-1 pr-2" title={(model?.selected_features ?? []).join(', ')}>
                  {model?.selected_features?.length ?? '—'} inputs
                </td>
                <td className="py-1 pr-2">{formatExchangeLabel(model?.train_end)}</td>
                <td className="py-1 pr-2">{formatThreshold(entry.threshold)}</td>
                <td className="py-1 pr-2">
                  {entry.filtered ? formatMoney(entry.filtered.net_pnl) : '—'}
                </td>
                <td className="py-1 pr-2">
                  {entry.filtered ? formatMoney(entry.filtered.max_drawdown) : '—'}
                </td>
                <MetricCell metric={entry.filtered?.profit_factor} />
                <td className="py-1 pr-2">{entry.filtered?.trade_count ?? '—'}</td>
                <td className="py-1 pr-2">
                  {counts.map(([key, value]) => `${humanizeKey(key)} ${value}`).join(' · ') || '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ClassificationTable({
  results,
  modelById,
}: {
  results: MlFilterComparisonResultEntry[]
  modelById: Map<string, MlFilterModelSummary>
}) {
  return (
    <div className="surface-well overflow-x-auto rounded-lg">
      <table
        className="[&_tbody_tr]:border-carbon-600/30 w-full text-left text-xs tabular-nums [&_tbody_tr]:border-t [&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:py-3 [&_th]:font-medium"
        data-testid="ml-filter-classification-table"
      >
        <caption className="text-silver-400 pb-1 text-left">
          Classification diagnostics (not a ranking)
        </caption>
        <thead className="text-silver-400">
          <tr>
            <th scope="col" className="py-1 pr-2">
              Algorithm
            </th>
            <th scope="col" className="py-1 pr-2">
              ROC AUC
            </th>
            <th scope="col" className="py-1 pr-2">
              Confusion matrix
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((entry) => {
            const model = modelById.get(entry.model_version_id)
            const matrix = entry.classification?.confusion_matrix
            return (
              <tr key={entry.model_version_id}>
                <td className="py-1 pr-2">
                  {model ? algorithmLabel(model.algorithm) : entry.model_version_id}
                </td>
                <MetricCell metric={entry.classification?.roc_auc} />
                <td className="py-1 pr-2">
                  {matrix ? matrix.map((row) => row.join(' / ')).join(' | ') : 'Unavailable'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
