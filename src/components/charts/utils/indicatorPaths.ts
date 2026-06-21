import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { OhlcvBar } from '@/types/api'

export function linePath(
  values: (number | null)[],
  allBars: OhlcvBar[],
  visibleTimestamps: Set<string>,
  xScale: BandScale,
  yScale: LinearScale,
): string {
  const bw = xScale.bandwidth()
  const parts: string[] = []
  let started = false

  for (let i = 0; i < allBars.length; i++) {
    const ts = allBars[i].timestamp
    if (!visibleTimestamps.has(ts)) continue
    const val = values[i]
    if (val === null) {
      started = false
      continue
    }
    const x = (xScale(ts) ?? 0) + bw / 2
    const y = yScale(val)
    parts.push(`${started ? 'L' : 'M'} ${x} ${y}`)
    started = true
  }

  return parts.join(' ')
}

export function bandsAreaPath(
  upper: (number | null)[],
  lower: (number | null)[],
  allBars: OhlcvBar[],
  visibleTimestamps: Set<string>,
  xScale: BandScale,
  yScale: LinearScale,
): string {
  const bw = xScale.bandwidth()
  const upperPoints: string[] = []
  const lowerPoints: string[] = []

  for (let i = 0; i < allBars.length; i++) {
    const ts = allBars[i].timestamp
    if (!visibleTimestamps.has(ts)) continue
    const uVal = upper[i]
    const lVal = lower[i]
    if (uVal === null || lVal === null) continue

    const x = (xScale(ts) ?? 0) + bw / 2
    const yUpper = yScale(uVal)
    const yLower = yScale(lVal)

    upperPoints.push(`${x},${yUpper}`)
    lowerPoints.unshift(`${x},${yLower}`)
  }

  if (upperPoints.length === 0) return ''
  return `M ${upperPoints[0].replace(',', ' ')} ${upperPoints
    .slice(1)
    .map((p) => `L ${p.replace(',', ' ')}`)
    .join(' ')} L ${lowerPoints[0].replace(',', ' ')} ${lowerPoints
    .slice(1)
    .map((p) => `L ${p.replace(',', ' ')}`)
    .join(' ')} Z`
}

export function visibleTimestampSet(timestamps: string[]): Set<string> {
  return new Set(timestamps)
}
