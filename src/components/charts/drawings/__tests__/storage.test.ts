import { describe, expect, it } from 'vitest'

import {
  drawingsStorageKey,
  loadSymbolDrawings,
  saveSymbolDrawings,
  type DrawingStorage,
} from '@/components/charts/drawings/storage'
import type { DrawingObject } from '@/components/charts/drawings/model'

/** A minimal in-memory `Storage` that can be told to reject writes. */
function memoryStorage(options: { rejectWrites?: boolean } = {}) {
  const items = new Map<string, string>()
  const storage: DrawingStorage = {
    get length() {
      return items.size
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => items.get(key) ?? null,
    removeItem: (key) => {
      items.delete(key)
    },
    setItem: (key, value) => {
      if (options.rejectWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError')
      items.set(key, value)
    },
  }
  return { storage, items }
}

const HOUR = 3_600_000
const BAR_10 = Date.UTC(2026, 0, 5, 10)
const BAR_11 = BAR_10 + HOUR

const trend: DrawingObject = {
  id: 'trend-1',
  type: 'trendline',
  anchors: [
    { time: BAR_10, price: 100 },
    { time: BAR_11, price: 101 },
  ],
  style: { color: '#c9a227', width: 1, lineStyle: 'solid' },
  locked: false,
  hidden: false,
  options: { extendLeft: false, extendRight: true, showAngle: false, showPriceChange: false },
}

describe('saveSymbolDrawings and loadSymbolDrawings', () => {
  it('round-trips drawings through one versioned entry per symbol', () => {
    const { storage, items } = memoryStorage()
    expect(saveSymbolDrawings(storage, 'WDO', [trend])).toEqual({ ok: true })
    expect(items.has(drawingsStorageKey('WDO'))).toBe(true)
    expect(JSON.parse(items.get(drawingsStorageKey('WDO')) ?? '{}')).toMatchObject({
      version: 2,
    })

    const loaded = loadSymbolDrawings(storage, 'WDO')
    expect(loaded.drawings).toEqual([trend])
    expect(loaded.notices).toEqual([])
  })

  it('keeps symbols apart', () => {
    const { storage } = memoryStorage()
    saveSymbolDrawings(storage, 'WDO', [trend])
    expect(loadSymbolDrawings(storage, 'WIN').drawings).toEqual([])
  })

  it('reports a failed write without throwing', () => {
    const { storage } = memoryStorage({ rejectWrites: true })
    const result = saveSymbolDrawings(storage, 'WDO', [trend])
    expect(result.ok).toBe(false)
  })

  it('reports an unavailable storage as a failed write', () => {
    expect(saveSymbolDrawings(null, 'WDO', [trend]).ok).toBe(false)
    expect(loadSymbolDrawings(null, 'WDO')).toEqual({
      drawings: [],
      notices: [],
      migrationPending: false,
    })
  })
})

describe('legacy migration', () => {
  it('merges per-timeframe entries into one v2 entry and removes them', () => {
    const { storage, items } = memoryStorage()
    items.set(
      'quant:drawings:WDO:1H',
      JSON.stringify([
        {
          id: 'h-line',
          type: 'horizontal',
          price: 101.5,
        },
        {
          id: 'legacy-trend',
          type: 'trendline',
          p1: { timestamp: new Date(BAR_10).toISOString(), price: 100 },
          p2: { timestamp: new Date(BAR_11).toISOString(), price: 102 },
        },
      ]),
    )
    items.set(
      'quant:drawings:WDO:10m',
      JSON.stringify([
        {
          id: 'note',
          type: 'text',
          point: { timestamp: new Date(BAR_10).toISOString(), price: 99 },
          label: 'support',
        },
      ]),
    )

    const loaded = loadSymbolDrawings(storage, 'WDO')

    expect(loaded.drawings.map((drawing) => drawing.id).sort()).toEqual([
      'h-line',
      'legacy-trend',
      'note',
    ])
    const migrated = loaded.drawings.find((drawing) => drawing.id === 'legacy-trend')
    expect(migrated?.anchors).toEqual([
      { time: BAR_10, price: 100 },
      { time: BAR_11, price: 102 },
    ])
    expect(loaded.drawings.find((drawing) => drawing.id === 'note')).toMatchObject({
      type: 'text',
      options: { text: 'support' },
    })
    expect(items.has('quant:drawings:WDO:1H')).toBe(false)
    expect(items.has('quant:drawings:WDO:10m')).toBe(false)
    expect(items.has(drawingsStorageKey('WDO'))).toBe(true)

    // Once migrated, a second load finds nothing legacy and returns the same drawings.
    expect(loadSymbolDrawings(storage, 'WDO').drawings).toHaveLength(3)
  })

  it('keeps legacy entries when the migrated write fails, so nothing is lost', () => {
    const { storage, items } = memoryStorage({ rejectWrites: true })
    items.set('quant:drawings:WDO:1H', JSON.stringify([{ id: 'h', type: 'horizontal', price: 1 }]))
    const loaded = loadSymbolDrawings(storage, 'WDO')
    expect(loaded.drawings).toHaveLength(1)
    expect(loaded.migrationPending).toBe(true)
    expect(items.has('quant:drawings:WDO:1H')).toBe(true)
    expect(loaded.notices.join(' ')).toMatch(/could not be saved/)
  })

  it('does not treat another symbol with a colon-free prefix as this symbol', () => {
    const { storage, items } = memoryStorage()
    items.set('quant:drawings:WDOX:1H', JSON.stringify([{ id: 'x', type: 'horizontal', price: 1 }]))
    expect(loadSymbolDrawings(storage, 'WDO').drawings).toEqual([])
    expect(items.has('quant:drawings:WDOX:1H')).toBe(true)
  })
})

describe('malformed entries', () => {
  it('drops an entry that is not JSON and reports it', () => {
    const { storage, items } = memoryStorage()
    items.set(drawingsStorageKey('WDO'), '{not json')
    const loaded = loadSymbolDrawings(storage, 'WDO')
    expect(loaded.drawings).toEqual([])
    expect(loaded.notices.join(' ')).toMatch(/could not be read and were dropped/)
  })

  it('drops single drawings that fail validation and keeps the valid ones', () => {
    const { storage, items } = memoryStorage()
    items.set(
      drawingsStorageKey('WDO'),
      JSON.stringify({
        version: 2,
        drawings: [
          trend,
          { id: 'bad-type', type: 'spiral', anchors: [] },
          { id: 'bad-anchors', type: 'trendline', anchors: [{ time: 'x', price: 1 }] },
          { type: 'hline', anchors: [{ time: 1, price: 1 }] },
        ],
      }),
    )
    const loaded = loadSymbolDrawings(storage, 'WDO')
    expect(loaded.drawings.map((drawing) => drawing.id)).toEqual(['trend-1'])
    expect(loaded.notices.join(' ')).toMatch(/3 saved drawings/)
  })

  it('fills in defaults for missing style and options instead of dropping the drawing', () => {
    const parsed = loadSymbolDrawings(
      (() => {
        const { storage, items } = memoryStorage()
        items.set(
          drawingsStorageKey('WDO'),
          JSON.stringify({
            version: 2,
            drawings: [
              {
                id: 'r',
                type: 'rect',
                anchors: [
                  { time: BAR_10, price: 1 },
                  { time: BAR_11, price: 2 },
                ],
                style: { width: 9, lineStyle: 'wavy' },
                options: { fill: 'yes' },
              },
            ],
          }),
        )
        return storage
      })(),
      'WDO',
    )
    expect(parsed.drawings[0]).toMatchObject({
      style: { color: '#c9a227', width: 1, lineStyle: 'solid' },
      options: { fill: true, fillOpacity: 0.12 },
    })
  })
})
