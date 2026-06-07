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
})
