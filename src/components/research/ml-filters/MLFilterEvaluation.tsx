import { shortMlFilterId } from '@/lib/mlFilters/mlFilterFormat'
import { useState } from 'react'

import {
  getMlFilterErrorMessage,
  isMlFilterJobTerminal,
  parseMlFilterError,
  useMlFilterEvaluationJob,
  useMlFilterModels,
  useStartMlFilterEvaluation,
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
  validateThreshold,
} from '@/lib/mlFilters/mlFilterForm'
import { formatMoney, formatNullableMetric, formatThreshold } from '@/lib/mlFilters/mlFilterFormat'
import type { MlFilterEngineMetrics, MlFilterEvaluationRequest } from '../../../../contracts/api'

type FrozenSelection = Required<MlFilterEvaluationRequest>

type MLFilterEvaluationProps = {
  datasetId: string | null
  /** Frozen tuple, persisted so a reload or retry reopens exactly the same evaluation. */
  frozen: FrozenSelection | null
  jobId: string | null
  onFreeze: (selection: FrozenSelection) => void
  onJobStarted: (jobId: string) => void
}

export function MLFilterEvaluation({
  datasetId,
  frozen,
  jobId,
  onFreeze,
  onJobStarted,
}: MLFilterEvaluationProps) {
  const modelsQuery = useMlFilterModels(datasetId ? { dataset_id: datasetId } : {})
  const readyModels = (modelsQuery.data?.items ?? []).filter(
    (item) => item.ready && item.dataset_id === datasetId,
  )
  const [modelId, setModelId] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(ML_FILTER_DEFAULT_THRESHOLD)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<{ message: string; consumed: boolean } | null>(null)

  const start = useStartMlFilterEvaluation()
  const job = useMlFilterEvaluationJob(jobId)
  const running = Boolean(jobId) && !isMlFilterJobTerminal(job.data?.status)
  const thresholdError = validateThreshold(threshold)

  const effectiveModelId = modelId ?? readyModels[0]?.model_version_id ?? null
  const draft: FrozenSelection | null =
    datasetId && effectiveModelId && !thresholdError
      ? { dataset_id: datasetId, model_version_id: effectiveModelId, threshold }
      : null
  const active = frozen ?? draft
  const consumed = error?.consumed ?? false
  const frozenForDataset = frozen && frozen.dataset_id === datasetId ? frozen : null

  const dispatch = async (selection: FrozenSelection) => {
    setError(null)
    try {
      const response = await start.mutateAsync(selection)
      onJobStarted(response.job_id)
    } catch (caught) {
      const parsed = parseMlFilterError(caught, 'Failed to start the final evaluation.')
      setError({ message: parsed.message, consumed: parsed.code === 'lockbox_consumed' })
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft || !confirmed || start.isPending || running || consumed) return
    // Freeze before dispatch so the displayed tuple is exactly what is sent.
    onFreeze(draft)
    await dispatch(draft)
  }

  const submitDisabled =
    !draft || !confirmed || start.isPending || running || consumed || Boolean(frozenForDataset)

  return (
    <Panel className="flex flex-col gap-4 p-4" data-testid="ml-filter-evaluation">
      <div className="space-y-4">
        <SectionHeader title="Final evaluation" />
        <p className="text-silver-400 text-xs">
          Validation data was used to choose a model and threshold. This workflow reserves the final
          tail of the source range for one last evaluation of exactly one selection. It does not
          claim the original source backtest was never inspected.
        </p>

        {!datasetId ? (
          <p className="text-silver-400 text-sm">Select a dataset to choose a final model.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
            <fieldset className="space-y-1" disabled={Boolean(frozenForDataset)}>
              <legend className="accent-wayfinding text-xs font-medium">Model version</legend>
              {readyModels.length === 0 ? (
                <p className="text-silver-400 text-sm">No ready model versions for this dataset.</p>
              ) : null}
              {readyModels.map((item) => (
                <label
                  key={item.model_version_id}
                  htmlFor={`ml-final-${item.model_version_id}`}
                  className="text-silver-200 flex flex-wrap items-center gap-2 text-sm"
                >
                  <input
                    id={`ml-final-${item.model_version_id}`}
                    aria-label={`${algorithmLabel(item.algorithm)} · ${item.model_version_id}`}
                    className="accent-brass-500 h-4 w-4"
                    type="radio"
                    name="ml-final-model"
                    checked={
                      (frozenForDataset?.model_version_id ?? effectiveModelId) ===
                      item.model_version_id
                    }
                    onChange={() => setModelId(item.model_version_id)}
                  />
                  <span>{algorithmLabel(item.algorithm)}</span>
                  <span className="text-silver-400 text-xs" title={item.model_version_id}>
                    {shortMlFilterId(item.model_version_id)}
                  </span>
                </label>
              ))}
            </fieldset>

            <LabeledField
              label="Final threshold"
              htmlFor="ml-final-threshold"
              error={thresholdError ?? undefined}
            >
              <NumberInput
                id="ml-final-threshold"
                value={frozenForDataset?.threshold ?? threshold}
                step={0.05}
                disabled={Boolean(frozenForDataset)}
                onChange={setThreshold}
                className="surface-well text-silver-100 w-32 rounded-lg px-3 py-2 text-sm"
              />
            </LabeledField>

            {active && active.dataset_id === datasetId ? (
              <p
                className="surface-well rounded-lg p-3 text-xs leading-relaxed break-words"
                data-testid="ml-filter-frozen-selection"
              >
                {frozenForDataset
                  ? consumed
                    ? 'Requested selection (rejected): '
                    : 'Frozen selection: '
                  : 'Selection to freeze: '}
                <strong>{active.model_version_id}</strong> at threshold{' '}
                <strong>{formatThreshold(active.threshold)}</strong> on dataset {active.dataset_id}.
              </p>
            ) : null}

            {!frozenForDataset ? (
              <label
                htmlFor="ml-final-confirm"
                className="text-silver-200 flex flex-wrap items-center gap-2 text-sm"
              >
                <input
                  id="ml-final-confirm"
                  type="checkbox"
                  className="accent-brass-500 h-4 w-4"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                I understand this consumes the reserved tail and cannot be repeated with a different
                selection.
              </label>
            ) : null}

            {error ? (
              <Callout
                type={consumed ? 'warning' : 'error'}
                title={consumed ? 'Reserved tail already consumed' : 'Evaluation not started'}
                data-testid="ml-filter-evaluation-error"
              >
                {error.message}
              </Callout>
            ) : null}

            <div className="flex gap-2">
              {!frozenForDataset ? (
                <Button
                  type="submit"
                  variant="brass"
                  disabled={submitDisabled}
                  data-testid="ml-filter-evaluate-submit"
                >
                  {start.isPending ? 'Starting…' : 'Evaluate on reserved tail'}
                </Button>
              ) : null}
              {frozenForDataset && !jobId && !consumed ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={start.isPending}
                  onClick={() => void dispatch(frozenForDataset)}
                  data-testid="ml-filter-evaluate-retry"
                >
                  Retry the same selection
                </Button>
              ) : null}
            </div>
          </form>
        )}

        {jobId && job.isLoading ? (
          <p className="text-silver-400 text-sm">Loading evaluation…</p>
        ) : null}
        {job.isError ? (
          <Callout type="error" title="Could not read evaluation">
            {getMlFilterErrorMessage(job.error)}
          </Callout>
        ) : null}
        {running ? (
          <p
            role="status"
            className="text-silver-400 text-sm"
            data-testid="ml-filter-evaluation-running"
          >
            Evaluation {job.data?.status ?? 'queued'}…
          </p>
        ) : null}
        {job.data?.status === 'failed' ? (
          <Callout type="error" title="Evaluation failed" data-testid="ml-filter-evaluation-failed">
            {job.data.error?.message ?? 'The server reported a failure without details.'}
          </Callout>
        ) : null}
        {job.data?.status === 'completed' && job.data.result ? (
          <section
            aria-label="Reserved-tail result"
            className="space-y-2"
            data-testid="ml-filter-evaluation-result"
          >
            <p className="text-silver-300 text-xs break-words">
              Reserved-tail result for {job.data.model_version_id} at threshold{' '}
              {formatThreshold(job.data.threshold ?? ML_FILTER_DEFAULT_THRESHOLD)}. These numbers
              are separate from the validation comparison.
            </p>
            <MetricsTable baseline={job.data.result.baseline} filtered={job.data.result.filtered} />
          </section>
        ) : null}
      </div>
    </Panel>
  )
}

function MetricsTable({
  baseline,
  filtered,
}: {
  baseline: MlFilterEngineMetrics
  filtered: MlFilterEngineMetrics
}) {
  const rows: Array<
    [string, (m: MlFilterEngineMetrics) => string, (m: MlFilterEngineMetrics) => string | null]
  > = [
    ['Net PnL', (m) => formatMoney(m.net_pnl), () => null],
    ['Max drawdown', (m) => formatMoney(m.max_drawdown), () => null],
    [
      'Profit factor',
      (m) => formatNullableMetric(m.profit_factor).text,
      (m) => formatNullableMetric(m.profit_factor).reason,
    ],
    ['Trades', (m) => String(m.trade_count), () => null],
  ]
  return (
    <table className="[&_tbody_tr]:border-carbon-600/30 w-full text-left text-xs tabular-nums [&_tbody_tr]:border-t [&_td]:px-3 [&_td]:py-3 [&_td]:text-right [&_th]:px-3 [&_th]:py-3 [&_th]:font-medium [&_thead_th:not(:first-child)]:text-right">
      <thead className="text-silver-400">
        <tr>
          <th scope="col" className="py-1 pr-2">
            Metric
          </th>
          <th scope="col" className="py-1 pr-2">
            Unfiltered
          </th>
          <th scope="col" className="py-1 pr-2">
            Filtered
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, format, reason]) => (
          <tr key={label}>
            <th scope="row" className="py-1 pr-2 font-normal">
              {label}
            </th>
            <td className="py-1 pr-2">
              {format(baseline)}
              {reason(baseline) ? (
                <span className="text-silver-400 block text-[11px]">{reason(baseline)}</span>
              ) : null}
            </td>
            <td className="py-1 pr-2">
              {format(filtered)}
              {reason(filtered) ? (
                <span className="text-silver-400 block text-[11px]">{reason(filtered)}</span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
