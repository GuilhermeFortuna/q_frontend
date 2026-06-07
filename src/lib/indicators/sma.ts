import type { OhlcvBar } from '@/types/api'

export function sma(values: OhlcvBar[], period: number): (number | null)[] {
  const closes = values.map((b) => b.close)
  return closes.map((_, i) => {
    if (i < period - 1) return null
    let sum = 0
    for (let j = 0; j < period; j++) sum += closes[i - j]
    return sum / period
  })
}
