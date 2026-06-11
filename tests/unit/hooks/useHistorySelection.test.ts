import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useHistorySelection } from '@/hooks/useHistorySelection'

describe('useHistorySelection', () => {
  it('blocks selection beyond maxSelection', () => {
    const { result } = renderHook(() => useHistorySelection({ maxSelection: 5 }))

    act(() => {
      result.current.enterSelectionMode()
    })

    act(() => {
      for (let index = 0; index < 5; index += 1) {
        result.current.toggle(`run-${index}`)
      }
    })

    expect(result.current.selectedCount).toBe(5)
    expect(result.current.selectionAtMax).toBe(true)

    act(() => {
      result.current.toggle('run-6')
    })

    expect(result.current.selectedCount).toBe(5)
    expect(result.current.selectionBlocked).toBe(true)
  })
})
