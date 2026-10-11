import { useCallback, useMemo, useState } from 'react'
import { useDiscoveryTrials, type DiscoveryTrialParams } from '@/api/queries/strategySearch'
import { Button, Callout, Panel } from '@/components/ui'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { inputClass } from '@/components/optimize/optimizeFormShared'
import type { DiscoveryTrial } from '@/types/strategySearch'

export function DiscoverTrialsTable({ runId, running }: { runId: string; running: boolean }) {
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [offset, setOffset] = useState(0)
  const [sort, setSort] = useState('finished_at')
  const [descending, setDescending] = useState(true)
  const [selected, setSelected] = useState<DiscoveryTrial | null>(null)
  const params: DiscoveryTrialParams = { limit: 100, offset, sort, descending }
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue
    Object.assign(params, {
      [key]: ['generation', 'window_index'].includes(key)
        ? Number(value) - 1
        : ['objective_min', 'objective_max'].includes(key)
          ? Number(value)
          : value,
    })
  }
  const query = useDiscoveryTrials(runId, params, running)
  const change = (key: string, value: string) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setOffset(0)
  }
  const header = useCallback(
    (label: string, key: string) => (
      <button
        type="button"
        onClick={() => {
          setDescending(sort === key ? !descending : true)
          setSort(key)
          setOffset(0)
        }}
      >
        {label}
        {sort === key ? (descending ? ' ↓' : ' ↑') : ''}
      </button>
    ),
    [sort, descending],
  )
  const columns = useMemo<DataColumn<DiscoveryTrial>[]>(
    () => [
      {
        id: 'number',
        header: header('Trial', 'trial_number'),
        render: (t) => `#${t.trial_number}`,
      },
      {
        id: 'candidate',
        header: header('Candidate', 'candidate_id'),
        render: (t) => t.candidate_id,
      },
      {
        id: 'generation',
        header: 'Generation',
        render: (t) => (t.generation < 0 ? '—' : t.generation + 1),
      },
      { id: 'window', header: header('Window', 'window_index'), render: (t) => t.window_index + 1 },
      { id: 'state', header: header('State', 'state'), render: (t) => t.state },
      {
        id: 'value',
        header: header('IS objective', 'objective_value'),
        numeric: true,
        render: (t) =>
          t.objective_value?.toLocaleString('en-US', { maximumFractionDigits: 4 }) ?? '—',
      },
      {
        id: 'profit',
        header: 'IS net profit',
        numeric: true,
        render: (t) =>
          t.metrics.total_pnl?.toLocaleString('en-US', { maximumFractionDigits: 2 }) ?? '—',
      },
      {
        id: 'params',
        header: 'Parameters',
        render: (t) => (
          <span className="font-mono text-xs">
            {Object.entries(t.parameters)
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join(', ')}
          </span>
        ),
      },
    ],
    [header],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-end gap-2">
        {[
          ['candidate_id', 'Candidate', 'text'],
          ['generation', 'Generation', 'number'],
          ['window_index', 'Window', 'number'],
          ['objective_min', 'IS objective min', 'number'],
          ['objective_max', 'IS objective max', 'number'],
          ['q', 'Parameter search', 'search'],
        ].map(([key, label, type]) => (
          <label key={key} className="text-silver-400 flex w-36 flex-col gap-1 text-xs">
            {label}
            <input
              className={inputClass}
              type={type}
              step="any"
              min={['generation', 'window_index'].includes(key) ? 1 : undefined}
              value={filters[key] ?? ''}
              onChange={(event) => change(key, event.target.value)}
            />
          </label>
        ))}
        <label className="text-silver-400 flex w-32 flex-col gap-1 text-xs">
          State
          <select
            className={inputClass}
            value={filters.state ?? ''}
            onChange={(event) => change('state', event.target.value)}
          >
            <option value="">All states</option>
            {['completed', 'pruned', 'error'].map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFilters({})
            setOffset(0)
          }}
        >
          Reset filters
        </Button>
      </div>
      <p className="text-silver-400 shrink-0 text-xs">
        Trials optimize in-sample (IS). Compare out-of-sample results in Candidates.
      </p>
      {query.isError ? (
        <Callout type="error" title="Trial results unavailable">
          Could not load trial results.{' '}
          <Button size="sm" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </Callout>
      ) : null}
      {!query.data?.items.length ? (
        <Panel className="text-silver-400 p-6 text-sm">
          {query.isPending
            ? 'Loading trials…'
            : Object.values(filters).some(Boolean)
              ? 'No trials match these filters.'
              : running
                ? 'Waiting for trials to finish…'
                : 'No recorded trial history is available for this run.'}
        </Panel>
      ) : (
        <DataTable
          columns={columns}
          rows={query.data.items}
          rowKey={trialIdentity}
          virtualize={{ rowHeight: 48 }}
          onRowClick={setSelected}
          selectedKey={selected ? trialIdentity(selected) : undefined}
        />
      )}
      <div className="flex shrink-0 items-center justify-between text-xs">
        <span>
          {query.data?.total ?? 0} matching trials{query.isFetching ? ' · Updating…' : ''}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 100))}
          >
            Previous
          </Button>
          <span>Page {Math.floor(offset / 100) + 1}</span>
          <Button
            size="sm"
            variant="ghost"
            disabled={offset + 100 >= (query.data?.total ?? 0)}
            onClick={() => setOffset(offset + 100)}
          >
            Next
          </Button>
        </div>
      </div>
      {selected ? (
        <Panel className="max-h-48 shrink-0 overflow-auto p-3 text-xs">
          <div className="flex items-center justify-between">
            <strong>
              {selected.candidate_id} · Window {selected.window_index + 1} · Trial #
              {selected.trial_number}
            </strong>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              Close trial details
            </Button>
          </div>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(
              { parameters: selected.parameters, metrics: selected.metrics, error: selected.error },
              null,
              2,
            )}
          </pre>
        </Panel>
      ) : null}
    </div>
  )
}

function trialIdentity(trial: DiscoveryTrial): string {
  return `${trial.candidate_id}:${trial.generation}:${trial.window_index}:${trial.trial_number}`
}
