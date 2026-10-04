import { useMemo } from 'react'

import {
  getMlFilterErrorMessage,
  useMlFilterModel,
  useMlFilterModels,
} from '@/api/queries/mlFilters'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/Callout'
import { LabeledField } from '@/components/ui/LabeledField'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { formatExchangeLabel, algorithmLabel } from '@/lib/mlFilters/mlFilterForm'
import { formatNullableMetric } from '@/lib/mlFilters/mlFilterFormat'
import type { MlFilterModelSummary } from '../../../../contracts/api'

type MLFilterModelsProps = {
  datasetId: string | null
  onDatasetChange: (datasetId: string | null) => void
  selectedModelId: string | null
  onSelectModel: (modelVersionId: string | null) => void
  /** Opens a pinned backtest setup for a ready model. */
  onUseInBacktest?: (modelVersionId: string) => void
}

export function MLFilterModels({
  datasetId,
  onDatasetChange,
  selectedModelId,
  onSelectModel,
  onUseInBacktest,
}: MLFilterModelsProps) {
  const modelsQuery = useMlFilterModels()
  const items = useMemo(() => modelsQuery.data?.items ?? [], [modelsQuery.data])
  const datasetIds = useMemo(() => [...new Set(items.map((item) => item.dataset_id))], [items])
  const visible = datasetId ? items.filter((item) => item.dataset_id === datasetId) : items

  return (
    <Panel className="flex flex-col gap-4 p-4" data-testid="ml-filter-models">
      <SectionHeader title="Saved model versions" />
      <p className="text-silver-500 text-xs">
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
          No saved ML filter versions yet. Train models from a backtest source above.
        </p>
      ) : null}

      {items.length > 0 ? (
        <>
          <LabeledField label="Dataset" htmlFor="ml-filter-dataset">
            <select
              id="ml-filter-dataset"
              value={datasetId ?? ''}
              onChange={(event) => onDatasetChange(event.target.value || null)}
              className="border-carbon-700 bg-carbon-900 text-silver-100 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All datasets</option>
              {datasetIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </LabeledField>

          <table className="w-full text-left text-xs">
            <caption className="sr-only">Saved ML filter model versions</caption>
            <thead className="text-silver-500">
              <tr>
                <th scope="col" className="py-1 pr-2">
                  Algorithm
                </th>
                <th scope="col" className="py-1 pr-2">
                  Instrument
                </th>
                <th scope="col" className="py-1 pr-2">
                  Training end
                </th>
                <th scope="col" className="py-1 pr-2">
                  Features
                </th>
                <th scope="col" className="py-1 pr-2">
                  Status
                </th>
                <th scope="col" className="py-1">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <ModelRow
                  key={item.model_version_id}
                  item={item}
                  selected={item.model_version_id === selectedModelId}
                  onSelect={() =>
                    onSelectModel(
                      item.model_version_id === selectedModelId ? null : item.model_version_id,
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {selectedModelId ? (
        <ModelDetail
          modelVersionId={selectedModelId}
          onClose={() => onSelectModel(null)}
          onUseInBacktest={onUseInBacktest}
          ready={items.find((item) => item.model_version_id === selectedModelId)?.ready ?? false}
        />
      ) : null}
    </Panel>
  )
}

function ModelRow({
  item,
  selected,
  onSelect,
}: {
  item: MlFilterModelSummary
  selected: boolean
  onSelect: () => void
}) {
  return (
    <tr className={selected ? 'bg-brass-500/10' : undefined} data-testid="ml-filter-model-row">
      <td className="py-1 pr-2">{algorithmLabel(item.algorithm)}</td>
      <td className="py-1 pr-2">
        {item.symbol} {item.timeframe}
      </td>
      <td className="py-1 pr-2">{formatExchangeLabel(item.train_end)}</td>
      <td className="py-1 pr-2">{(item.selected_features ?? []).join(', ')}</td>
      <td className="py-1 pr-2">
        {item.ready ? (
          'Ready'
        ) : (
          <span className="text-rose-300">
            Incompatible: {(item.compatibility_reasons ?? []).join(' ') || 'artifact unavailable'}
          </span>
        )}
      </td>
      <td className="py-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={selected}
          aria-label={`${selected ? 'Hide' : 'Show'} details for ${algorithmLabel(item.algorithm)} ${item.model_version_id}`}
          onClick={onSelect}
        >
          Details
        </Button>
      </td>
    </tr>
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
      className="border-carbon-700 space-y-2 rounded-lg border p-3 text-xs"
      data-testid="ml-filter-model-detail"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-silver-200 text-sm font-medium">{modelVersionId}</h4>
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
            <dt className="text-silver-500">Algorithm</dt>
            <dd>{algorithmLabel(detail.algorithm)}</dd>
          </div>
          <div>
            <dt className="text-silver-500">Dataset</dt>
            <dd>{detail.dataset_id}</dd>
          </div>
          <div>
            <dt className="text-silver-500">Source run</dt>
            <dd>{String(provenance.source_run_id ?? '—')}</dd>
          </div>
          <div>
            <dt className="text-silver-500">Seed</dt>
            <dd>{String(provenance.seed ?? '—')}</dd>
          </div>
          <div>
            <dt className="text-silver-500">Validation ROC AUC</dt>
            <dd>
              {auc.text}
              {auc.reason ? <span className="text-silver-500"> — {auc.reason}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-silver-500">Hyperparameters</dt>
            <dd>{JSON.stringify(provenance.hyperparameters ?? {})}</dd>
          </div>
        </dl>
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
