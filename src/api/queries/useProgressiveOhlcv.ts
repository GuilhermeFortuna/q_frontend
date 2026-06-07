import { endOfDay } from 'date-fns'
import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchOhlcv, fetchOhlcvAvailableRange } from '@/api/queries/market-data'
import type { CandlestickChartHandle } from '@/components/charts/CandlestickChart'
import type { ChartViewport } from '@/components/charts/types/chart'
import {
  computeBackfillWindow,
  getBackgroundPrefetchChunks,
  getLoadingStrategy,
  INITIAL_BAR_COUNT,
  isHistoryComplete,
  mergeOhlcvBars,
  PAN_TRIGGER_THRESHOLD,
} from '@/lib/market/ohlcvLoading'
import type { OhlcvAvailableRange, OhlcvBar } from '@/types/api'

export function useProgressiveOhlcv(symbol: string, timeframe: string) {
  const [bars, setBars] = useState<OhlcvBar[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isProbingRange, setIsProbingRange] = useState(false)
  const [isBackfilling, setIsBackfilling] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [availableRange, setAvailableRange] = useState<OhlcvAvailableRange | null>(null)

  const generationRef = useRef(0)
  const backfillingRef = useRef(false)
  const barsRef = useRef<OhlcvBar[]>([])
  const availableRangeRef = useRef<OhlcvAvailableRange | null>(null)
  const isCompleteRef = useRef(false)
  const chartRef = useRef<CandlestickChartHandle>(null)

  const fetchNextBackfillChunk = useCallback(
    async (gen: number): Promise<boolean> => {
      if (backfillingRef.current || isCompleteRef.current) return false

      const oldest = barsRef.current[0]
      const range = availableRangeRef.current
      if (!oldest || !range) return false

      const window = computeBackfillWindow(oldest.timestamp, range.start, timeframe)
      if (!window) {
        setIsComplete(true)
        isCompleteRef.current = true
        return false
      }

      backfillingRef.current = true
      setIsBackfilling(true)

      try {
        const chunk = await fetchOhlcv(symbol, timeframe, {
          start: window.start,
          end: window.end,
        })
        if (generationRef.current !== gen) return false

        const merged = mergeOhlcvBars(barsRef.current, chunk)
        const delta = merged.length - barsRef.current.length
        barsRef.current = merged
        setBars(merged)

        if (delta > 0) {
          chartRef.current?.shiftViewport(delta)
        }

        if (isHistoryComplete(merged, range.start)) {
          setIsComplete(true)
          isCompleteRef.current = true
        }

        return chunk.length > 0
      } finally {
        backfillingRef.current = false
        setIsBackfilling(false)
      }
    },
    [symbol, timeframe],
  )

  useEffect(() => {
    const gen = ++generationRef.current

    setBars([])
    barsRef.current = []
    setAvailableRange(null)
    availableRangeRef.current = null
    setIsComplete(false)
    isCompleteRef.current = false
    setError(null)
    setIsInitialLoading(true)
    setIsProbingRange(false)
    setIsBackfilling(false)
    backfillingRef.current = false

    async function load() {
      try {
        if (getLoadingStrategy(timeframe) === 'full') {
          setIsProbingRange(true)
          const range = await fetchOhlcvAvailableRange(symbol, timeframe)
          if (generationRef.current !== gen) return

          setAvailableRange(range)
          availableRangeRef.current = range
          setIsProbingRange(false)

          const data = await fetchOhlcv(symbol, timeframe, {
            start: range.start,
            end: endOfDay(new Date()).toISOString(),
          })
          if (generationRef.current !== gen) return

          barsRef.current = data
          setBars(data)
          setIsComplete(true)
          isCompleteRef.current = true
          return
        }

        const initial = await fetchOhlcv(symbol, timeframe, { count: INITIAL_BAR_COUNT })
        if (generationRef.current !== gen) return

        barsRef.current = initial
        setBars(initial)
        setIsInitialLoading(false)

        setIsProbingRange(true)
        const range = await fetchOhlcvAvailableRange(symbol, timeframe)
        if (generationRef.current !== gen) return

        setAvailableRange(range)
        availableRangeRef.current = range
        setIsProbingRange(false)

        if (isHistoryComplete(initial, range.start)) {
          setIsComplete(true)
          isCompleteRef.current = true
          return
        }

        const prefetchCount = getBackgroundPrefetchChunks(timeframe)
        for (let i = 0; i < prefetchCount; i += 1) {
          const gotMore = await fetchNextBackfillChunk(gen)
          if (!gotMore || generationRef.current !== gen) break
        }
      } catch (err) {
        if (generationRef.current === gen) {
          setError(err instanceof Error ? err : new Error('Failed to load OHLCV data'))
        }
      } finally {
        if (generationRef.current === gen) {
          setIsInitialLoading(false)
          setIsProbingRange(false)
        }
      }
    }

    void load()
  }, [symbol, timeframe, fetchNextBackfillChunk])

  const handleViewportChange = useCallback(
    (viewport: ChartViewport) => {
      if (getLoadingStrategy(timeframe) === 'full') return
      if (viewport.startIndex >= PAN_TRIGGER_THRESHOLD) return
      if (isCompleteRef.current || backfillingRef.current) return
      void fetchNextBackfillChunk(generationRef.current)
    },
    [fetchNextBackfillChunk, timeframe],
  )

  return {
    bars,
    isInitialLoading,
    isProbingRange,
    isBackfilling,
    isComplete,
    error,
    availableRange,
    handleViewportChange,
    chartRef,
  }
}
