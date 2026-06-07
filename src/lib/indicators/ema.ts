import type { OhlcvBar } from '@/types/api'

export function ema(values: OhlcvBar[], period: number): (number | null)[] {
  const closes = values.map((b) => b.close)
  const k = 2 / (period + 1)
  const result: (number | null)[] = []

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null)
      continue
    }
    if (i === period - 1) {
      let sum = 0
      for (let j = 0; j < period; j++) sum += closes[j]
      result.push(sum / period)
      continue
    }
    const prev = result[i - 1]!
    result.push(closes[i] * k + prev * (1 - k))
  }

  return result
}
