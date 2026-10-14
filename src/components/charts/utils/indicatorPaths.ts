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
    if (val === null || !Number.isFinite(val)) {
      started = false
      continue
    }
    const x = (xScale(ts) ?? 0) + bw / 2
    const y = yScale(val)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      started = false
      continue
    }
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

export function stepPath(
  values: (number | null)[],
  bars: OhlcvBar[],
  visible: Set<string>,
  xScale: BandScale,
  yScale: LinearScale,
) {
  let d = ''
  let previous: { x: number; y: number } | null = null
  for (let i = 0; i < bars.length; i += 1) {
    const value = visible.has(bars[i].timestamp) ? values[i] : null
    if (value == null) {
      previous = null
      continue
    }
    const x = (xScale(bars[i].timestamp) ?? 0) + xScale.bandwidth() / 2
    const y = yScale(value)
    d += previous ? ` H ${x} V ${y}` : ` M ${x} ${y}`
    previous = { x, y }
  }
  return d
}

export function pairedFillPath(
  a: (number | null)[],
  b: (number | null)[] | undefined,
  aKind: 'line' | 'step',
  bKind: 'line' | 'step',
  bars: OhlcvBar[],
  visible: Set<string>,
  xScale: BandScale,
  yScale: LinearScale,
) {
  if (!b) return ''
  let d = ''
  let segment: Array<{ x: number; a: number; b: number }> = []
  const boundary = (side: 'a' | 'b', kind: 'line' | 'step') => {
    const points: Array<{ x: number; y: number }> = []
    segment.forEach((point, i) => {
      const y = yScale(point[side])
      if (i > 0 && kind === 'step') points.push({ x: point.x, y: yScale(segment[i - 1][side]) })
      points.push({ x: point.x, y })
    })
    return points
  }
  const flush = () => {
    if (segment.length > 1) {
      const top = boundary('a', aKind)
      const bottom = boundary('b', bKind).reverse()
      d += ` M ${top[0].x} ${top[0].y} ${top
        .slice(1)
        .map((p) => `L ${p.x} ${p.y}`)
        .join(' ')} ${bottom.map((p) => `L ${p.x} ${p.y}`).join(' ')} Z`
    }
    segment = []
  }
  for (let i = 0; i < bars.length; i += 1) {
    const x = (xScale(bars[i].timestamp) ?? 0) + xScale.bandwidth() / 2
    if (!visible.has(bars[i].timestamp) || a[i] == null || b[i] == null) {
      flush()
      continue
    }
    segment.push({ x, a: a[i]!, b: b[i]! })
  }
  flush()
  return d.trim()
}
