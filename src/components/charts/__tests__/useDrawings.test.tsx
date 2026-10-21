import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDrawings } from '@/components/charts/hooks/useDrawings'
import type { DrawingObject } from '@/components/charts/drawings/model'

const LINE = (id: string, price: number): DrawingObject => ({
  id,
  type: 'hline',
  anchors: [{ time: 0, price }],
  style: { color: '#c9a227', width: 1, lineStyle: 'solid' },
  locked: false,
  hidden: false,
  options: {},
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('useDrawings', () => {
  it('persists changes and restores them after a remount', () => {
    const first = renderHook(() => useDrawings('WDO'))
    act(() => first.result.current.commit([LINE('a', 100)]))
    first.unmount()

    const second = renderHook(() => useDrawings('WDO'))
    expect(second.result.current.drawings.map((drawing) => drawing.id)).toEqual(['a'])
    expect(second.result.current.notice).toBeNull()
  })

  it('keeps drawings in memory and shows a notice when a write fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    const { result } = renderHook(() => useDrawings('WDO'))

    act(() => result.current.commit([LINE('a', 100)]))

    expect(result.current.drawings).toHaveLength(1)
    expect(result.current.notice).toMatch(/could not be saved/)
  })

  it('keeps each symbol undo history and restores it when switching back', () => {
    const { result, rerender } = renderHook(({ symbol }) => useDrawings(symbol), {
      initialProps: { symbol: 'WDO' },
    })
    act(() => result.current.commit([LINE('a', 100)]))
    act(() => result.current.commit([LINE('a', 100), LINE('b', 101)]))

    rerender({ symbol: 'WIN' })
    expect(result.current.drawings).toEqual([])
    expect(result.current.canUndo).toBe(false)

    rerender({ symbol: 'WDO' })
    expect(result.current.drawings).toHaveLength(2)
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(result.current.drawings.map((drawing) => drawing.id)).toEqual(['a'])
    act(() => result.current.redo())
    expect(result.current.drawings).toHaveLength(2)
  })

  it('moves per-timeframe drawings from the legacy layout into the symbol entry', () => {
    localStorage.setItem(
      'quant:drawings:WDO:1H',
      JSON.stringify([{ id: 'legacy', type: 'horizontal', price: 101 }]),
    )
    const { result } = renderHook(() => useDrawings('WDO'))
    expect(result.current.drawings.map((drawing) => drawing.id)).toEqual(['legacy'])
    expect(localStorage.getItem('quant:drawings:WDO:1H')).toBeNull()
    expect(localStorage.getItem('quant:drawings:v2:WDO')).not.toBeNull()
  })
})
