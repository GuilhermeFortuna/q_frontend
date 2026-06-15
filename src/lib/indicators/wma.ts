export function wmaNullable(closes: (number | null)[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null
    let sum = 0
    let weightSum = 0
    for (let j = 0; j < period; j++) {
      const val = closes[i - j]
      if (val === null) return null
      const weight = period - j
      sum += val * weight
      weightSum += weight
    }
    return sum / weightSum
  })
}

import type { OhlcvBar } from '@/types/api'

export function wma(values: OhlcvBar[], period: number): (number | null)[] {
  const closes = values.map((b) => b.close)
  return wmaNullable(closes, period)
}
