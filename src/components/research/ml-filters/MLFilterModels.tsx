import { shortMlFilterId } from '@/lib/mlFilters/mlFilterFormat'
import { useMemo } from 'react'

import {
  getMlFilterErrorMessage,
  useMlFilterModel,
  useMlFilterModels,
} from '@/api/queries/mlFilters'
import { EntityCard } from '@/components/ui/EntityCard'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/Callout'
import { LabeledField } from '@/components/ui/LabeledField'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { formatExchangeLabel, algorithmLabel } from '@/lib/mlFilters/mlFilterForm'
import { formatNullableMetric } from '@/lib/mlFilters/mlFilterFormat'

type MLFilterModelsProps = {
  datasetId: string | null
  onDatasetChange: (datasetId: string | null) => void
  selectedModelId: string | null
  onSelectModel: (modelVersionId: string | null) => void
  /** Opens a pinned backtest setup for a ready model. */
  onUseInBacktest?: (modelVersionId: string) => void
  onCompare?: () => void
}

export function MLFilterModels({
  datasetId,
  onDatasetChange,
  selectedModelId,
  onSelectModel,
  onUseInBacktest,
  onCompare,
}: MLFilterModelsProps) {
  const modelsQuery = useMlFilterModels()
  const items = useMemo(() => modelsQuery.data?.items ?? [], [modelsQuery.data])
  const datasetIds = useMemo(() => [...new Set(items.map((item) => item.dataset_id))], [items])
  const visible = datasetId ? items.filter((item) => item.dataset_id === datasetId) : items

  return (
    <Panel className="flex shrink-0 flex-col gap-3 p-4" data-testid="ml-filter-models">
      <div className="space-y-4">
        <SectionHeader title="Saved model versions" />
        <p className="text-silver-400 text-xs">
          Versions that share a dataset and split can be compared on validation data.
        </p>

        {modelsQuery.isLoading ? (
          <p className="text-silver-400 text-sm">Loading model versions…</p>
        ) : null}
        {modelsQuery.isError ? (
          <Callout type="error" title="Could not load model versions">
            {getMlFilterErrorMessage(modelsQuery.error)}
          </Callout>
        ) : null}
        {!modelsQuery.isLoading && !modelsQuery.isError && items.length === 0 ? (
          <p className="text-silver-400 text-sm" data-testid="ml-filter-models-empty">
            No saved ML filter versions yet. Select a source and train models to build your library.
          </p>
        ) : null}

        {items.length > 0 ? (
          <>
            <LabeledField label="Dataset" htmlFor="ml-filter-dataset">
              <select
                id="ml-filter-dataset"
                value={datasetId ?? ''}
                onChange={(event) => onDatasetChange(event.target.value || null)}
                className="surface-well text-silver-100 w-full min-w-0 rounded-lg px-3 py-2 text-xs"
              >
                <option value="">All datasets</option>
                {datasetIds.map((id) => (
                  <option key={id} value={id}>
                    {items.find((item) => item.dataset_id === id)?.symbol} · {shortMlFilterId(id)}
                  </option>
                ))}
              </select>
            </LabeledField>

            <div className="space-y-2">
              {visible.map((item) => (
                <div key={item.model_version_id} data-testid="ml-filter-model-row">
                  <EntityCard
                    title={algorithmLabel(item.algorithm)}
                    tag={item.ready ? 'Ready' : 'Unavailable'}
                    description={`${item.symbol} · ${item.timeframe} · trained through ${formatExchangeLabel(item.train_end).split(' ')[0]}`}
                    meta={
                      <span title={item.model_version_id}>
                        {shortMlFilterId(item.model_version_id)} ·{' '}
                        {item.selected_features?.length ?? 0} features
                      </span>
                    }
                    selected={item.model_version_id === selectedModelId}
                    onSelect={() => {
                      if (item.dataset_id !== datasetId) onDatasetChange(item.dataset_id)
                      onSelectModel(
                        item.model_version_id === selectedModelId ? null : item.model_version_id,
                      )
                    }}
                  />
                  {!item.ready ? (
                    <p className="mt-1 text-xs break-words text-rose-300">
                      {(item.compatibility_reasons ?? []).join(' ') || 'Artifact unavailable'}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {datasetId && onCompare ? (
          <Button type="button" variant="outline" size="sm" onClick={onCompare}>
            Compare this dataset
          </Button>
        ) : null}
        {selectedModelId ? (
          <ModelDetail
            modelVersionId={selectedModelId}
            onClose={() => onSelectModel(null)}
            onUseInBacktest={onUseInBacktest}
            ready={items.find((item) => item.model_version_id === selectedModelId)?.ready ?? false}
          />
        ) : null}
      </div>
    </Panel>
  )
}

function ModelDetail({
  modelVersionId,
  ready,
  onClose,
  onUseInBacktest,
}: {
  modelVersionId: string
  ready: boolean
  onClose: () => void
  onUseInBacktest?: (modelVersionId: string) => void
}) {
  const detailQuery = useMlFilterModel(modelVersionId)
  const detail = detailQuery.data
  const auc = formatNullableMetric(detail?.validation_metrics?.roc_auc)
  const provenance = detail?.provenance ?? {}

  return (
    <section
      aria-label="Model version detail"
      className="border-carbon-600/30 space-y-3 border-t pt-3 text-xs"
      data-testid="ml-filter-model-detail"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-silver-200 text-sm font-medium">Selected model</h4>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      {detailQuery.isLoading ? <p className="text-silver-400">Loading detail…</p> : null}
      {detailQuery.isError ? (
        <Callout type="error" title="Model detail unavailable">
          {getMlFilterErrorMessage(detailQuery.error)}
        </Callout>
      ) : null}
      {detail ? (
        <dl className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-silver-400">Algorithm</dt>
            <dd>{algorithmLabel(detail.algorithm)}</dd>
          </div>
          <div>
            <dt className="text-silver-400">Seed</dt>
            <dd>{String(provenance.seed ?? '—')}</dd>
          </div>
          <div>
            <dt className="text-silver-400">Validation ROC AUC</dt>
            <dd>
              {auc.text}
              {auc.reason ? <span className="text-silver-400"> — {auc.reason}</span> : null}
            </dd>
          </div>
        </dl>
      ) : null}
      {detail ? (
        <details className="text-silver-400">
          <summary className="cursor-pointer py-1">Version & provenance</summary>
          <dl className="mt-2 space-y-2 break-words">
            <div>
              <dt>Version</dt>
              <dd>{modelVersionId}</dd>
            </div>
            <div>
              <dt>Dataset</dt>
              <dd>{detail.dataset_id}</dd>
            </div>
            <div>
              <dt>Source run</dt>
              <dd>{String(provenance.source_run_id ?? '—')}</dd>
            </div>
            <div>
              <dt>Model parameters</dt>
              <dd>{JSON.stringify(provenance.hyperparameters ?? {})}</dd>
            </div>
          </dl>
        </details>
      ) : null}
      {onUseInBacktest ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!ready}
          onClick={() => onUseInBacktest(modelVersionId)}
          data-testid="ml-filter-use-in-backtest"
        >
          Use in Backtest
        </Button>
      ) : null}
      {!ready ? (
        <p className="text-rose-300">
          This version is incompatible and cannot be used in a backtest.
        </p>
      ) : null}
    </section>
  )
}
