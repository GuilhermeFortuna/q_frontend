import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useChartViewport } from '@/components/charts/hooks/useChartViewport'

describe('useChartViewport', () => {
  it('resets viewport when resetKey changes', () => {
    const { result, rerender } = renderHook(
      ({ barCount, resetKey }) => useChartViewport(barCount, resetKey),
      { initialProps: { barCount: 100, resetKey: 'PETR4:1D' } },
    )

    expect(result.current.viewport.endIndex).toBe(99)

    rerender({ barCount: 200, resetKey: 'VALE3:1D' })

    expect(result.current.viewport.endIndex).toBe(199)
  })

  it('shiftViewport preserves visible window when bars are prepended', () => {
    const { result, rerender } = renderHook(
      ({ barCount, resetKey }) => useChartViewport(barCount, resetKey),
      { initialProps: { barCount: 100, resetKey: 'PETR4:1H' } },
    )

    const before = { ...result.current.viewport }

    act(() => {
      result.current.shiftViewport(20)
    })

    expect(result.current.viewport.startIndex).toBe(before.startIndex + 20)
    expect(result.current.viewport.endIndex).toBe(before.endIndex + 20)

    rerender({ barCount: 120, resetKey: 'PETR4:1H' })

    expect(result.current.viewport.startIndex).toBe(before.startIndex + 20)
    expect(result.current.viewport.endIndex).toBe(before.endIndex + 20)
  })

  it('scrollToEnd keeps zoom and aligns the viewport to the latest bar', () => {
    const { result } = renderHook(() => useChartViewport(200, 'PETR4:1H'))

    act(() => {
      result.current.panBy(-80)
    })

    const visibleCount = result.current.viewport.endIndex - result.current.viewport.startIndex + 1
    expect(result.current.viewport.endIndex).toBeLessThan(199)

    act(() => {
      result.current.scrollToEnd()
    })

    expect(result.current.viewport.endIndex).toBe(199)
    expect(result.current.viewport.endIndex - result.current.viewport.startIndex + 1).toBe(
      visibleCount,
    )
  })

  it('zoomAt can zoom out to the full bar range', () => {
    const barCount = 800
    const { result } = renderHook(() => useChartViewport(barCount, 'PETR4:1D'))

    act(() => {
      for (let i = 0; i < 30; i += 1) {
        result.current.zoomAt(0.5, 100)
      }
    })

    expect(result.current.viewport.startIndex).toBe(0)
    expect(result.current.viewport.endIndex).toBe(barCount - 1)
  })

  it('panBy allows right padding past the last bar', () => {
    const barCount = 120
    const { result } = renderHook(() => useChartViewport(barCount, 'PETR4:1H'))

    const count = result.current.viewport.endIndex - result.current.viewport.startIndex + 1

    act(() => {
      result.current.panBy(20)
    })

    expect(result.current.viewport.endIndex).toBeGreaterThan(barCount - 1)
    expect(result.current.viewport.endIndex).toBeLessThanOrEqual(barCount - 1 + count)
  })

  it('stretchXByPixels expands and compresses the visible bar window', () => {
    const { result } = renderHook(() => useChartViewport(200, 'PETR4:1H'))
    const initialCount = result.current.viewport.endIndex - result.current.viewport.startIndex + 1

    act(() => {
      result.current.stretchXByPixels(120, 600)
    })

    const expandedCount = result.current.viewport.endIndex - result.current.viewport.startIndex + 1
    expect(expandedCount).toBeGreaterThan(initialCount)

    act(() => {
      result.current.stretchXByPixels(-240, 600)
    })

    const compressedCount =
      result.current.viewport.endIndex - result.current.viewport.startIndex + 1
    expect(compressedCount).toBeLessThan(expandedCount)
  })
})
