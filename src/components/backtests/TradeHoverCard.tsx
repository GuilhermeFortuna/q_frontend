import {
  CHART_COLORS,
  formatCurrency,
  formatSignedCurrency,
  formatExitReason,
  formatExitResolution,
} from '@/components/backtests/chartUtils'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { formatHoldTime } from '@/lib/backtesting/backtestMetricFormatters'
import type { Trade } from '@/types/backtesting'

type TradeHoverCardProps = {
  trade: Trade
  x: number
  y: number
  containerWidth: number
  containerHeight: number
}

const CARD_WIDTH = 232
const CARD_ESTIMATED_HEIGHT = 280

function formatPositionSize(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function TradeHoverCard({
  trade,
  x,
  y,
  containerWidth,
  containerHeight,
}: TradeHoverCardProps) {
  const placeRight = x + CARD_WIDTH + 16 < containerWidth
  const left = clamp(placeRight ? x + 12 : x - CARD_WIDTH - 12, 8, containerWidth - CARD_WIDTH - 8)
  const top = clamp(y - CARD_ESTIMATED_HEIGHT / 2, 8, containerHeight - CARD_ESTIMATED_HEIGHT - 8)

  const isLong = trade.action === 'BUY'
  const pnlPositive = trade.pnl != null && trade.pnl > 0
  const pnlNegative = trade.pnl != null && trade.pnl < 0
  const pnlColor = pnlPositive
    ? CHART_COLORS.positive
    : pnlNegative
      ? CHART_COLORS.negative
      : CHART_COLORS.reference

  return (
    <div
      className="pointer-events-none absolute z-20 rounded-md border px-3 py-2.5 shadow-lg"
      style={{
        left,
        top,
        width: CARD_WIDTH,
        backgroundColor: CHART_COLORS.tooltipBg,
        borderColor: CHART_COLORS.tooltipBorder,
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-silver-100 text-xs font-semibold tracking-wide">{trade.symbol}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
            isLong ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
          }`}
        >
          {isLong ? 'Long' : 'Short'}
        </span>
      </div>

      <dl className="text-silver-300 space-y-1.5 text-[11px]">
        <div className="flex justify-between gap-3">
          <dt className="text-silver-500">Size</dt>
          <dd className="text-silver-100 font-mono tabular-nums">
            {formatPositionSize(trade.quantity)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-silver-500">Entry</dt>
          <dd className="text-right font-mono tabular-nums">
            <span className="text-silver-400">{formatDisplayDateTime(trade.entry_time)}</span>
            <span className="text-silver-100"> @ {formatCurrency(trade.entry_price)}</span>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-silver-500">Exit</dt>
          <dd className="text-right font-mono tabular-nums">
            {trade.exit_time && trade.exit_price != null ? (
              <>
                <span className="text-silver-400">{formatDisplayDateTime(trade.exit_time)}</span>
                <span className="text-silver-100"> @ {formatCurrency(trade.exit_price)}</span>
              </>
            ) : (
              <span className="text-silver-500">Open</span>
            )}
          </dd>
        </div>
        {trade.entry_reason && (
          <div className="flex justify-between gap-3">
            <dt className="text-silver-500">Entry Reason</dt>
            <dd className="text-silver-100 text-right font-medium">
              {formatExitReason(trade.entry_reason)}
            </dd>
          </div>
        )}
        {trade.exit_reason && (
          <div className="flex justify-between gap-3">
            <dt className="text-silver-500">Exit Reason</dt>
            <dd className="text-silver-100 text-right font-medium">
              {formatExitReason(trade.exit_reason)}
            </dd>
          </div>
        )}
        {formatExitResolution(trade.exit_resolution) && (
          <div className="flex justify-between gap-3">
            <dt className="text-silver-500">Exit Basis</dt>
            <dd className="text-brass-400 text-right">
              {formatExitResolution(trade.exit_resolution)}
            </dd>
          </div>
        )}
        {trade.commission > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-silver-500">Commission</dt>
            <dd className="text-silver-100 font-mono tabular-nums">
              {formatCurrency(trade.commission)}
            </dd>
          </div>
        )}
        <div className="border-carbon-700/80 flex justify-between gap-3 border-t pt-1.5">
          <dt className="text-silver-500 font-medium">PnL</dt>
          <dd className="font-mono text-sm font-semibold tabular-nums" style={{ color: pnlColor }}>
            {trade.pnl != null ? formatSignedCurrency(trade.pnl) : '—'}
          </dd>
        </div>
        {trade.mfe_points != null && (
          <div className="flex justify-between gap-3">
            <dt className="text-silver-500">MFE</dt>
            <dd className="text-silver-100 font-mono tabular-nums">
              {formatCurrency(trade.mfe_points * trade.quantity * trade.point_value)}
            </dd>
          </div>
        )}
        {trade.mae_points != null && (
          <div className="flex justify-between gap-3">
            <dt className="text-silver-500">MAE</dt>
            <dd className="text-silver-100 font-mono tabular-nums">
              {formatCurrency(trade.mae_points * trade.quantity * trade.point_value)}
            </dd>
          </div>
        )}
        {trade.mfe_capture != null && (
          <div className="flex justify-between gap-3">
            <dt className="text-silver-500">MFE capture</dt>
            <dd className="text-silver-100 font-mono tabular-nums">
              {(trade.mfe_capture * 100).toFixed(1)}%
            </dd>
          </div>
        )}
        {trade.mfe_time && (
          <div className="flex justify-between gap-3">
            <dt className="text-silver-500">Time to MFE</dt>
            <dd className="text-silver-100 font-mono tabular-nums">
              {formatHoldTime((Date.parse(trade.mfe_time) - Date.parse(trade.entry_time)) / 1000)}
            </dd>
          </div>
        )}
        {trade.post_exit_return_points != null && (
          <div className="flex justify-between gap-3">
            <dt className="text-silver-500">Post-exit</dt>
            <dd className="text-silver-100 font-mono tabular-nums">
              {formatSignedCurrency(trade.post_exit_return_points * trade.quantity * trade.point_value)}
            </dd>
          </div>
        )}
        {trade.excursion_resolution && trade.excursion_resolution !== 'tick' && (
          <div className="flex justify-between gap-3">
            <dt className="text-silver-500">Resolution</dt>
            <dd className="text-brass-300 font-mono capitalize">{trade.excursion_resolution}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
