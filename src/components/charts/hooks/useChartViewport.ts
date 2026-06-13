import { useCallback, useEffect, useState } from 'react'

import type { ChartViewport } from '@/components/charts/types/chart'
import {
  DEFAULT_VISIBLE_BARS,
  MIN_VISIBLE_BARS,
  TIME_AXIS_STRETCH_SENSITIVITY,
} from '@/components/charts/types/chart'

export function useChartViewport(barCount: number, resetKey = '') {
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
  }, [resetKey])

  useEffect(() => {
    if (barCount === 0) return
    setViewport((prev) => {
      if (prev.startIndex === 0 && prev.endIndex === 0) {
        const visible = Math.min(DEFAULT_VISIBLE_BARS, barCount)
        return {
          startIndex: Math.max(0, barCount - visible),
          endIndex: barCount - 1,
        }
      }
      return prev
    })
  }, [barCount])

  const shiftViewport = useCallback((delta: number) => {
    if (delta <= 0) return
    setViewport((prev) => ({
      startIndex: prev.startIndex + delta,
      endIndex: prev.endIndex + delta,
    }))
  }, [])

  const resetViewport = useCallback(() => {
    if (barCount === 0) return
    const visible = Math.min(DEFAULT_VISIBLE_BARS, barCount)
    setViewport({
      startIndex: Math.max(0, barCount - visible),
      endIndex: barCount - 1,
    })
  }, [barCount])

  const scrollToEnd = useCallback(() => {
    if (barCount === 0) return
    setViewport((prev) => {
      const count = prev.endIndex - prev.startIndex + 1
      const end = barCount - 1
      const start = Math.max(0, end - count + 1)
      return { startIndex: start, endIndex: end }
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
        nextCount = Math.max(MIN_VISIBLE_BARS, Math.min(barCount, nextCount))

        const anchor = prev.startIndex + currentCount * cursorRatio
        let start = Math.round(anchor - nextCount * cursorRatio)
        let end = start + nextCount - 1

        if (start < 0) {
          start = 0
          end = Math.min(barCount - 1, nextCount - 1)
        }
        if (end > barCount - 1) {
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
        const maxEndIndex = barCount - 1 + count
        if (end > maxEndIndex) {
          end = maxEndIndex
          start = end - count + 1
        }
        return { startIndex: start, endIndex: end }
      })
    },
    [barCount],
  )

  const stretchXByPixels = useCallback(
    (deltaX: number, innerWidth: number) => {
      if (barCount === 0 || innerWidth <= 0 || deltaX === 0) return

      setViewport((prev) => {
        const currentCount = prev.endIndex - prev.startIndex + 1
        const barsPerPixel = (currentCount / innerWidth) * TIME_AXIS_STRETCH_SENSITIVITY
        const barChange = Math.round(deltaX * barsPerPixel)
        if (barChange === 0) return prev

        let nextCount = currentCount + barChange
        nextCount = Math.max(MIN_VISIBLE_BARS, Math.min(barCount, nextCount))

        const anchorRatio = 0.5
        const anchor = prev.startIndex + currentCount * anchorRatio
        let start = Math.round(anchor - nextCount * anchorRatio)
        let end = start + nextCount - 1

        if (start < 0) {
          start = 0
          end = Math.min(barCount - 1, nextCount - 1)
        }
        if (end > barCount - 1) {
          end = barCount - 1
          start = Math.max(0, end - nextCount + 1)
        }

        return { startIndex: start, endIndex: end }
      })
    },
    [barCount],
  )

  return {
    viewport,
    setViewport,
    resetViewport,
    scrollToEnd,
    fitAll,
    zoomAt,
    panBy,
    stretchXByPixels,
    shiftViewport,
  }
}
