import { useMemo } from 'react'

import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { formatSignedCurrency } from '@/components/backtests/chartUtils'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { cn } from '@/lib/utils'
import type { DrawdownPeriod } from '@/types/backtesting'

type RankedDrawdown = DrawdownPeriod & { rank: number; id: string }

function formatDepth(value: number): string {
  return `-${(Math.abs(value) * 100).toFixed(2)}%`
}

export function WorstDrawdownsTable({
  drawdowns,
  highlightedIndex,
  onHighlight,
}: {
  drawdowns: DrawdownPeriod[]
  highlightedIndex: number | null
  onHighlight: (index: number | null) => void
}) {
  const rows = useMemo<RankedDrawdown[]>(
    () =>
      drawdowns.map((period, index) => ({
        ...period,
        rank: index + 1,
        id: `${period.peak_time}-${period.trough_time}-${index}`,
      })),
    [drawdowns],
  )
  const columns = useMemo<DataColumn<RankedDrawdown>[]>(
    () => [
      { id: 'rank', header: '#', align: 'right', numeric: true, render: (row) => row.rank },
      {
        id: 'depth_pct',
        header: 'Depth %',
        align: 'right',
        numeric: true,
        render: (row) => <span className="text-rose-400">{formatDepth(row.depth_pct)}</span>,
      },
      {
        id: 'depth_value',
        header: 'Depth value',
        align: 'right',
        numeric: true,
        render: (row) => (
          <span className="text-rose-400">{formatSignedCurrency(-Math.abs(row.depth_value))}</span>
        ),
      },
      {
        id: 'peak_time',
        header: 'Peak',
        render: (row) => (
          <span className="font-mono text-xs">{formatDisplayDateTime(row.peak_time)}</span>
        ),
      },
      {
        id: 'trough_time',
        header: 'Trough',
        render: (row) => (
          <span className="font-mono text-xs">{formatDisplayDateTime(row.trough_time)}</span>
        ),
      },
      {
        id: 'recovery_time',
        header: 'Recovery',
        render: (row) =>
          row.recovery_time ? (
            <span className="font-mono text-xs">{formatDisplayDateTime(row.recovery_time)}</span>
          ) : (
            <span className="border-carbon-600/60 bg-carbon-800/60 text-silver-400 rounded border px-1.5 py-0.5 text-[10px]">
              Open
            </span>
          ),
      },
      {
        id: 'duration_days',
        header: 'Duration',
        align: 'right',
        numeric: true,
        render: (row) => `${row.duration_days.toFixed(1)} days`,
      },
      {
        id: 'trades',
        header: 'Trades',
        align: 'right',
        numeric: true,
        render: (row) => row.trades,
      },
    ],
    [],
  )

  return (
    <section
      aria-label="Worst drawdowns"
      className="border-carbon-700/50 bg-carbon-900/35 space-y-3 rounded-xl border p-4"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onHighlight(null)
      }}
    >
      <SectionHeader title="Worst drawdowns" />
      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowMouseEnter={(row) => onHighlight(row.rank - 1)}
          onRowMouseLeave={() => onHighlight(null)}
          onRowFocus={(row) => onHighlight(row.rank - 1)}
          isRowHighlighted={(row) => row.rank - 1 === highlightedIndex}
          getRowClassName={() =>
            cn(
              'transition-colors focus-visible:outline-brass-500 focus-visible:outline focus-visible:outline-1',
            )
          }
          tableClassName="min-w-[760px] text-xs text-silver-200"
          theadClassName="text-[10px] tracking-wider uppercase"
          emptyState="No drawdown periods recorded."
        />
      </div>
    </section>
  )
}
