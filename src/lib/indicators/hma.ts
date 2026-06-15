import type { OhlcvBar } from '@/types/api'
import { wmaNullable } from './wma'

export function hma(values: OhlcvBar[], period: number): (number | null)[] {
  const closes = values.map((b) => b.close)
  const halfPeriod = Math.floor(period / 2)
  const sqrtPeriod = Math.floor(Math.sqrt(period))

  const wmaHalf = wmaNullable(closes, halfPeriod)
  const wmaFull = wmaNullable(closes, period)

  const diffs = wmaHalf.map((h, i) =>
    h !== null && wmaFull[i] !== null ? 2 * h - wmaFull[i]! : null,
  )

  return wmaNullable(diffs, sqrtPeriod)
}
