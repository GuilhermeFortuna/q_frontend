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
    <div className="border-carbon-600/60 overflow-x-auto rounded-lg border">
      <table className="text-silver-200 w-full text-left text-sm">
        <thead className="text-silver-400 bg-carbon-800 border-carbon-600/60 border-b text-xs uppercase">
          <tr>
            <th className="px-4 py-3">Month</th>
            <th className="px-4 py-3 text-right">PnL</th>
            <th className="px-4 py-3 text-right">Trades</th>
            <th className="px-4 py-3 text-right">Wins</th>
            <th className="px-4 py-3 text-right">Losses</th>
            <th className="px-4 py-3 text-right">Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.month} className="border-carbon-700/50 hover:bg-carbon-800/30 border-b">
              <td className="text-silver-100 px-4 py-3 font-medium">{row.label}</td>
              <td
                className={`px-4 py-3 text-right font-medium ${row.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {row.pnl >= 0 ? '+' : ''}
                {row.pnl.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right">{row.trades}</td>
              <td className="px-4 py-3 text-right text-emerald-400">{row.wins}</td>
              <td className="px-4 py-3 text-right text-rose-400">{row.losses}</td>
              <td className="px-4 py-3 text-right">{(row.winRate * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
