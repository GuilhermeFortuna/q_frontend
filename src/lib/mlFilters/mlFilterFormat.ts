import type { MlFilterNullableFloat } from '../../../contracts/api'

export type FormattedMetric = {
  text: string
  /** Server reason when the metric is undefined; never rendered as zero or infinity. */
  reason: string | null
}

export function formatNullableMetric(
  metric: MlFilterNullableFloat | null | undefined,
  digits = 2,
): FormattedMetric {
  if (metric && metric.value !== null && metric.value !== undefined) {
    return { text: metric.value.toFixed(digits), reason: null }
  }
  return {
    text: 'Unavailable',
    reason: metric?.unavailable_reason ?? 'The server did not report a value.',
  }
}

export function formatMoney(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatThreshold(threshold: number): string {
  return threshold.toFixed(2)
}

/** Counts arrive as an untyped record; keep numeric entries only. */
export function numericCounts(
  record: Record<string, unknown> | null | undefined,
): Array<[string, number]> {
  if (!record) return []
  return Object.entries(record).filter((entry): entry is [string, number] => {
    return typeof entry[1] === 'number'
  })
}

export function humanizeKey(key: string): string {
  const text = key.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
