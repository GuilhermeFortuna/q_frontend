import { useCallback, useEffect } from 'react'

import { useBacktestRun } from '@/api/queries/backtests'
import {
  getMlFilterErrorMessage,
  useMlFilterSource,
  useMlFilterSources,
  type MlFilterSourceDetail,
} from '@/api/queries/mlFilters'
import { MLFilterModels } from '@/components/research/ml-filters/MLFilterModels'
import { MLFilterTrainForm } from '@/components/research/ml-filters/MLFilterTrainForm'
import { Callout } from '@/components/ui/Callout'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { formatExchangeLabel } from '@/lib/mlFilters/mlFilterForm'
import { useAppStore } from '@/store/useAppStore'
import type { MlFilterTrainingRequest } from '../../../../contracts/api'

export type MLFiltersTabProps = {
  /** Source selected by navigation (e.g. "Train ML filter" from a completed backtest). */
  sourceRunId?: string
  onUseInBacktest?: (modelVersionId: string) => void
}

export function MLFiltersTab({ sourceRunId, onUseInBacktest }: MLFiltersTabProps) {
  const session = useAppStore((state) => state.mlFilterSession)
  const patchSession = useAppStore((state) => state.patchMlFilterSession)

  useEffect(() => {
    if (sourceRunId && sourceRunId !== session.sourceRunId) {
      patchSession({ sourceRunId })
    }
    // Navigation is the source of truth only when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRunId])

  const selectedSourceId = sourceRunId ?? session.sourceRunId
  const sourcesQuery = useMlFilterSources()
  const sourceQuery = useMlFilterSource(selectedSourceId)

  const handleTrainingStarted = useCallback(
    (jobId: string, request: MlFilterTrainingRequest) => {
      patchSession({ trainingJobId: jobId, trainingRequest: request })
    },
    [patchSession],
  )

  const handleTrainingCompleted = useCallback(
    (datasetId: string, modelVersionIds: string[]) => {
      patchSession({
        datasetId,
        selectedModelId: modelVersionIds[0] ?? null,
        comparisonJobId: null,
        evaluationJobId: null,
        evaluationRequest: null,
      })
    },
    [patchSession],
  )

  const sources = sourcesQuery.data?.items ?? []

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
      data-testid="research-tab-ml-filters"
    >
      <Panel className="flex flex-col gap-3 p-4" data-testid="ml-filter-sources">
        <SectionHeader title="Source backtest" />
        <p className="text-silver-400 text-sm">
          Choose a completed MA Crossover backtest. Its trades become the training samples.
        </p>
        {sourcesQuery.isLoading ? (
          <p className="text-silver-400 text-sm">Loading sources…</p>
        ) : null}
        {sourcesQuery.isError ? (
          <Callout type="error" title="Could not load sources">
            {getMlFilterErrorMessage(sourcesQuery.error)}
          </Callout>
        ) : null}
        {!sourcesQuery.isLoading && !sourcesQuery.isError && sources.length === 0 ? (
          <p className="text-silver-400 text-sm" data-testid="ml-filter-sources-empty">
            No backtest sources yet. Run an MA Crossover backtest first, then train a filter from
            it.
          </p>
        ) : null}
        {sources.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="sr-only">Source backtest</legend>
            {sources.map((source) => {
              const id = `ml-source-${source.run_id}`
              return (
                <div key={source.run_id} className="flex flex-col">
                  <label htmlFor={id} className="text-silver-200 flex items-center gap-2 text-sm">
                    <input
                      id={id}
                      type="radio"
                      name="ml-filter-source"
                      checked={selectedSourceId === source.run_id}
                      disabled={!source.eligible}
                      aria-describedby={!source.eligible ? `${id}-reason` : undefined}
                      onChange={() => patchSession({ sourceRunId: source.run_id })}
                    />
                    <span>
                      {source.symbol} {source.timeframe} · {source.run_id} ·{' '}
                      {source.source_sample_count} samples
                    </span>
                  </label>
                  {!source.eligible ? (
                    <p id={`${id}-reason`} className="text-silver-500 ml-6 text-xs">
                      Not eligible: {source.eligibility_reason ?? 'unsupported source'}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </fieldset>
        ) : null}

        {selectedSourceId && sourceQuery.isLoading ? (
          <p className="text-silver-400 text-sm">Loading source…</p>
        ) : null}
        {selectedSourceId && sourceQuery.isError ? (
          <Callout type="error" title="Source unavailable" data-testid="ml-filter-source-error">
            {getMlFilterErrorMessage(sourceQuery.error, 'The selected source could not be loaded.')}
          </Callout>
        ) : null}
        {sourceQuery.data ? <SourceSummary source={sourceQuery.data} /> : null}
      </Panel>

      {sourceQuery.data ? (
        <MLFilterTrainForm
          key={sourceQuery.data.run_id}
          source={sourceQuery.data}
          activeJobId={session.trainingJobId}
          submittedRequest={session.trainingRequest}
          onTrainingStarted={handleTrainingStarted}
          onTrainingCompleted={handleTrainingCompleted}
          onClearJob={() => patchSession({ trainingJobId: null, trainingRequest: null })}
        />
      ) : null}

      <MLFilterModels
        datasetId={session.datasetId}
        onDatasetChange={(datasetId) =>
          patchSession({
            datasetId,
            comparisonJobId: null,
            evaluationJobId: null,
            evaluationRequest: null,
          })
        }
        selectedModelId={session.selectedModelId}
        onSelectModel={(selectedModelId) => patchSession({ selectedModelId })}
        onUseInBacktest={onUseInBacktest}
      />
    </div>
  )
}

function SourceSummary({ source }: { source: MlFilterSourceDetail }) {
  const runQuery = useBacktestRun(source.run_id)
  const config = runQuery.data?.config as
    | {
        strategy_params?: Record<string, unknown>
        exit_params?: Record<string, unknown>
        costs?: Record<string, unknown>
        position_sizing?: Record<string, unknown>
      }
    | undefined
  const volumeAvailable = (source.available_features ?? []).includes('real_volume')

  return (
    <dl
      className="border-carbon-700 grid gap-2 rounded-lg border p-3 text-xs sm:grid-cols-2 xl:grid-cols-3"
      data-testid="ml-filter-source-summary"
    >
      <Item label="Instrument" value={`${source.symbol} ${source.timeframe}`} />
      <Item
        label="Bar range (exchange time)"
        value={`${formatExchangeLabel(source.date_range_start)} → ${formatExchangeLabel(source.date_range_end)}`}
      />
      <Item label="Completed samples" value={String(source.source_sample_count)} />
      <Item
        label="Volume"
        value={
          volumeAvailable
            ? 'Real volume available'
            : (source.volume_readiness ?? 'Real volume unavailable')
        }
      />
      <Item label="MA parameters" value={describe(config?.strategy_params, runQuery.isLoading)} />
      <Item label="Exits" value={describe(config?.exit_params, runQuery.isLoading)} />
      <Item label="Costs" value={describe(config?.costs, runQuery.isLoading)} />
      <Item label="Sizing" value={describe(config?.position_sizing, runQuery.isLoading)} />
    </dl>
  )
}

function describe(value: Record<string, unknown> | undefined, loading: boolean): string {
  if (loading) return 'Loading…'
  if (!value || Object.keys(value).length === 0) return 'Defaults / not recorded'
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join(', ')
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-silver-500">{label}</dt>
      <dd className="text-silver-200">{value}</dd>
    </div>
  )
}
