import { memo, useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'

import { BacktestMetricsBar } from '@/components/backtests/BacktestMetricsBar'
import { LazyBacktestStrategyChart } from '@/components/backtests/LazyBacktestStrategyChart'
import {
  LazyBacktestMonthlyChart,
  LazyBacktestPerformanceCharts,
} from '@/components/backtests/LazyBacktestRechartsCharts'
import { MonthlyBreakdownTable } from '@/components/backtests/MonthlyBreakdownTable'
import { VirtualTableScroller } from '@/components/shared/VirtualTableBody'
import { formatDisplayDateTime } from '@/lib/formatDate'
import {
  formatCurrency,
  formatSignedCurrency,
  formatExitReason,
} from '@/components/backtests/chartUtils'
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
  performanceComputing?: boolean
  symbol: string
  timeframe: string
}

function formatPositionSize(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2)
}

const TRADE_ROW_HEIGHT = 44

function TradeHistoryTable({
  trades,
  focusedTradeId,
  hoveredTradeId,
  onHoverTrade,
  onClickTrade,
}: {
  trades: Trade[]
  focusedTradeId?: string | null
  hoveredTradeId?: string | null
  onHoverTrade?: (id: string | null) => void
  onClickTrade?: (id: string) => void
}) {
  const renderTradeRow = (trade: Trade) => {
    const isHighlighted = focusedTradeId === trade.id || hoveredTradeId === trade.id
    return (
      <tr
        key={trade.id}
        onClick={() => onClickTrade?.(trade.id)}
        onMouseEnter={() => onHoverTrade?.(trade.id)}
        onMouseLeave={() => onHoverTrade?.(null)}
        className={cn(
          'cursor-pointer border-l-2 transition-all',
          isHighlighted
            ? 'bg-brass-500/10 border-l-brass-500'
            : 'hover:bg-carbon-800/30 border-l-transparent',
        )}
      >
        <td className="text-silver-100 px-4 py-3 font-mono text-xs font-bold">{trade.symbol}</td>
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
        <td className="px-4 py-3 font-mono text-xs">{formatDisplayDateTime(trade.entry_time)}</td>
        <td className="px-4 py-3 font-mono text-xs">{formatCurrency(trade.entry_price)}</td>
        <td className="px-4 py-3 font-mono text-xs">
          {trade.exit_time ? formatDisplayDateTime(trade.exit_time) : '-'}
        </td>
        <td className="px-4 py-3 font-mono text-xs">
          {trade.exit_price != null ? formatCurrency(trade.exit_price) : '-'}
        </td>
        <td className="px-4 py-3 font-mono text-xs">
          {trade.exit_reason ? formatExitReason(trade.exit_reason) : '-'}
        </td>
        <td
          className={`px-4 py-3 text-right font-mono text-xs font-bold tabular-nums ${trade.pnl && trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
        >
          {trade.pnl != null ? formatSignedCurrency(trade.pnl) : '-'}
        </td>
      </tr>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="border-brass-600/15 bg-carbon-900/40 text-silver-400 rounded-xl border px-4 py-8 text-center text-sm shadow-lg">
        No trades executed in this backtest.
      </div>
    )
  }

  return (
    <div className="border-brass-600/15 bg-carbon-900/40 overflow-hidden rounded-xl border shadow-lg">
      <VirtualTableScroller
        items={trades}
        rowHeight={TRADE_ROW_HEIGHT}
        colSpan={9}
        className="max-h-[min(60vh,560px)]"
        tableClassName="text-silver-200 text-sm"
        theadClassName="text-silver-400 bg-carbon-950/60 border-brass-600/15 border-b text-[10px] font-bold tracking-wider uppercase"
        getItemKey={(index) => trades[index]!.id}
        header={
          <tr>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3 text-right">Size</th>
            <th className="px-4 py-3">Entry Time</th>
            <th className="px-4 py-3">Entry Price</th>
            <th className="px-4 py-3">Exit Time</th>
            <th className="px-4 py-3">Exit Price</th>
            <th className="px-4 py-3">Exit Reason</th>
            <th className="px-4 py-3 text-right">PnL</th>
          </tr>
        }
        renderRow={(trade) => renderTradeRow(trade)}
      />
    </div>
  )
}

export const BacktestResultsTabs = memo(function BacktestResultsTabs({
  results,
  request,
  initialCapital,
  equityCurve,
  monthlyStats,
  performanceComputing = false,
  symbol,
  timeframe,
}: BacktestResultsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('performance')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [focusedTradeId, setFocusedTradeId] = useState<string | null>(null)
  const [hoveredTradeId, setHoveredTradeId] = useState<string | null>(null)

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      const { generateBacktestReport } = await import('@/lib/reports/backtestReport')
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
    <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(320px,1fr)] overflow-hidden pr-2">
      <div>
        <BacktestMetricsBar metrics={results.metrics} />
      </div>

      <div className="border-brass-600/15 mb-4 flex items-center gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-200',
              activeTab === tab.id
                ? 'border-brass-400 text-brass-400 [text-shadow:0_0_8px_rgba(196,165,116,0.25)]'
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === 'performance' && (
          <div className="h-full space-y-3 overflow-y-auto">
            {performanceComputing ? (
              <div className="text-silver-400 flex items-center gap-2 py-4 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Computing performance series…
              </div>
            ) : (
              <LazyBacktestPerformanceCharts
                equityCurve={equityCurve}
                initialCapital={initialCapital}
                bars={results.bars}
                trades={results.trades}
              />
            )}
          </div>
        )}

        {activeTab === 'monthly' && (
          <div className="h-full space-y-6 overflow-y-auto">
            <LazyBacktestMonthlyChart monthlyStats={monthlyStats} />
            <div>
              <h3 className="text-silver-100 mb-4 text-lg font-semibold">Monthly Breakdown</h3>
              <MonthlyBreakdownTable data={monthlyStats} />
            </div>
          </div>
        )}

        {activeTab === 'trade-chart' && (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <LazyBacktestStrategyChart
              bars={results.bars}
              indicators={results.indicators}
              trades={results.trades}
              symbol={symbol}
              timeframe={timeframe}
              runId={results.run_id || undefined}
              focusedTradeId={focusedTradeId}
              hoveredTradeId={hoveredTradeId}
              onHoverTradeChange={setHoveredTradeId}
            />
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="h-full overflow-y-auto">
            <h3 className="text-silver-100 mb-4 text-lg font-semibold">Trade History</h3>
            <TradeHistoryTable
              trades={results.trades}
              focusedTradeId={focusedTradeId}
              hoveredTradeId={hoveredTradeId}
              onHoverTrade={setHoveredTradeId}
              onClickTrade={(id) => {
                setFocusedTradeId(id)
                setActiveTab('trade-chart')
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
})
