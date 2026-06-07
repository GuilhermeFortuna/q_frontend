import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { getAllAvailableDateRange } from '@/lib/backtesting/dateRange'
import { aggregateMonthlyStats, buildEquityCurve } from '@/lib/backtesting/performance'
import type { Trade } from '@/types/backtesting'

function makeTrade(
  id: string,
  exitTime: string,
  pnl: number,
  overrides: Partial<Trade> = {},
): Trade {
  return {
    id,
    order_id: `order-${id}`,
    symbol: 'PETR4',
    action: 'BUY',
    quantity: 1,
    entry_time: exitTime,
    entry_price: 40,
    exit_time: exitTime,
    exit_price: 41,
    status: 'CLOSED',
    pnl,
    commission: 0,
    point_value: 1,
    ...overrides,
  }
}

describe('getAllAvailableDateRange', () => {
  it('uses backend earliest start and today as end', () => {
    const { start, end } = getAllAvailableDateRange('2020-01-01T12:00:00')

    expect(format(start, 'yyyy-MM-dd')).toBe('2020-01-01')
    expect(format(end, 'yyyy-MM-dd')).toBe(format(new Date(), 'yyyy-MM-dd'))
  })
})

describe('buildEquityCurve', () => {
  it('returns empty array for no closed trades', () => {
    expect(buildEquityCurve([], 100000)).toEqual([])
    expect(
      buildEquityCurve(
        [
          makeTrade('1', '2025-01-01T10:00:00Z', 100, {
            status: 'OPEN',
            exit_time: null,
            pnl: null,
          }),
        ],
        100000,
      ),
    ).toEqual([])
  })

  it('builds cumulative equity from closed trades', () => {
    const trades = [
      makeTrade('1', '2025-01-15T10:00:00Z', 500),
      makeTrade('2', '2025-02-01T10:00:00Z', -200),
      makeTrade('3', '2025-02-20T10:00:00Z', 300),
    ]
    const curve = buildEquityCurve(trades, 100000)

    expect(curve).toHaveLength(3)
    expect(curve[0].equity).toBe(100500)
    expect(curve[1].equity).toBe(100300)
    expect(curve[2].equity).toBe(100600)
  })

  it('tracks drawdown after peak', () => {
    const trades = [
      makeTrade('1', '2025-01-15T10:00:00Z', 1000),
      makeTrade('2', '2025-02-01T10:00:00Z', -500),
    ]
    const curve = buildEquityCurve(trades, 100000)

    expect(curve[0].drawdown).toBe(0)
    expect(curve[1].drawdown).toBe(500)
    expect(curve[1].drawdownPct).toBeCloseTo(500 / 101000)
  })
})

describe('aggregateMonthlyStats', () => {
  it('returns empty array for no trades', () => {
    expect(aggregateMonthlyStats([])).toEqual([])
  })

  it('aggregates trades by exit month', () => {
    const trades = [
      makeTrade('1', '2025-01-10T10:00:00Z', 100),
      makeTrade('2', '2025-01-20T10:00:00Z', -50),
      makeTrade('3', '2025-02-05T10:00:00Z', 200),
      makeTrade('4', '2025-02-15T10:00:00Z', 150),
    ]
    const stats = aggregateMonthlyStats(trades)

    expect(stats).toHaveLength(2)
    expect(stats[0].month).toBe('2025-01')
    expect(stats[0].pnl).toBe(50)
    expect(stats[0].trades).toBe(2)
    expect(stats[0].wins).toBe(1)
    expect(stats[0].losses).toBe(1)
    expect(stats[0].winRate).toBe(0.5)

    expect(stats[1].month).toBe('2025-02')
    expect(stats[1].pnl).toBe(350)
    expect(stats[1].trades).toBe(2)
    expect(stats[1].wins).toBe(2)
    expect(stats[1].winRate).toBe(1)
  })
})
