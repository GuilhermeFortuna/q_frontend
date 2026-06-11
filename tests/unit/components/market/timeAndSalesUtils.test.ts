import { describe, expect, it } from 'vitest'

import { getTickDisplayPrice, getTickPriceColorClass } from '@/components/market/timeAndSalesUtils'
import type { Tick } from '@/types/api'

describe('timeAndSalesUtils', () => {
  it('uses bid when last is zero for quote-only feeds', () => {
    const tick: Tick = {
      timestamp: '2026-06-09T14:32:11.000Z',
      bid: 1.0841,
      ask: 1.0843,
      last: 0,
      volume: 0,
      side: null,
    }

    expect(getTickDisplayPrice(tick)).toBe(1.0841)
  })

  it('colors buy and sell sides explicitly', () => {
    const buyTick: Tick = {
      timestamp: '2026-06-09T14:32:11.000Z',
      bid: 41.07,
      ask: 41.09,
      last: 41.08,
      volume: 300,
      side: 'buy',
    }
    const sellTick: Tick = { ...buyTick, side: 'sell' }

    expect(getTickPriceColorClass(buyTick, null, 41.08)).toBe('text-emerald-400')
    expect(getTickPriceColorClass(sellTick, null, 41.08)).toBe('text-rose-400')
  })

  it('falls back to uptick and downtick coloring when side is null', () => {
    const tick: Tick = {
      timestamp: '2026-06-09T14:32:11.000Z',
      bid: 41.07,
      ask: 41.09,
      last: 41.08,
      volume: 300,
      side: null,
    }

    expect(getTickPriceColorClass(tick, 41.07, 41.08)).toBe('text-emerald-400')
    expect(getTickPriceColorClass(tick, 41.09, 41.08)).toBe('text-rose-400')
    expect(getTickPriceColorClass(tick, 41.08, 41.08)).toBe('text-silver-300')
  })
})
