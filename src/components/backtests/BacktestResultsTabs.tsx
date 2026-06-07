import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'

import { BacktestMetricsBar } from '@/components/backtests/BacktestMetricsBar'
import { BacktestStrategyChart } from '@/components/backtests/BacktestStrategyChart'
import { DrawdownChart } from '@/components/backtests/DrawdownChart'
import { EquityCurveChart } from '@/components/backtests/EquityCurveChart'
import { MonthlyBreakdownTable } from '@/components/backtests/MonthlyBreakdownTable'
import { MonthlyPnLChart } from '@/components/backtests/MonthlyPnLChart'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { formatCurrency, formatSignedCurrency } from '@/components/backtests/chartUtils'
import { generateBacktestReport } from '@/lib/reports/backtestReport'
import { cn } from '@/lib/utils'
import type {
  BacktestRequest,
  BacktestResponse,
  EquityPoint,
  MonthlyStats,
  Trade,
} from '@/types/backtesting'

type TabId = 'performance' | 'monthly' | 'trade-chart' | 'trades'

const TABS: { id: TabId; label: string }[] = [
  { id: 'performance', label: 'Performance' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'trade-chart', label: 'Trade Chart' },
  { id: 'trades', label: 'Trade List' },
]

type BacktestResultsTabsProps = {
  results: BacktestResponse
  request: BacktestRequest | null
  initialCapital: number
  equityCurve: EquityPoint[]
  monthlyStats: MonthlyStats[]
  symbol: string
  timeframe: string
}

function formatPositionSize(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2)
}

function TradeHistoryTable({ trades }: { trades: Trade[] }) {
  return (
    <div className="border-carbon-600/60 overflow-x-auto rounded-lg border">
      <table className="text-silver-200 w-full text-left text-sm">
        <thead className="text-silver-400 bg-carbon-800 border-carbon-600/60 border-b text-xs uppercase">
          <tr>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3 text-right">Size</th>
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
              <td className="text-silver-100 px-4 py-3 text-right font-mono tabular-nums">
                {formatPositionSize(trade.quantity)}
              </td>
              <td className="px-4 py-3">{formatDisplayDateTime(trade.entry_time)}</td>
              <td className="px-4 py-3">{formatCurrency(trade.entry_price)}</td>
              <td className="px-4 py-3">
                {trade.exit_time ? formatDisplayDateTime(trade.exit_time) : '-'}
              </td>
              <td className="px-4 py-3">
                {trade.exit_price != null ? formatCurrency(trade.exit_price) : '-'}
              </td>
              <td
                className={`px-4 py-3 text-right font-medium tabular-nums ${trade.pnl && trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {trade.pnl != null ? formatSignedCurrency(trade.pnl) : '-'}
              </td>
            </tr>
          ))}
          {trades.length === 0 && (
            <tr>
              <td colSpan={8} className="text-silver-400 px-4 py-8 text-center">
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
  request,
  initialCapital,
  equityCurve,
  monthlyStats,
  symbol,
  timeframe,
}: BacktestResultsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('performance')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      await generateBacktestReport({
        results,
        request,
        initialCapital,
        equityCurve,
        monthlyStats,
        symbol,
        timeframe,
      })
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to export PDF',
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden pr-2">
      <div className="shrink-0">
        <BacktestMetricsBar metrics={results.metrics} />
      </div>

      <div className="border-carbon-600/60 mb-4 flex shrink-0 items-center gap-1 border-b">
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

        <div className="ml-auto flex items-center gap-2 pb-1">
          {exportError && (
            <span className="max-w-[16rem] truncate text-xs text-rose-400" title={exportError}>
              {exportError}
            </span>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="border-carbon-600/60 text-silver-200 hover:border-brass-400/60 hover:text-brass-400 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
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

      {activeTab === 'trade-chart' && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <BacktestStrategyChart
            bars={results.bars}
            indicators={results.indicators}
            trades={results.trades}
            symbol={symbol}
            timeframe={timeframe}
          />
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
