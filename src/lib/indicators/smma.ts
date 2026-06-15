import type { OhlcvBar } from '@/types/api'

export function smma(values: OhlcvBar[], period: number): (number | null)[] {
  const closes = values.map((b) => b.close)
  const result: (number | null)[] = []

  let prevSmma: number | null = null

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null)
      continue
    }
    if (i === period - 1) {
      let sum = 0
      for (let j = 0; j < period; j++) sum += closes[j]
      const val = sum / period
      result.push(val)
      prevSmma = val
      continue
    }
    if (prevSmma !== null) {
      const val: number = (prevSmma * (period - 1) + closes[i]) / period
      result.push(val)
      prevSmma = val
    } else {
      result.push(null)
    }
  }
  return result
}
