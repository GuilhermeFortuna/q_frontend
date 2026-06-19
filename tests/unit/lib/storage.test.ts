import { describe, expect, it } from 'vitest'

import { formatBytes } from '@/lib/formatBytes'
import {
  ACCEPTED_OHLCV_TIMEFRAMES,
  inventoryItemKey,
  isIngestTerminalStatus,
  resolveInventoryKind,
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

  it('resolves inventory kind and stable row keys', () => {
    expect(
      resolveInventoryKind({
        symbol: 'WIN$',
        kind: 'ticks',
        start: '',
        end: '',
        rows: 1,
        bytes: 1,
        updated_at: '',
      }),
    ).toBe('ticks')
    expect(
      inventoryItemKey({
        symbol: 'WIN$',
        kind: 'ticks',
        start: '',
        end: '',
        rows: 1,
        bytes: 1,
        updated_at: '',
      }),
    ).toBe('WIN$-ticks')
    expect(
      inventoryItemKey({
        symbol: 'PETR4',
        kind: 'bars',
        timeframe: 'D1',
        start: '',
        end: '',
        rows: 1,
        bytes: 1,
        updated_at: '',
      }),
    ).toBe('PETR4-D1')
  })
})

describe('formatBytes', () => {
  it('formats kilobytes', () => {
    expect(formatBytes(2048)).toBe('2.0 KB')
  })
})
