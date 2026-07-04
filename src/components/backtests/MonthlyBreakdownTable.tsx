import { formatSignedCurrency } from '@/components/backtests/chartUtils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui'
import type { MonthlyStats } from '@/types/backtesting'

type MonthlyBreakdownTableProps = {
  data: MonthlyStats[]
}

export function MonthlyBreakdownTable({ data }: MonthlyBreakdownTableProps) {
  if (data.length === 0) {
    return (
      <div className="border-carbon-600 bg-carbon-900/30 text-silver-400 rounded-lg border border-dashed px-4 py-8 text-center text-sm">
        No monthly breakdown available.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Month</TableHead>
          <TableHead className="text-right">PnL</TableHead>
          <TableHead className="text-right">Trades</TableHead>
          <TableHead className="text-right">Wins</TableHead>
          <TableHead className="text-right">Losses</TableHead>
          <TableHead className="text-right">Win Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.month}>
            <TableCell className="text-silver-100 font-medium">{row.label}</TableCell>
            <TableCell
              className={`text-right font-medium tabular-nums ${row.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {formatSignedCurrency(row.pnl)}
            </TableCell>
            <TableCell className="text-right">{row.trades}</TableCell>
            <TableCell className="text-right text-emerald-400">{row.wins}</TableCell>
            <TableCell className="text-right text-rose-400">{row.losses}</TableCell>
            <TableCell className="text-right">{(row.winRate * 100).toFixed(1)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
