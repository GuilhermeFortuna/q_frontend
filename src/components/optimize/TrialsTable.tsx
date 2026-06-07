import { useMemo, useState } from 'react'

import { cn } from '@/lib/utils'
import type { OptimizationResults, OptimizationTrial } from '@/types/optimization'

type SortKey = 'number' | 'objective' | 'total_pnl' | 'sharpe_ratio' | 'max_drawdown_pct'

type TrialsTableProps = {
  results: OptimizationResults
  selectedTrialNumber?: number | null
  onSelectTrial?: (trialNumber: number) => void
}

function metric(trial: OptimizationTrial, key: string): number | null {
  const value = trial.user_attrs.metrics?.[key]
  return value ?? null
}

function metricDisplay(trial: OptimizationTrial, key: string): string {
  const value = metric(trial, key)
  if (value == null) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function objectiveValue(trial: OptimizationTrial): string {
  if (!trial.values || trial.values.length === 0) return '—'
  return trial.values.map((v) => v.toFixed(3)).join(', ')
}

function objectiveSortValue(trial: OptimizationTrial): number {
  return trial.values?.[0] ?? -Infinity
}

export function TrialsTable({ results, selectedTrialNumber, onSelectTrial }: TrialsTableProps) {
  const bestNumber = results.best_trial?.number
  const [sortKey, setSortKey] = useState<SortKey>('number')
  const [sortAsc, setSortAsc] = useState(true)

  const trials = useMemo(() => {
    const sorted = [...results.trials]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'number':
          cmp = a.number - b.number
          break
        case 'objective':
          cmp = objectiveSortValue(a) - objectiveSortValue(b)
          break
        case 'total_pnl':
          cmp = (metric(a, 'total_pnl') ?? -Infinity) - (metric(b, 'total_pnl') ?? -Infinity)
          break
        case 'sharpe_ratio':
          cmp = (metric(a, 'sharpe_ratio') ?? -Infinity) - (metric(b, 'sharpe_ratio') ?? -Infinity)
          break
        case 'max_drawdown_pct':
          cmp =
            (metric(a, 'max_drawdown_pct') ?? Infinity) -
            (metric(b, 'max_drawdown_pct') ?? Infinity)
          break
      }
      return sortAsc ? cmp : -cmp
    })
    return sorted
  }, [results.trials, sortKey, sortAsc])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((v) => !v)
    } else {
      setSortKey(key)
      setSortAsc(key === 'number')
    }
  }

  const SortHeader = ({ label, colKey }: { label: string; colKey: SortKey }) => (
    <th className="px-2 py-1.5 font-medium">
      <button
        type="button"
        onClick={() => handleSort(colKey)}
        className="hover:text-silver-200 flex items-center gap-1"
      >
        {label}
        {sortKey === colKey && (
          <span className="text-brass-400 text-[10px]">{sortAsc ? '↑' : '↓'}</span>
        )}
      </button>
    </th>
  )

  return (
    <div className="border-carbon-600/40 flex min-h-0 flex-1 flex-col rounded-lg border p-4">
      <h4 className="text-silver-200 mb-3 shrink-0 text-sm font-medium">
        Trials ({results.trials.length})
      </h4>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-silver-400 bg-carbon-900 sticky top-0">
            <tr className="border-carbon-600/40 border-b">
              <SortHeader label="#" colKey="number" />
              <SortHeader label="Objective" colKey="objective" />
              <SortHeader label="Net Profit" colKey="total_pnl" />
              <SortHeader label="Sharpe" colKey="sharpe_ratio" />
              <SortHeader label="Max DD" colKey="max_drawdown_pct" />
              <th className="px-2 py-1.5 font-medium">State</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((trial) => {
              const isSelected = trial.number === selectedTrialNumber
              const isBest = trial.number === bestNumber
              return (
                <tr
                  key={trial.number}
                  onClick={() => onSelectTrial?.(trial.number)}
                  className={cn(
                    'border-carbon-700/40 cursor-pointer border-b transition-colors',
                    isSelected
                      ? 'bg-brass-600/15 text-brass-300'
                      : isBest
                        ? 'bg-brass-600/10 text-brass-300'
                        : 'text-silver-200 hover:bg-carbon-800/40',
                  )}
                >
                  <td className="px-2 py-1.5">{trial.number}</td>
                  <td className="px-2 py-1.5">{objectiveValue(trial)}</td>
                  <td className="px-2 py-1.5">{metricDisplay(trial, 'total_pnl')}</td>
                  <td className="px-2 py-1.5">{metricDisplay(trial, 'sharpe_ratio')}</td>
                  <td className="px-2 py-1.5">{metricDisplay(trial, 'max_drawdown_pct')}</td>
                  <td className="px-2 py-1.5">{trial.user_attrs.status ?? trial.state}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
