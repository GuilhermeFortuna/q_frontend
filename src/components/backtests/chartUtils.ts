import { formatDisplayDate } from '@/lib/formatDate'

const CHART_COLORS = {
  grid: '#2e333b',
  axis: '#6f7785',
  equity: '#c4a574',
  drawdown: '#e05a5a',
  positive: '#4ade80',
  negative: '#f87171',
  reference: '#9aa1ac',
  tooltipBg: '#181b1f',
  tooltipBorder: '#2e333b',
}

export { CHART_COLORS }

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
