import { Loader2, RefreshCw } from 'lucide-react'

import { useNeuralModels } from '@/api/queries/neural'
import {
  encoderKindFromModelKey,
  neuralStatusChipClass,
  neuralStatusLabel,
} from '@/components/research/neural/neuralUtils'
import { Button } from '@/components/ui/button'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { cn } from '@/lib/utils'
import type { NeuralModelListItem } from '@/types/neural'

type NeuralModelListProps = {
  selectedHash: string | null
  onSelectModel: (modelHash: string) => void
}

function NeuralModelSkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }, (_, index) => (
        <tr key={index} className="border-carbon-800/60 border-t">
          {Array.from({ length: 6 }, (__, cellIndex) => (
            <td key={cellIndex} className="px-3 py-3">
              <div className="bg-carbon-800/40 h-4 animate-pulse rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function NeuralModelRow({
  model,
  selected,
  onSelect,
}: {
  model: NeuralModelListItem
  selected: boolean
  onSelect: () => void
}) {
  return (
    <tr
      className={cn(
        'border-carbon-800/60 hover:bg-carbon-800/35 text-silver-200 cursor-pointer border-t transition-all duration-150',
        selected && 'bg-carbon-800/50',
      )}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      tabIndex={0}
      data-testid={`neural-model-row-${model.model_hash}`}
    >
      <td className="text-cream-100 px-3 py-2.5 font-mono text-xs font-medium">
        {model.model_key}
      </td>
      <td className="text-silver-300 px-3 py-2.5 font-mono text-xs">
        {model.symbol} · {model.timeframe}
      </td>
      <td className="text-silver-300 px-3 py-2.5 capitalize">
        {encoderKindFromModelKey(model.model_key)}
      </td>
      <td className="text-silver-300 px-3 py-2.5 text-right font-mono">{model.n_latents}</td>
      <td className="px-3 py-2.5">
        <span
          className={neuralStatusChipClass(model.status)}
          data-testid={`neural-status-${model.model_hash}`}
        >
          {neuralStatusLabel(model.status)}
        </span>
      </td>
      <td className="text-silver-400 px-3 py-2.5 text-right text-xs">
        {formatDisplayDateTime(model.created_at)}
      </td>
    </tr>
  )
}

export function NeuralModelList({ selectedHash, onSelectModel }: NeuralModelListProps) {
  const modelsQuery = useNeuralModels()

  if (modelsQuery.isLoading) {
    return (
      <div className="text-silver-400 flex items-center gap-2 px-1 py-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading neural models…
      </div>
    )
  }

  if (modelsQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <p className="text-sm text-rose-400">Failed to load neural models.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => modelsQuery.refetch()}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  const models = modelsQuery.data?.models ?? []

  if (models.length === 0) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center"
        data-testid="neural-model-list-empty"
      >
        <p className="text-silver-300 text-sm">No neural models yet.</p>
        <p className="text-silver-500 max-w-md text-xs">
          No neural models yet — train one using the form above.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid="neural-model-list">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="bg-silver-950/40 sticky top-0 z-10 backdrop-blur-sm">
          <tr>
            {['Model', 'Instrument', 'Kind', 'Latents', 'Status', 'Created'].map((label, index) => (
              <th
                key={label}
                scope="col"
                className={cn(
                  'text-silver-400 px-3 py-2 text-left text-[10px] font-bold tracking-wider uppercase',
                  index >= 3 && index !== 4 && 'text-right',
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modelsQuery.isFetching && !modelsQuery.isLoading ? (
            <tr>
              <td colSpan={6} className="text-silver-500 px-3 py-2 text-xs">
                Refreshing…
              </td>
            </tr>
          ) : null}
          {models.map((model) => (
            <NeuralModelRow
              key={model.model_hash}
              model={model}
              selected={selectedHash === model.model_hash}
              onSelect={() => onSelectModel(model.model_hash)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function NeuralModelListSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid="neural-model-list">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <tbody>
          <NeuralModelSkeletonRows />
        </tbody>
      </table>
    </div>
  )
}
