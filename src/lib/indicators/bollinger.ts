import type { OhlcvBar } from '@/types/api'

import { sma } from './sma'

export type BollingerBands = {
  upper: (number | null)[]
  middle: (number | null)[]
  lower: (number | null)[]
}

export function bollingerBands(values: OhlcvBar[], period: number, stdDev = 2): BollingerBands {
  const middle = sma(values, period)
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []
  const closes = values.map((b) => b.close)

  for (let i = 0; i < values.length; i++) {
    const mid = middle[i]
    if (mid === null || i < period - 1) {
      upper.push(null)
      lower.push(null)
      continue
    }
    let variance = 0
    for (let j = 0; j < period; j++) {
      const diff = closes[i - j] - mid
      variance += diff * diff
    }
    const stdev = Math.sqrt(variance / period)
    upper.push(mid + stdDev * stdev)
    lower.push(mid - stdDev * stdev)
  }

  return { upper, middle, lower }
}
