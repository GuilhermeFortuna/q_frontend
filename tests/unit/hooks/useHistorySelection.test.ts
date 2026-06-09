import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useHistorySelection } from '@/hooks/useHistorySelection'

describe('useHistorySelection', () => {
  it('toggles ids and tracks selection mode', () => {
    const { result } = renderHook(() => useHistorySelection())

    act(() => {
      result.current.enterSelectionMode()
    })
    expect(result.current.selectionMode).toBe(true)

    act(() => {
      result.current.toggle('a')
      result.current.toggle('b')
    })
    expect(result.current.selectedCount).toBe(2)
    expect(result.current.isSelected('a')).toBe(true)

    act(() => {
      result.current.toggle('a')
    })
    expect(result.current.selectedCount).toBe(1)

    act(() => {
      result.current.selectAll(['x', 'y', 'z'])
    })
    expect(result.current.selectedCount).toBe(3)

    act(() => {
      result.current.exitSelectionMode()
    })
    expect(result.current.selectionMode).toBe(false)
    expect(result.current.selectedCount).toBe(0)
  })
})
