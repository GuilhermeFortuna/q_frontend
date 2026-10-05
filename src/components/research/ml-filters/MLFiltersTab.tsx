import { useCallback, useEffect, useState } from 'react'

import { useBacktestRun } from '@/api/queries/backtests'
import {
  getMlFilterErrorMessage,
  useMlFilterSource,
  useMlFilterSources,
  type MlFilterSourceDetail,
} from '@/api/queries/mlFilters'
import { MLFilterComparison } from '@/components/research/ml-filters/MLFilterComparison'
import { MLFilterEvaluation } from '@/components/research/ml-filters/MLFilterEvaluation'
import { MLFilterModels } from '@/components/research/ml-filters/MLFilterModels'
import { MLFilterTrainingRun } from '@/components/research/ml-filters/MLFilterTrainingRun'
import { MLFilterTrainForm } from '@/components/research/ml-filters/MLFilterTrainForm'
import { EntityCard } from '@/components/ui/EntityCard'
import { Button } from '@/components/ui/button'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
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

  const [view, setView] = useState<'train' | 'compare' | 'evaluate'>('train')
  const selectedSourceId = session.sourceRunId
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
      if (session.datasetId === datasetId) return
      patchSession({
        datasetId,
        selectedModelId: modelVersionIds[0] ?? null,
        comparisonJobId: null,
        evaluationJobId: null,
        evaluationRequest: null,
      })
    },
    [patchSession, session.datasetId],
  )

  const sources = sourcesQuery.data?.items ?? []

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:overflow-hidden"
      data-testid="research-tab-ml-filters"
    >
      <aside
        aria-label="ML filter sources and models"
        className="flex shrink-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto"
      >
        <Panel className="shrink-0 p-4" data-testid="ml-filter-sources">
          <div className="space-y-3">
            <SectionHeader
              title="Source backtests"
              right={`${sources.filter((source) => source.eligible).length} ready`}
            />
            <p className="text-silver-400 text-xs leading-relaxed">
              Choose the MA Crossover run your models will learn from.
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
                No backtest sources yet. Run an MA Crossover backtest first, then train a filter
                from it.
              </p>
            ) : null}
            <div className="space-y-2" role="group" aria-label="Eligible source backtests">
              {sources
                .filter((source) => source.eligible)
                .map((source) => (
                  <EntityCard
                    key={source.run_id}
                    title={`${source.symbol} · ${source.timeframe}`}
                    tag={`${source.source_sample_count} trades`}
                    description={`${formatExchangeLabel(source.date_range_start).split(' ')[0]} → ${formatExchangeLabel(source.date_range_end).split(' ')[0]}`}
                    meta={<span title={source.run_id}>Run {source.run_id.slice(0, 8)}</span>}
                    selected={selectedSourceId === source.run_id}
                    onSelect={() => {
                      patchSession({ sourceRunId: source.run_id })
                      setView('train')
                    }}
                  />
                ))}
            </div>
            {sources.some((source) => !source.eligible) ? (
              <details className="border-carbon-600/30 border-t pt-3 text-xs">
                <summary className="text-silver-400 cursor-pointer py-1">
                  Unavailable sources ({sources.filter((source) => !source.eligible).length})
                </summary>
                <ul className="mt-2 space-y-3">
                  {sources
                    .filter((source) => !source.eligible)
                    .map((source) => (
                      <li key={source.run_id} className="space-y-1">
                        <p className="text-silver-300" title={source.run_id}>
                          {source.symbol} · {source.timeframe} · {source.run_id.slice(0, 8)}
                        </p>
                        <p className="text-silver-400 break-words">
                          {source.eligibility_reason ?? 'This source is not eligible for training.'}
                        </p>
                      </li>
                    ))}
                </ul>
              </details>
            ) : null}
          </div>
        </Panel>
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
          onCompare={() => setView('compare')}
        />
      </aside>
      <section
        className="flex min-w-0 shrink-0 flex-col gap-4 lg:min-h-0 lg:overflow-hidden"
        aria-label="ML filter workspace"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-silver-100 text-lg font-semibold">
              {view === 'train'
                ? 'Train entry filters'
                : view === 'compare'
                  ? 'Compare on validation'
                  : 'Final evaluation'}
            </h2>
            <p className="text-silver-400 mt-1 text-xs">
              {view === 'train'
                ? 'Teach a model which crossover entries to accept.'
                : view === 'compare'
                  ? 'Compare filtered trading results with the original strategy.'
                  : 'Reserve one model and threshold for the final historical period.'}
            </p>
          </div>
          <SegmentedToggle
            aria-label="ML filter workflow"
            value={view}
            onChange={setView}
            options={[
              { value: 'train', label: 'Train' },
              { value: 'compare', label: 'Compare' },
              { value: 'evaluate', label: 'Final Evaluation' },
            ]}
          />
        </div>
        <div className="min-h-0 flex-1 space-y-4 pr-1 lg:overflow-y-auto">
          {session.trainingJobId ? (
            <MLFilterTrainingRun
              key={session.trainingJobId}
              jobId={session.trainingJobId}
              compact={view !== 'train'}
              request={session.trainingRequest}
              onCompleted={handleTrainingCompleted}
              onCompare={(datasetId) => {
                if (session.datasetId !== datasetId) {
                  patchSession({
                    datasetId,
                    comparisonJobId: null,
                    evaluationJobId: null,
                    evaluationRequest: null,
                  })
                }
                setView('compare')
              }}
              onDismiss={() => patchSession({ trainingJobId: null, trainingRequest: null })}
            />
          ) : null}
          <div className={view === 'train' ? 'space-y-4' : 'hidden'}>
            {selectedSourceId && sourceQuery.isLoading ? (
              <p className="text-silver-400 text-sm">Loading source…</p>
            ) : null}
            {selectedSourceId && sourceQuery.isError ? (
              <Callout type="error" title="Source unavailable" data-testid="ml-filter-source-error">
                {getMlFilterErrorMessage(
                  sourceQuery.error,
                  'The selected source could not be loaded.',
                )}
              </Callout>
            ) : null}
            {sourceQuery.data ? <SourceSummary source={sourceQuery.data} /> : null}
            {!selectedSourceId ? (
              <Panel className="flex flex-col items-start gap-3 p-6">
                <h3 className="text-silver-100 font-medium">Start with a source backtest</h3>
                <p className="text-silver-400 max-w-prose text-sm leading-relaxed">
                  Select a completed MA Crossover run in the source list. Its closed trades provide
                  the examples used to train your entry filters.
                </p>
              </Panel>
            ) : null}

            {sourceQuery.data ? (
              <MLFilterTrainForm
                key={sourceQuery.data.run_id}
                source={sourceQuery.data}
                activeJobId={session.trainingJobId}
                onTrainingStarted={handleTrainingStarted}
              />
            ) : null}
          </div>
          <div className={view === 'compare' ? 'space-y-4' : 'hidden'}>
            <MLFilterComparison
              key={session.datasetId ?? 'no-dataset'}
              datasetId={session.datasetId}
              jobId={session.comparisonJobId}
              onJobStarted={(comparisonJobId) => patchSession({ comparisonJobId })}
            />
          </div>
          <div className={view === 'evaluate' ? 'space-y-4' : 'hidden'}>
            <MLFilterEvaluation
              key={session.datasetId ?? 'no-dataset'}
              datasetId={session.datasetId}
              frozen={session.evaluationRequest}
              jobId={session.evaluationJobId}
              onFreeze={(evaluationRequest) => patchSession({ evaluationRequest })}
              onJobStarted={(evaluationJobId) => patchSession({ evaluationJobId })}
            />
          </div>
        </div>
        {session.datasetId && view === 'train' ? (
          <div className="border-carbon-600/30 flex shrink-0 items-center justify-between gap-3 border-t pt-3">
            <p className="text-silver-400 text-xs">Saved models are ready to compare.</p>
            <Button variant="outline" size="sm" onClick={() => setView('compare')}>
              Compare models
            </Button>
          </div>
        ) : null}
      </section>
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

  const params = config?.strategy_params ?? {}
  const maLabel =
    params.short_period && params.long_period
      ? `${params.short_period} ${String(params.short_ma_type ?? 'MA').toUpperCase()} / ${params.long_period} ${String(params.long_ma_type ?? 'MA').toUpperCase()}`
      : 'MA Crossover'
  return (
    <Panel className="p-4" data-testid="ml-filter-source-summary">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-silver-100 text-base font-semibold">
            {source.symbol} {source.timeframe}
          </h3>
          <p className="text-silver-400 mt-1 text-xs">
            {formatExchangeLabel(source.date_range_start)} →{' '}
            {formatExchangeLabel(source.date_range_end)}
          </p>
        </div>
        <p className="text-silver-200 text-sm">
          <strong className="text-gold-400 tabular-nums">{source.source_sample_count}</strong>{' '}
          completed trades
        </p>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-xs">
        <Item label="Moving averages" value={runQuery.isLoading ? 'Loading…' : maLabel} />
        <Item
          label="Volume"
          value={volumeAvailable ? 'Real volume available' : 'Real volume unavailable'}
        />
      </dl>
      <details className="border-carbon-600/30 mt-3 border-t pt-2 text-xs">
        <summary className="text-silver-400 cursor-pointer py-1">
          Source settings & provenance
        </summary>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <Item label="Run ID" value={source.run_id} />
          <Item label="MA parameters" value={describe(params, runQuery.isLoading)} />
          <Item label="Exits" value={describe(config?.exit_params, runQuery.isLoading)} />
          <Item label="Costs" value={describe(config?.costs, runQuery.isLoading)} />
          <Item label="Sizing" value={describe(config?.position_sizing, runQuery.isLoading)} />
        </dl>
      </details>
    </Panel>
  )
}

function describe(value: Record<string, unknown> | undefined, loading: boolean): string {
  if (loading) return 'Loading…'
  if (!value || Object.keys(value).length === 0) return 'Defaults / not recorded'
  return Object.entries(value)
    .map(([key, item]) => `${key.replaceAll('_', ' ')}: ${String(item)}`)
    .join(' · ')
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-silver-400">{label}</dt>
      <dd className="text-silver-200 mt-1 leading-relaxed break-words">{value}</dd>
    </div>
  )
}
