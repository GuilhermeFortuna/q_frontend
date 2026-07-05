import { formatDisplayDate } from '@/lib/formatDate'
import { chartLegacyColors } from '@/lib/charts/chartTheme'

/** @deprecated Prefer chartTheme / rechartsTheme — legacy alias for data-prep helpers */
export const CHART_COLORS = chartLegacyColors

export function formatChartDate(timestamp: string) {
  return formatDisplayDate(timestamp)
}

export function formatCurrency(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatSignedCurrency(value: number) {
  const formatted = formatCurrency(Math.abs(value))
  if (value > 0) return `+${formatted}`
  if (value < 0) return `-${formatted}`
  return formatted
}

export function formatExitReason(reason: string): string {
  const r = reason.toUpperCase()
  if (r === 'STOP_LOSS' || r === 'SL' || r === 'FIXED_SL') return 'Fixed Stop Loss'
  if (r === 'ATR_SL') return 'ATR Stop Loss'
  if (r === 'TAKE_PROFIT' || r === 'TP' || r === 'FIXED_TP') return 'Fixed Take Profit'
  if (r === 'ATR_TP') return 'ATR Take Profit'
  if (r === 'TRAILING_STOP' || r === 'TRAILING') return 'Trailing Stop'
  if (r === 'CHANDELIER') return 'Chandelier Exit'
  if (r === 'BREAKEVEN') return 'Breakeven Stop'
  if (r === 'PSAR') return 'Parabolic SAR'
  if (r === 'PROFIT_TARGET_RATCHET') return 'Profit Target Ratchet'
  if (r === 'TIME_STOP') return 'Time Stop'
  if (r === 'DONCHIAN_STOP') return 'Donchian Stop'
  if (r === 'SIGNAL') return 'Signal Exit'
  if (r === 'END_OF_DAY') return 'End of Day'
  if (r === 'FORCE_CLOSE') return 'Force Close'

  return reason
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
