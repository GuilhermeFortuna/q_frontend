import { describe, expect, it } from 'vitest'

import { formatBytes } from '@/lib/formatBytes'
import {
  ACCEPTED_OHLCV_TIMEFRAMES,
  isIngestTerminalStatus,
  STORAGE_TIMEFRAME_OPTIONS,
} from '@/types/storage'

describe('storage types', () => {
  it('marks completed and failed ingest statuses as terminal', () => {
    expect(isIngestTerminalStatus('completed')).toBe(true)
    expect(isIngestTerminalStatus('failed')).toBe(true)
    expect(isIngestTerminalStatus('running')).toBe(false)
  })

  it('uses only backend-accepted timeframe names in storage options', () => {
    for (const tf of STORAGE_TIMEFRAME_OPTIONS) {
      expect(ACCEPTED_OHLCV_TIMEFRAMES).toContain(tf)
    }
  })
})

describe('formatBytes', () => {
  it('formats kilobytes', () => {
    expect(formatBytes(2048)).toBe('2.0 KB')
  })
})
