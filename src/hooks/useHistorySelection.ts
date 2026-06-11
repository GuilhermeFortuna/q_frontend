import { useCallback, useState } from 'react'

type UseHistorySelectionOptions = {
  maxSelection?: number
}

export function useHistorySelection(options: UseHistorySelectionOptions = {}) {
  const { maxSelection } = options
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [selectionBlocked, setSelectionBlocked] = useState(false)

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true)
    setSelectedIds(new Set())
    setSelectionBlocked(false)
  }, [])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setSelectionBlocked(false)
  }, [])

  const toggle = useCallback(
    (id: string) => {
      setSelectedIds((current) => {
        const next = new Set(current)
        if (next.has(id)) {
          next.delete(id)
          setSelectionBlocked(false)
          return next
        }
        if (maxSelection != null && next.size >= maxSelection) {
          setSelectionBlocked(true)
          return current
        }
        next.add(id)
        setSelectionBlocked(false)
        return next
      })
    },
    [maxSelection],
  )

  const selectAll = useCallback(
    (ids: string[]) => {
      const limited = maxSelection != null ? ids.slice(0, maxSelection) : ids
      setSelectedIds(new Set(limited))
      setSelectionBlocked(maxSelection != null && ids.length > maxSelection)
    },
    [maxSelection],
  )

  const clear = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  return {
    selectionMode,
    selectedIds,
    selectedCount: selectedIds.size,
    selectionAtMax: maxSelection != null ? selectedIds.size >= maxSelection : false,
    selectionBlocked,
    maxSelection,
    enterSelectionMode,
    exitSelectionMode,
    toggle,
    selectAll,
    clear,
    isSelected,
  }
}

export type HistorySelection = ReturnType<typeof useHistorySelection>
