import { useReplayDatasets, useReplayTickstore } from '@/api/queries/replay'
import { Callout } from '@/components/ui/Callout'
import { ReplayFreezeForm } from '@/workspaces/replay/ReplayFreezeForm'
import { formatDayRange } from '@/workspaces/replay/replayTime'

type ReplayDatasetsProps = {
  selectedId: string
  onSelect: (datasetId: string) => void
}

export function ReplayDatasets({ selectedId, onSelect }: ReplayDatasetsProps) {
  const datasets = useReplayDatasets()
  const tickstore = useReplayTickstore()

  return (
    <div className="space-y-4">
      {datasets.isError ? (
        <Callout type="error" title="Datasets could not be loaded">
          {datasets.error instanceof Error ? datasets.error.message : 'Try again shortly.'}
        </Callout>
      ) : null}

      {datasets.data && datasets.data.length === 0 ? (
        <p className="text-silver-400 text-sm">
          No dataset is frozen yet. Open “Freeze a new dataset” below, freeze a TickStore range,
          then choose it here.
        </p>
      ) : null}

      {datasets.data && datasets.data.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-silver-300 mb-2 text-xs font-medium">Frozen datasets</legend>
          {datasets.data.map((dataset) => {
            const ready = dataset.state === 'ready'
            return (
              <label
                key={dataset.dataset_id}
                className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                  ready ? 'border-silver-600/40 cursor-pointer' : 'border-silver-700/30 opacity-70'
                }`}
              >
                <input
                  type="radio"
                  name="replay-dataset"
                  value={dataset.dataset_id}
                  checked={selectedId === dataset.dataset_id}
                  disabled={!ready}
                  onChange={() => onSelect(dataset.dataset_id)}
                  className="accent-brass-500"
                />
                <span className="text-silver-100 font-mono">{dataset.symbol}</span>
                <span className="text-silver-300">
                  {formatDayRange(dataset.start_day, dataset.end_day)}
                </span>
                <span className="text-silver-400 text-xs tracking-wide uppercase">
                  {dataset.state}
                </span>
                {dataset.state === 'failed' && dataset.error ? (
                  <span className="basis-full text-xs text-rose-300">{dataset.error}</span>
                ) : null}
                {dataset.state === 'preparing' ? (
                  <span className="text-silver-400 text-xs">Freezing the TickStore range…</span>
                ) : null}
              </label>
            )
          })}
        </fieldset>
      ) : null}

      <details className="border-silver-700/30 rounded-lg border p-3">
        <summary className="text-silver-200 cursor-pointer text-sm">Freeze a new dataset</summary>
        <div className="mt-3 space-y-3">
          {tickstore.data && tickstore.data.length > 0 ? (
            <ul
              className="text-silver-400 space-y-1 text-xs"
              aria-label="TickStore sessions on disk"
            >
              {tickstore.data.map((entry) => (
                <li key={entry.symbol}>
                  <span className="text-silver-300 font-mono">{entry.symbol}</span>:{' '}
                  {entry.days.length === 0
                    ? 'no sessions'
                    : `${entry.days[0]} → ${entry.days[entry.days.length - 1]} (${entry.days.length} sessions)`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-silver-400 text-xs">No TickStore sessions are on disk.</p>
          )}
          <ReplayFreezeForm symbols={tickstore.data?.map((entry) => entry.symbol) ?? []} />
        </div>
      </details>
    </div>
  )
}
