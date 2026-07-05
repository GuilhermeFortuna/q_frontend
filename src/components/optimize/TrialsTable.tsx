import { useMemo, useState } from 'react'

import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { sortOptimizationTrials, type TrialSortKey } from '@/lib/optimize/sortOptimizationTrials'
import { cn } from '@/lib/utils'
import type { OptimizationResults, OptimizationTrial } from '@/types/optimization'

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

const ROW_HEIGHT = 36

export function TrialsTable({ results, selectedTrialNumber, onSelectTrial }: TrialsTableProps) {
  const bestNumber = results.best_trial?.number
  const [sortKey, setSortKey] = useState<TrialSortKey>('number')
  const [sortAsc, setSortAsc] = useState(true)

  const trials = useMemo(
    () => sortOptimizationTrials(results.trials, sortKey, sortAsc),
    [results.trials, sortKey, sortAsc],
  )

  const handleSort = (key: TrialSortKey) => {
    if (sortKey === key) {
      setSortAsc((v) => !v)
    } else {
      setSortKey(key)
      setSortAsc(key === 'number')
    }
  }

  const SortHeader = ({ label, colKey }: { label: string; colKey: TrialSortKey }) => (
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
  )

  const columns = useMemo<DataColumn<OptimizationTrial>[]>(
    () => [
      {
        id: 'number',
        header: <SortHeader label="#" colKey="number" />,
        render: (trial) => trial.number,
      },
      {
        id: 'objective',
        header: <SortHeader label="Objective" colKey="objective" />,
        align: 'right',
        numeric: true,
        render: (trial) => objectiveValue(trial),
      },
      {
        id: 'total_pnl',
        header: <SortHeader label="Net Profit" colKey="total_pnl" />,
        align: 'right',
        numeric: true,
        render: (trial) => metricDisplay(trial, 'total_pnl'),
      },
      {
        id: 'sharpe_ratio',
        header: <SortHeader label="Sharpe" colKey="sharpe_ratio" />,
        align: 'right',
        numeric: true,
        render: (trial) => metricDisplay(trial, 'sharpe_ratio'),
      },
      {
        id: 'max_drawdown_pct',
        header: <SortHeader label="Max DD" colKey="max_drawdown_pct" />,
        align: 'right',
        numeric: true,
        render: (trial) => metricDisplay(trial, 'max_drawdown_pct'),
      },
      {
        id: 'state',
        header: 'State',
        render: (trial) => trial.user_attrs.status ?? trial.state,
      },
    ],
    [sortAsc, sortKey],
  )

  return (
    <div className="border-carbon-600/40 flex min-h-0 flex-1 flex-col rounded-lg border p-4">
      <h4 className="text-silver-200 mb-3 shrink-0 text-sm font-medium">
        Trials ({results.trials.length})
      </h4>
      <DataTable
        columns={columns}
        rows={trials}
        rowKey={(trial) => trial.number}
        selectedKey={selectedTrialNumber ?? null}
        isRowHighlighted={(trial) => trial.number === selectedTrialNumber}
        getRowClassName={(trial) =>
          cn(
            'cursor-pointer',
            trial.number === bestNumber &&
              trial.number !== selectedTrialNumber &&
              'bg-brass-600/10 text-brass-300',
          )
        }
        onRowClick={(trial) => onSelectTrial?.(trial.number)}
        virtualize={{ rowHeight: ROW_HEIGHT }}
      />
    </div>
  )
}
