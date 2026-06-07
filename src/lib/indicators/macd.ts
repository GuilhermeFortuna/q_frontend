import type { OhlcvBar } from '@/types/api'

import { ema } from './ema'

export type MacdResult = {
  macd: (number | null)[]
  signal: (number | null)[]
  histogram: (number | null)[]
}

export function macd(
  values: OhlcvBar[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MacdResult {
  const fast = ema(values, fastPeriod)
  const slow = ema(values, slowPeriod)
  const macdLine: (number | null)[] = fast.map((f, i) =>
    f !== null && slow[i] !== null ? f - slow[i]! : null,
  )

  const signalLine: (number | null)[] = Array(macdLine.length).fill(null)
  const k = 2 / (signalPeriod + 1)
  let started = false
  let prevSignal = 0

  for (let i = 0; i < macdLine.length; i++) {
    const val = macdLine[i]
    if (val === null) continue
    if (!started) {
      const slice = macdLine.slice(0, i + 1).filter((v) => v !== null) as number[]
      if (slice.length < signalPeriod) continue
      const seed = slice.slice(-signalPeriod).reduce((a, b) => a + b, 0) / signalPeriod
      signalLine[i] = seed
      prevSignal = seed
      started = true
      continue
    }
    prevSignal = val * k + prevSignal * (1 - k)
    signalLine[i] = prevSignal
  }

  const histogram = macdLine.map((m, i) =>
    m !== null && signalLine[i] !== null ? m - signalLine[i]! : null,
  )

  return { macd: macdLine, signal: signalLine, histogram }
}
