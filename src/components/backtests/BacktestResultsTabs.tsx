import { useState } from 'react'

import { BacktestMetricsBar } from '@/components/backtests/BacktestMetricsBar'
import { DrawdownChart } from '@/components/backtests/DrawdownChart'
import { EquityCurveChart } from '@/components/backtests/EquityCurveChart'
import { MonthlyBreakdownTable } from '@/components/backtests/MonthlyBreakdownTable'
import { MonthlyPnLChart } from '@/components/backtests/MonthlyPnLChart'
import { cn } from '@/lib/utils'
import type { BacktestResponse, EquityPoint, MonthlyStats, Trade } from '@/types/backtesting'

type TabId = 'performance' | 'monthly' | 'trades'

const TABS: { id: TabId; label: string }[] = [
  { id: 'performance', label: 'Performance' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'trades', label: 'Trades' },
]

type BacktestResultsTabsProps = {
  results: BacktestResponse
  initialCapital: number
  equityCurve: EquityPoint[]
  monthlyStats: MonthlyStats[]
}

function TradeHistoryTable({ trades }: { trades: Trade[] }) {
  return (
    <div className="border-carbon-600/60 overflow-x-auto rounded-lg border">
      <table className="text-silver-200 w-full text-left text-sm">
        <thead className="text-silver-400 bg-carbon-800 border-carbon-600/60 border-b text-xs uppercase">
          <tr>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Entry Time</th>
            <th className="px-4 py-3">Entry Price</th>
            <th className="px-4 py-3">Exit Time</th>
            <th className="px-4 py-3">Exit Price</th>
            <th className="px-4 py-3 text-right">PnL</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-carbon-700/50 hover:bg-carbon-800/30 border-b">
              <td className="text-silver-100 px-4 py-3 font-medium">{trade.symbol}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${trade.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}
                >
                  {trade.action}
                </span>
              </td>
              <td className="px-4 py-3">{new Date(trade.entry_time).toLocaleString()}</td>
              <td className="px-4 py-3">{trade.entry_price.toFixed(2)}</td>
              <td className="px-4 py-3">
                {trade.exit_time ? new Date(trade.exit_time).toLocaleString() : '-'}
              </td>
              <td className="px-4 py-3">{trade.exit_price ? trade.exit_price.toFixed(2) : '-'}</td>
              <td
                className={`px-4 py-3 text-right font-medium ${trade.pnl && trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {trade.pnl ? (trade.pnl >= 0 ? '+' : '') + trade.pnl.toFixed(2) : '-'}
              </td>
            </tr>
          ))}
          {trades.length === 0 && (
            <tr>
              <td colSpan={7} className="text-silver-400 px-4 py-8 text-center">
                No trades executed in this backtest.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function BacktestResultsTabs({
  results,
  initialCapital,
  equityCurve,
  monthlyStats,
}: BacktestResultsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('performance')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden pr-2">
      <div className="shrink-0">
        <BacktestMetricsBar metrics={results.metrics} />
      </div>

      <div className="border-carbon-600/60 mb-4 flex shrink-0 gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-brass-400 text-brass-400'
                : 'text-silver-400 hover:text-silver-200 border-transparent',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'performance' && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <EquityCurveChart
            data={equityCurve}
            initialCapital={initialCapital}
            fillHeight
            className="min-h-0 flex-[3]"
          />
          <DrawdownChart data={equityCurve} fillHeight className="min-h-0 flex-[2]" />
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
          <MonthlyPnLChart data={monthlyStats} />
          <div>
            <h3 className="text-silver-100 mb-4 text-lg font-semibold">Monthly Breakdown</h3>
            <MonthlyBreakdownTable data={monthlyStats} />
          </div>
        </div>
      )}

      {activeTab === 'trades' && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <h3 className="text-silver-100 mb-4 text-lg font-semibold">Trade History</h3>
          <TradeHistoryTable trades={results.trades} />
        </div>
      )}
    </div>
  )
}
