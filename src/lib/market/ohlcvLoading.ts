import { subDays } from 'date-fns'

import { toApiTimeframe } from '@/lib/market/timeframes'
import type { OhlcvBar } from '@/types/api'

export const INITIAL_BAR_COUNT = 500
export const PAN_TRIGGER_THRESHOLD = 30

const BACKGROUND_PREFETCH_BY_TF: Record<string, number> = {
  M1: 1,
  M5: 2,
  M15: 2,
  M30: 2,
  H1: 2,
  H4: 2,
}

const BACKFILL_WINDOW_DAYS: Record<string, number> = {
  M1: 7,
  M5: 30,
  M15: 30,
  M30: 30,
  H1: 180,
  H4: 180,
}

export type LoadingStrategy = 'full' | 'progressive'

export function getLoadingStrategy(timeframe: string): LoadingStrategy {
  return toApiTimeframe(timeframe) === 'D1' ? 'full' : 'progressive'
}

export function getBackgroundPrefetchChunks(timeframe: string): number {
  const code = toApiTimeframe(timeframe)
  return BACKGROUND_PREFETCH_BY_TF[code] ?? 2
}

export function getBackfillWindowDays(timeframe: string): number {
  const code = toApiTimeframe(timeframe)
  return BACKFILL_WINDOW_DAYS[code] ?? 30
}

export function mergeOhlcvBars(existing: OhlcvBar[], older: OhlcvBar[]): OhlcvBar[] {
  if (older.length === 0) return existing
  if (existing.length === 0) return [...older]

  const byTimestamp = new Map<string, OhlcvBar>()
  for (const bar of older) {
    byTimestamp.set(bar.timestamp, bar)
  }
  for (const bar of existing) {
    byTimestamp.set(bar.timestamp, bar)
  }

  return Array.from(byTimestamp.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
}

export type BackfillWindow = {
  start: string
  end: string
}

export function computeBackfillWindow(
  oldestLoadedTimestamp: string,
  availableStart: string,
  timeframe: string,
): BackfillWindow | null {
  const oldest = new Date(oldestLoadedTimestamp)
  const earliest = new Date(availableStart)

  if (oldest.getTime() <= earliest.getTime() + 1000) {
    return null
  }

  const windowDays = getBackfillWindowDays(timeframe)
  const chunkEnd = new Date(oldest.getTime() - 1000)
  let chunkStart = subDays(chunkEnd, windowDays)

  if (chunkStart < earliest) {
    chunkStart = earliest
  }

  if (chunkStart >= chunkEnd) {
    return null
  }

  return {
    start: chunkStart.toISOString(),
    end: chunkEnd.toISOString(),
  }
}

export function isHistoryComplete(bars: OhlcvBar[], availableStart: string | undefined): boolean {
  if (!availableStart || bars.length === 0) return false
  const oldest = new Date(bars[0].timestamp).getTime()
  const earliest = new Date(availableStart).getTime()
  return oldest <= earliest + 60_000
}
