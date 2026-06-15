import type { OhlcvBar } from '@/types/api'

export type DonchianBands = {
  upper: (number | null)[]
  middle: (number | null)[]
  lower: (number | null)[]
}

export function donchianChannels(values: OhlcvBar[], period: number): DonchianBands {
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []
  const middle: (number | null)[] = []

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      upper.push(null)
      lower.push(null)
      middle.push(null)
      continue
    }
    let maxHigh = -Infinity
    let minLow = Infinity
    for (let j = 0; j < period; j++) {
      const b = values[i - j]
      if (b.high > maxHigh) maxHigh = b.high
      if (b.low < minLow) minLow = b.low
    }
    upper.push(maxHigh)
    lower.push(minLow)
    middle.push((maxHigh + minLow) / 2)
  }

  return { upper, middle, lower }
}
