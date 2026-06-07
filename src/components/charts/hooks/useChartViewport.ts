import { useCallback, useEffect, useState } from 'react'

import type { ChartViewport } from '@/components/charts/types/chart'
import {
  DEFAULT_VISIBLE_BARS,
  MAX_VISIBLE_BARS,
  MIN_VISIBLE_BARS,
} from '@/components/charts/types/chart'

export function useChartViewport(barCount: number) {
  const [viewport, setViewport] = useState<ChartViewport>({ startIndex: 0, endIndex: 0 })

  useEffect(() => {
    if (barCount === 0) {
      setViewport({ startIndex: 0, endIndex: 0 })
      return
    }
    const visible = Math.min(DEFAULT_VISIBLE_BARS, barCount)
    setViewport({
      startIndex: Math.max(0, barCount - visible),
      endIndex: barCount - 1,
    })
  }, [barCount])

  const resetViewport = useCallback(() => {
    if (barCount === 0) return
    const visible = Math.min(DEFAULT_VISIBLE_BARS, barCount)
    setViewport({
      startIndex: Math.max(0, barCount - visible),
      endIndex: barCount - 1,
    })
  }, [barCount])

  const fitAll = useCallback(() => {
    if (barCount === 0) return
    setViewport({ startIndex: 0, endIndex: barCount - 1 })
  }, [barCount])

  const zoomAt = useCallback(
    (cursorRatio: number, delta: number) => {
      setViewport((prev) => {
        const currentCount = prev.endIndex - prev.startIndex + 1
        const factor = delta > 0 ? 1.1 : 0.9
        let nextCount = Math.round(currentCount * factor)
        nextCount = Math.max(MIN_VISIBLE_BARS, Math.min(MAX_VISIBLE_BARS, barCount, nextCount))

        const anchor = prev.startIndex + currentCount * cursorRatio
        let start = Math.round(anchor - nextCount * cursorRatio)
        let end = start + nextCount - 1

        if (start < 0) {
          start = 0
          end = Math.min(barCount - 1, nextCount - 1)
        }
        if (end >= barCount) {
          end = barCount - 1
          start = Math.max(0, end - nextCount + 1)
        }

        return { startIndex: start, endIndex: end }
      })
    },
    [barCount],
  )

  const panBy = useCallback(
    (barDelta: number) => {
      setViewport((prev) => {
        const count = prev.endIndex - prev.startIndex + 1
        let start = prev.startIndex + barDelta
        let end = prev.endIndex + barDelta
        if (start < 0) {
          start = 0
          end = count - 1
        }
        if (end >= barCount) {
          end = barCount - 1
          start = end - count + 1
        }
        return { startIndex: start, endIndex: end }
      })
    },
    [barCount],
  )

  return { viewport, setViewport, resetViewport, fitAll, zoomAt, panBy }
}
