import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  browserDrawingStorage,
  loadSymbolDrawings,
  saveSymbolDrawings,
  type DrawingStorage,
} from '@/components/charts/drawings/storage'
import {
  commitDrawings,
  redoDrawings,
  startSession,
  undoDrawings,
  type DrawingSession,
} from '@/components/charts/drawings/session'
import type { DrawingObject } from '@/components/charts/drawings/model'

const SAVE_FAILED_NOTICE =
  'Drawings could not be saved in this browser; they stay until the page reloads.'

type SessionsBySymbol = Record<string, DrawingSession>

/**
 * Drawings for one symbol, persisted to local storage and shared by every timeframe of that
 * symbol. Changes go through `commit`, which records undo history; the write itself happens
 * after render, so a failed write keeps the drawings in memory and shows a notice.
 */
export function useDrawings(symbol: string) {
  const [sessions, setSessions] = useState<SessionsBySymbol>({})
  const storage = useMemo<DrawingStorage | null>(() => browserDrawingStorage(), [])

  const stored = sessions[symbol]
  const session = useMemo<DrawingSession>(() => {
    if (stored) return stored
    const loaded = loadSymbolDrawings(storage, symbol)
    return startSession(loaded.drawings, loaded.notices)
  }, [stored, storage, symbol])

  useEffect(() => {
    if (!session.dirty) return
    const result = saveSymbolDrawings(storage, symbol, session.drawings)
    setSessions((prev) => {
      const current = prev[symbol]
      // A newer change superseded this write; its own effect run will save it.
      if (!current || current.drawings !== session.drawings) return prev
      return {
        ...prev,
        [symbol]: {
          ...current,
          dirty: false,
          notices: result.ok ? [] : [SAVE_FAILED_NOTICE],
        },
      }
    })
  }, [session, storage, symbol])

  const commit = useCallback(
    (next: DrawingObject[]) => {
      setSessions((prev) => ({
        ...prev,
        [symbol]: commitDrawings(prev[symbol] ?? session, next),
      }))
    },
    [session, symbol],
  )

  const undo = useCallback(() => {
    setSessions((prev) => ({ ...prev, [symbol]: undoDrawings(prev[symbol] ?? session) }))
  }, [session, symbol])

  const redo = useCallback(() => {
    setSessions((prev) => ({ ...prev, [symbol]: redoDrawings(prev[symbol] ?? session) }))
  }, [session, symbol])

  return {
    drawings: session.drawings,
    notice: session.notices.length > 0 ? session.notices.join(' ') : null,
    canUndo: session.past.length > 0,
    canRedo: session.future.length > 0,
    commit,
    undo,
    redo,
  }
}
