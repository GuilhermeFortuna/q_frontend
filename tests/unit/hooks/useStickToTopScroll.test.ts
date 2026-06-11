import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useStickToTopScroll } from '@/hooks/useStickToTopScroll'

describe('useStickToTopScroll', () => {
  it('accumulates pending rows when the user is not at the top', () => {
    const scrollTo = vi.fn()
    const element = { scrollTop: 120, scrollTo } as unknown as HTMLDivElement

    const { result, rerender } = renderHook(({ count }) => useStickToTopScroll(count), {
      initialProps: { count: 5 },
    })

    act(() => {
      result.current.scrollRef.current = element
      result.current.handleScroll()
    })

    rerender({ count: 8 })

    expect(result.current.pendingNew).toBe(3)
  })

  it('clears pending rows when jumping back to the top', () => {
    const scrollTo = vi.fn()
    const element = {
      scrollTop: 120,
      scrollTo,
    } as unknown as HTMLDivElement

    const { result, rerender } = renderHook(({ count }) => useStickToTopScroll(count), {
      initialProps: { count: 5 },
    })

    act(() => {
      result.current.scrollRef.current = element
      result.current.handleScroll()
    })

    rerender({ count: 7 })
    expect(result.current.pendingNew).toBe(2)

    act(() => {
      result.current.jumpToTop()
    })

    expect(result.current.pendingNew).toBe(0)
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
  })
})
