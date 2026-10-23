import { describe, expect, it } from 'vitest'

import {
  breakdownBy,
  holdVsPnl,
  pnlHistogram,
  rollingTradeStats,
} from '@/lib/backtesting/distribution'
import type { Trade } from '@/types/backtesting'

function createTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't-1',
    order_id: 'o-1',
    symbol: 'PETR4',
    action: 'BUY',
    quantity: 100,
    entry_time: '2026-03-09T13:00:00Z',
    entry_price: 30,
    exit_time: '2026-03-09T15:00:00Z',
    exit_price: 31,
    pnl: 100,
    commission: 0,
    point_value: 1,
    status: 'CLOSED',
    ...overrides,
  }
}

describe('distribution derivations', () => {
  describe('rollingTradeStats', () => {
    it('matches hand-computed values for each metric and window', () => {
      // 4 trades: 3 winners, 1 loser
      const trades: Trade[] = [
        createTrade({ id: 't-1', exit_time: '2026-01-01T10:00:00Z', pnl: 100 }),
        createTrade({ id: 't-2', exit_time: '2026-01-02T10:00:00Z', pnl: -50 }),
        createTrade({ id: 't-3', exit_time: '2026-01-03T10:00:00Z', pnl: 200 }),
        createTrade({ id: 't-4', exit_time: '2026-01-04T10:00:00Z', pnl: 50 }),
      ]

      // Window of 3
      const points = rollingTradeStats(trades, 3)
      expect(points).toHaveLength(2)

      // Point 0: window [t-1 (100), t-2 (-50), t-3 (200)]
      // Win rate: 2 wins / 3 trades = 2/3
      // Expectancy: (100 - 50 + 200) / 3 = 250 / 3
      // Profit factor: 300 gross profit / 50 gross loss = 6.0
      expect(points[0].timestamp).toBe('2026-01-03T10:00:00Z')
      expect(points[0].win_rate).toBeCloseTo(2 / 3, 5)
      expect(points[0].expectancy).toBeCloseTo(250 / 3, 5)
      expect(points[0].profit_factor).toBeCloseTo(6.0, 5)

      // Point 1: window [t-2 (-50), t-3 (200), t-4 (50)]
      // Win rate: 2 wins / 3 trades = 2/3
      // Expectancy: (-50 + 200 + 50) / 3 = 200 / 3
      // Profit factor: 250 gross profit / 50 gross loss = 5.0
      expect(points[1].timestamp).toBe('2026-01-04T10:00:00Z')
      expect(points[1].win_rate).toBeCloseTo(2 / 3, 5)
      expect(points[1].expectancy).toBeCloseTo(200 / 3, 5)
      expect(points[1].profit_factor).toBeCloseTo(5.0, 5)
    })

    it('returns null profit factor for loss-free windows', () => {
      const trades: Trade[] = [
        createTrade({ id: 't-1', exit_time: '2026-01-01T10:00:00Z', pnl: 100 }),
        createTrade({ id: 't-2', exit_time: '2026-01-02T10:00:00Z', pnl: 200 }),
        createTrade({ id: 't-3', exit_time: '2026-01-03T10:00:00Z', pnl: 300 }),
      ]

      const points = rollingTradeStats(trades, 2)
      expect(points).toHaveLength(2)
      expect(points[0].profit_factor).toBeNull()
      expect(points[1].profit_factor).toBeNull()
    })

    it('returns empty array when trade count is less than window', () => {
      const trades: Trade[] = [
        createTrade({ id: 't-1', exit_time: '2026-01-01T10:00:00Z', pnl: 100 }),
      ]
      expect(rollingTradeStats(trades, 20)).toEqual([])
      expect(rollingTradeStats([], 20)).toEqual([])
    })

    it('sorts trades by exit time and filters open trades', () => {
      const trades: Trade[] = [
        createTrade({ id: 't-3', exit_time: '2026-01-03T10:00:00Z', pnl: 300 }),
        createTrade({ id: 't-open', status: 'OPEN', exit_time: null, pnl: null }),
        createTrade({ id: 't-1', exit_time: '2026-01-01T10:00:00Z', pnl: 100 }),
        createTrade({ id: 't-2', exit_time: '2026-01-02T10:00:00Z', pnl: -50 }),
      ]

      const points = rollingTradeStats(trades, 3)
      expect(points).toHaveLength(1)
      expect(points[0].timestamp).toBe('2026-01-03T10:00:00Z')
      expect(points[0].expectancy).toBeCloseTo(350 / 3, 5)
    })
  })

  describe('pnlHistogram', () => {
    it('never has a bin spanning zero and bin counts sum to closed trades', () => {
      const pnls = [-250, -180, -90, -40, -10, 0, 15, 60, 120, 200, 350, 400]
      const trades = pnls.map((pnl, i) =>
        createTrade({
          id: `t-${i}`,
          exit_time: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
          pnl,
        }),
      )

      const result = pnlHistogram(trades)

      expect(result.bins.length).toBeGreaterThanOrEqual(10)
      expect(result.bins.length).toBeLessThanOrEqual(40)

      // Bin edges must not straddle 0
      for (const bin of result.bins) {
        if (bin.x0 < 0) {
          expect(bin.x1).toBeLessThanOrEqual(0)
          expect(bin.tone).toBe('negative')
        } else {
          expect(bin.x0).toBeGreaterThanOrEqual(0)
          expect(bin.tone).toBe('positive')
        }
      }

      // Counts sum to total trades
      const totalCount = result.bins.reduce((sum, b) => sum + b.count, 0)
      expect(totalCount).toBe(trades.length)
      expect(result.totalTrades).toBe(trades.length)
    })

    it('calculates mean and median correctly', () => {
      const trades = [
        createTrade({ id: 't-1', pnl: 10 }),
        createTrade({ id: 't-2', pnl: 20 }),
        createTrade({ id: 't-3', pnl: 30 }),
        createTrade({ id: 't-4', pnl: 40 }),
      ]
      const result = pnlHistogram(trades)
      expect(result.mean).toBe(25)
      expect(result.median).toBe(25)

      // Odd count
      const oddTrades = [
        createTrade({ id: 't-1', pnl: 10 }),
        createTrade({ id: 't-2', pnl: 20 }),
        createTrade({ id: 't-3', pnl: 60 }),
      ]
      const oddResult = pnlHistogram(oddTrades)
      expect(oddResult.mean).toBe(30)
      expect(oddResult.median).toBe(20)
    })

    it('clamps bins to 10–40 even with extreme outliers or identical values', () => {
      // 100 identical trades
      const flatTrades = Array.from({ length: 100 }, (_, i) =>
        createTrade({ id: `t-${i}`, pnl: 50 }),
      )
      const flatResult = pnlHistogram(flatTrades)
      expect(flatResult.bins.length).toBeGreaterThanOrEqual(10)
      expect(flatResult.bins.length).toBeLessThanOrEqual(40)

      // Extreme outlier
      const outlierTrades = [
        ...Array.from({ length: 99 }, (_, i) => createTrade({ id: `t-${i}`, pnl: (i % 10) - 5 })),
        createTrade({ id: 't-outlier', pnl: 100000 }),
      ]
      const outlierResult = pnlHistogram(outlierTrades)
      expect(outlierResult.bins.length).toBeGreaterThanOrEqual(10)
      expect(outlierResult.bins.length).toBeLessThanOrEqual(40)
      const totalCount = outlierResult.bins.reduce((sum, b) => sum + b.count, 0)
      expect(totalCount).toBe(100)
    })

    it('handles empty trades gracefully', () => {
      const result = pnlHistogram([])
      expect(result.bins).toEqual([])
      expect(result.mean).toBeNull()
      expect(result.median).toBeNull()
      expect(result.totalTrades).toBe(0)
    })
  })

  describe('holdVsPnl', () => {
    it('calculates duration as exit - entry in seconds', () => {
      const trades: Trade[] = [
        createTrade({
          id: 't-1',
          action: 'BUY',
          entry_time: '2026-03-09T10:00:00Z',
          exit_time: '2026-03-09T10:30:00Z',
          pnl: 150,
        }),
        createTrade({
          id: 't-2',
          action: 'SELL',
          entry_time: '2026-03-09T11:00:00Z',
          exit_time: '2026-03-09T13:00:00Z',
          pnl: -80,
        }),
      ]

      const points = holdVsPnl(trades)
      expect(points).toHaveLength(2)

      expect(points[0].id).toBe('t-1')
      expect(points[0].side).toBe('BUY')
      expect(points[0].duration).toBe(1800) // 30 minutes = 1800s
      expect(points[0].pnl).toBe(150)
      expect(points[0].tone).toBe('positive')

      expect(points[1].id).toBe('t-2')
      expect(points[1].side).toBe('SELL')
      expect(points[1].duration).toBe(7200) // 2 hours = 7200s
      expect(points[1].pnl).toBe(-80)
      expect(points[1].tone).toBe('negative')
    })
  })

  describe('breakdownBy', () => {
    it('buckets by display-timezone (America/Sao_Paulo) entry time around midnight UTC', () => {
      // 2026-03-10T01:30:00Z is Tuesday 1:30 AM in UTC.
      // In America/Sao_Paulo (UTC-3), it is Monday 2026-03-09 22:30:00-03:00.
      const midnightTrade = createTrade({
        id: 't-midnight',
        entry_time: '2026-03-10T01:30:00Z',
        exit_time: '2026-03-10T02:00:00Z',
        pnl: 250,
      })

      // Weekday breakdown
      const weekdayBuckets = breakdownBy([midnightTrade], 'weekday')
      const monBucket = weekdayBuckets.find((b) => b.key === 'Mon')
      const tueBucket = weekdayBuckets.find((b) => b.key === 'Tue')

      expect(monBucket?.trades).toBe(1)
      expect(monBucket?.pnl).toBe(250)
      expect(monBucket?.winRate).toBe(1)
      expect(tueBucket?.trades).toBe(0)

      // Hour breakdown (should be 22:00 in America/Sao_Paulo)
      const hourBuckets = breakdownBy([midnightTrade], 'hour')
      const h22Bucket = hourBuckets.find((b) => b.key === '22:00' || b.label === '22:00')
      expect(h22Bucket).toBeDefined()
      expect(h22Bucket?.trades).toBe(1)
      expect(h22Bucket?.pnl).toBe(250)
    })

    it('defaults to Mon–Fri and includes Sat/Sun only when present', () => {
      const weekdayTrades = [
        createTrade({ id: 't-1', entry_time: '2026-03-09T14:00:00Z', pnl: 100 }), // Mon
      ]
      const weekdaysOnly = breakdownBy(weekdayTrades, 'weekday')
      expect(weekdaysOnly.map((b) => b.key)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])

      // Add Saturday trade (2026-03-14 is Saturday)
      const satTrade = createTrade({
        id: 't-sat',
        entry_time: '2026-03-14T14:00:00Z',
        pnl: 50,
      })
      const withSat = breakdownBy([...weekdayTrades, satTrade], 'weekday')
      expect(withSat.map((b) => b.key)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    })

    it('processes a 10,000-trade dataset responsively', () => {
      const n = 10_000
      const largeDataset: Trade[] = Array.from({ length: n }, (_, i) =>
        createTrade({
          id: `t-${i}`,
          entry_time: new Date(Date.UTC(2026, 0, 1, 9, 0) + i * 60_000).toISOString(),
          exit_time: new Date(Date.UTC(2026, 0, 1, 9, 30) + i * 60_000).toISOString(),
          pnl: ((i % 7) - 3) * 10,
        }),
      )

      const start = performance.now()
      const r100 = rollingTradeStats(largeDataset, 100)
      const hist = pnlHistogram(largeDataset)
      const hold = holdVsPnl(largeDataset)
      const bdDay = breakdownBy(largeDataset, 'weekday')
      const bdHour = breakdownBy(largeDataset, 'hour')
      const elapsed = performance.now() - start

      expect(r100).toHaveLength(n - 100 + 1)
      expect(hist.bins.length).toBeGreaterThanOrEqual(10)
      expect(hist.bins.length).toBeLessThanOrEqual(40)
      expect(hist.bins.reduce((sum, b) => sum + b.count, 0)).toBe(n)
      expect(hold).toHaveLength(n)
      expect(bdDay.length).toBeGreaterThanOrEqual(5)
      expect(bdHour.length).toBeGreaterThan(0)

      // Entire suite of derivations over 10,000 trades should run well within 500ms
      expect(elapsed).toBeLessThan(500)
    })
  })
})
