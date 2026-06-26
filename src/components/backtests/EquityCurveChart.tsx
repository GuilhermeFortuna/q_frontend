import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { CHART_COLORS, formatChartDate, formatCurrency } from '@/components/backtests/chartUtils'
import { ChartEmptyState } from '@/components/backtests/ChartEmptyState'
import { cn } from '@/lib/utils'
import type { EquityPoint, Trade } from '@/types/backtesting'
import type { OhlcvBar } from '@/types/api'

const EQUITY_CHART_HEIGHT_PX = 260

type EquityCurveChartProps = {
  data: EquityPoint[]
  initialCapital: number
  className?: string
  /** ISO timestamps for vertical window-boundary markers (e.g. OOS segment starts). */
  windowBoundaries?: string[]
  bars?: OhlcvBar[]
  trades?: Trade[]
}

function CustomEquityTooltip({
  active,
  payload,
  bars = [],
  trades = [],
}: {
  active?: boolean
  payload?: Array<{ payload: EquityPoint }>
  bars?: OhlcvBar[]
  trades?: Trade[]
}) {
  if (!active || !payload || !payload.length) return null

  const point = payload[0].payload as EquityPoint
  const timestamp = point.timestamp

  // Find corresponding candlestick bar
  const bar = bars.find((b) => b.timestamp === timestamp)

  // Find open positions
  const pointTime = new Date(timestamp).getTime()
  const activeTrades = trades.filter((t) => {
    const entryTime = new Date(t.entry_time).getTime()
    const exitTime = t.exit_time ? new Date(t.exit_time).getTime() : Infinity
    return pointTime >= entryTime && pointTime < exitTime
  })

  return (
    <div className="surface-overlay border-brass-600/30 max-w-[240px] space-y-2 rounded-lg border p-3 shadow-xl">
      <div className="text-silver-400 font-mono text-[10px]">
        {new Date(timestamp).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-silver-300">Equity:</span>
          <span className="text-silver-100 font-mono font-bold">
            {formatCurrency(point.equity)}
          </span>
        </div>

        {point.pnl !== 0 && (
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-silver-300">PnL:</span>
            <span
              className={cn(
                'font-mono font-bold',
                point.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
              )}
            >
              {point.pnl >= 0 ? '+' : ''}
              {formatCurrency(point.pnl)}
            </span>
          </div>
        )}

        <div className="flex justify-between gap-4 text-xs">
          <span className="text-silver-300">Drawdown:</span>
          <span className="font-mono font-bold text-rose-400">
            -{point.drawdownPct.toFixed(2)}%
          </span>
        </div>

        <div className="border-carbon-800/40 mt-1 flex justify-between gap-4 border-t pt-1 text-xs">
          <span className="text-silver-300">Open Trades:</span>
          <span className="text-brass-400 font-mono font-bold">{activeTrades.length}</span>
        </div>
      </div>

      {bar && (
        <div className="border-carbon-800/40 text-silver-400 space-y-0.5 border-t pt-1 font-mono text-[9px]">
          <div className="flex justify-between">
            <span>Bar O:</span>
            <span className="text-silver-200">{formatCurrency(bar.open)}</span>
          </div>
          <div className="flex justify-between">
            <span>Bar C:</span>
            <span className="text-silver-200">{formatCurrency(bar.close)}</span>
          </div>
        </div>
      )}

      {activeTrades.length > 0 && (
        <div className="border-carbon-800/40 max-h-[80px] space-y-1 overflow-y-auto border-t pt-1">
          <div className="text-brass-500 text-[8px] font-bold tracking-wider uppercase">
            Active Trades
          </div>
          {activeTrades.slice(0, 3).map((t) => (
            <div key={t.id} className="flex justify-between font-mono text-[8px] leading-tight">
              <span className={t.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                {t.action} {t.quantity}
              </span>
              <span className="text-silver-300">{formatCurrency(t.entry_price)}</span>
            </div>
          ))}
          {activeTrades.length > 3 && (
            <div className="text-silver-500 text-right text-[7px] italic">
              + {activeTrades.length - 3} more
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function EquityCurveChart({
  data,
  initialCapital,
  className,
  windowBoundaries = [],
  bars = [],
  trades = [],
}: EquityCurveChartProps) {
  if (data.length === 0) {
    return (
      <ChartEmptyState
        message="No equity data — run a backtest with closed trades."
        className={className}
      />
    )
  }

  const chartData = data.map((point) => ({
    ...point,
    label: formatChartDate(point.timestamp),
  }))

  const boundaryLabels = windowBoundaries.map((timestamp) => formatChartDate(timestamp))

  return (
    <div className={cn('border-carbon-600/40 rounded-lg border bg-transparent p-4', className)}>
      <h4 className="text-silver-200 mb-3 text-sm font-medium">Equity Curve</h4>
      <div className="w-full" style={{ height: EQUITY_CHART_HEIGHT_PX }}>
        <ResponsiveContainer width="100%" height={EQUITY_CHART_HEIGHT_PX}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.grid }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCurrency(v)}
              width={72}
            />
            <Tooltip content={<CustomEquityTooltip bars={bars} trades={trades} />} />
            <ReferenceLine
              y={initialCapital}
              stroke={CHART_COLORS.reference}
              strokeDasharray="4 4"
              label={{
                value: 'Initial',
                fill: CHART_COLORS.reference,
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
            {boundaryLabels.map((label) => (
              <ReferenceLine
                key={label}
                x={label}
                stroke={CHART_COLORS.reference}
                strokeDasharray="2 4"
                strokeOpacity={0.65}
              />
            ))}
            <Line
              type="monotone"
              dataKey="equity"
              stroke={CHART_COLORS.equity}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS.equity }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
