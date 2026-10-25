import { formatDisplayDate } from '@/lib/formatDate'
import { chartLegacyColors } from '@/lib/charts/chartTheme'
import type { Trade } from '@/types/backtesting'

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

/**
 * Labels for engine reason codes: the q_core exit-rule ids, the engine exit codes, and the
 * legacy aliases that older stored runs carry. Matching is exact, so a strategy's own reason
 * never picks up a label by accident.
 */
const ENGINE_REASON_LABELS = new Map<string, string>([
  ['fixed_sl', 'Fixed Stop Loss'],
  ['atr_sl', 'ATR Stop Loss'],
  ['fixed_tp', 'Fixed Take Profit'],
  ['atr_tp', 'ATR Take Profit'],
  ['trailing', 'Trailing Stop'],
  ['chandelier', 'Chandelier Exit'],
  ['breakeven', 'Breakeven Stop'],
  ['psar', 'Parabolic SAR'],
  ['profit_target_ratchet', 'Profit Target Ratchet'],
  ['time_stop', 'Time Stop'],
  ['donchian_stop', 'Donchian Stop'],
  ['SIGNAL', 'Signal Exit'],
  ['STOP_LOSS', 'Fixed Stop Loss'],
  ['TAKE_PROFIT', 'Fixed Take Profit'],
  ['END_OF_DAY', 'End of Day'],
  ['FORCE_CLOSE', 'Force Close'],
  ['SL', 'Fixed Stop Loss'],
  ['TP', 'Fixed Take Profit'],
  ['FIXED_SL', 'Fixed Stop Loss'],
  ['FIXED_TP', 'Fixed Take Profit'],
  ['ATR_SL', 'ATR Stop Loss'],
  ['ATR_TP', 'ATR Take Profit'],
  ['TRAILING_STOP', 'Trailing Stop'],
  ['CHANDELIER', 'Chandelier Exit'],
  ['BREAKEVEN', 'Breakeven Stop'],
  ['PSAR', 'Parabolic SAR'],
  ['PROFIT_TARGET_RATCHET', 'Profit Target Ratchet'],
  ['TIME_STOP', 'Time Stop'],
  ['DONCHIAN_STOP', 'Donchian Stop'],
])

/** Label for an entry or exit reason: engine codes get their label, any other string is shown verbatim. */
export function formatExitReason(reason: string): string {
  return ENGINE_REASON_LABELS.get(reason) ?? reason
}

/** Label for exits that were decided on substituted prices; null for real ticks and closed bars. */
export function formatExitResolution(resolution: Trade['exit_resolution']): string | null {
  if (resolution === 'minute') return 'Approximate: one-minute bar'
  if (resolution === 'candle') return 'Approximate: candle prices'
  return null
}
