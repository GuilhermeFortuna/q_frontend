import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'

import { usePriceFlash } from '@/hooks/usePriceFlash'

describe('usePriceFlash', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sets direction when the value changes', () => {
    const { result, rerender } = renderHook(({ value }) => usePriceFlash(value), {
      initialProps: { value: 10 },
    })

    expect(result.current.direction).toBeNull()

    rerender({ value: 11 })
    expect(result.current.direction).toBe('up')
    expect(result.current.flashClass).toBe('price-flash-up')

    rerender({ value: 10.5 })
    expect(result.current.direction).toBe('down')
    expect(result.current.flashClass).toBe('price-flash-down')
  })

  it('does not flash when the value stays the same', () => {
    const { result, rerender } = renderHook(({ value }) => usePriceFlash(value), {
      initialProps: { value: 42 },
    })

    rerender({ value: 42 })
    expect(result.current.direction).toBeNull()
    expect(result.current.flashClass).toBe('')
  })

  it('clears direction after the flash duration', () => {
    vi.useFakeTimers()

    const { result, rerender } = renderHook(({ value }) => usePriceFlash(value), {
      initialProps: { value: 1 },
    })

    rerender({ value: 2 })
    expect(result.current.direction).toBe('up')

    act(() => {
      vi.advanceTimersByTime(600)
    })

    expect(result.current.direction).toBeNull()
  })
})
