import { useMemo } from 'react'
import { formatSignedCurrency } from '@/components/backtests/chartUtils'
import { DataTable, type DataColumn } from '@/components/ui'
import type { MonthlyStats } from '@/types/backtesting'

type MonthlyBreakdownTableProps = {
  data: MonthlyStats[]
}

export function MonthlyBreakdownTable({ data }: MonthlyBreakdownTableProps) {
  const columns = useMemo<DataColumn<MonthlyStats>[]>(
    () => [
      { id: 'label', header: 'Month' },
      {
        id: 'pnl',
        header: 'PnL',
        align: 'right',
        numeric: true,
        tone: 'signed',
        render: (row) => formatSignedCurrency(row.pnl),
      },
      { id: 'trades', header: 'Trades', align: 'right', numeric: true },
      {
        id: 'wins',
        header: 'Wins',
        align: 'right',
        numeric: true,
        render: (row) => <span className="text-emerald-400">{row.wins}</span>,
      },
      {
        id: 'losses',
        header: 'Losses',
        align: 'right',
        numeric: true,
        render: (row) => <span className="text-rose-400">{row.losses}</span>,
      },
      {
        id: 'winRate',
        header: 'Win Rate',
        align: 'right',
        numeric: true,
        render: (row) => `${(row.winRate * 100).toFixed(1)}%`,
      },
    ],
    [],
  )

  if (data.length === 0) {
    return (
      <div className="border-carbon-600 bg-carbon-900/30 text-silver-400 rounded-lg border border-dashed px-4 py-8 text-center text-sm">
        No monthly breakdown available.
      </div>
    )
  }

  return <DataTable columns={columns} rows={data} rowKey={(row) => row.month} />
}
