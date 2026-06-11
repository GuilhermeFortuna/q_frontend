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
    <div className="border-brass-600/15 bg-carbon-900/40 overflow-x-auto rounded-xl border shadow-lg">
      <table className="text-silver-200 w-full text-left text-sm">
        <thead className="text-silver-400 bg-carbon-950/60 border-brass-600/15 border-b text-[10px] font-bold tracking-wider uppercase">
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
        <tbody className="divide-carbon-800/60 divide-y">
          {trades.map((trade) => (
            <tr key={trade.id} className="hover:bg-carbon-800/30 transition-all">
              <td className="text-silver-100 px-4 py-3 font-mono text-xs font-bold">
                {trade.symbol}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-md px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase ${trade.action === 'BUY' ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border border-rose-500/20 bg-rose-500/10 text-rose-400'}`}
                >
                  {trade.action}
                </span>
              </td>
              <td className="text-silver-100 px-4 py-3 text-right font-mono text-xs tabular-nums">
                {formatPositionSize(trade.quantity)}
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                {formatDisplayDateTime(trade.entry_time)}
              </td>
              <td className="px-4 py-3 font-mono text-xs">{formatCurrency(trade.entry_price)}</td>
              <td className="px-4 py-3 font-mono text-xs">
                {trade.exit_time ? formatDisplayDateTime(trade.exit_time) : '-'}
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                {trade.exit_price != null ? formatCurrency(trade.exit_price) : '-'}
              </td>
              <td
                className={`px-4 py-3 text-right font-mono text-xs font-bold tabular-nums ${trade.pnl && trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
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

      <div className="border-brass-600/15 mb-4 flex shrink-0 items-center gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-200',
              activeTab === tab.id
                ? 'border-brass-400 text-brass-400 drop-shadow-[0_0_8px_rgba(196,165,116,0.25)]'
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
            className="border-brass-600/15 bg-carbon-900/50 text-silver-200 hover:border-brass-400/50 hover:bg-carbon-800/85 hover:text-brass-400 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
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
