import { useCallback, useEffect, useState } from 'react'

import type { DrawingObject } from '@/components/charts/types/chart'

function storageKey(symbol: string, timeframe: string) {
  return `quant:drawings:${symbol}:${timeframe}`
}

export function useDrawings(symbol: string, timeframe: string) {
  const [drawings, setDrawings] = useState<DrawingObject[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(symbol, timeframe))
      setDrawings(raw ? (JSON.parse(raw) as DrawingObject[]) : [])
    } catch {
      setDrawings([])
    }
  }, [symbol, timeframe])

  const persist = useCallback(
    (next: DrawingObject[]) => {
      setDrawings(next)
      localStorage.setItem(storageKey(symbol, timeframe), JSON.stringify(next))
    },
    [symbol, timeframe],
  )

  const addDrawing = useCallback(
    (drawing: DrawingObject) => {
      persist([...drawings, drawing])
    },
    [drawings, persist],
  )

  const clearDrawings = useCallback(() => {
    persist([])
  }, [persist])

  const removeDrawing = useCallback(
    (id: string) => {
      persist(drawings.filter((d) => d.id !== id))
    },
    [drawings, persist],
  )

  return { drawings, setDrawings: persist, addDrawing, clearDrawings, removeDrawing }
}

export function newDrawingId() {
  return `draw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
