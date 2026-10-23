import { describe, expect, it } from 'vitest'

import { buildPerformanceMetricGroups } from '@/lib/backtesting/performanceSummary'
import { getMockBacktestResponse } from '@/mocks/backtest'

describe('buildPerformanceMetricGroups', () => {
  const performance = getMockBacktestResponse({ symbol: 'TEST' }).performance!

  it('formats portfolio and selected-side metrics as declarative groups', () => {
    const groups = buildPerformanceMetricGroups(performance, 'long')

    expect(groups.map(({ title }) => title)).toEqual(['Returns', 'Risk', 'Trade quality'])
    expect(groups[0].rows.find(({ label }) => label === 'Net P&L')?.value).toContain('+')
    expect(groups[2].rows.find(({ label }) => label === 'Expectancy')?.value).toContain('63.25')
  })

  it('renders null metrics as a dash and an all-winner profit factor as infinity', () => {
    const allWinners = {
      ...performance,
      portfolio: { ...performance.portfolio, cagr_pct: null },
      trades: {
        ...performance.trades,
        all: { ...performance.trades.all, winning: 2, losing: 0, profit_factor: null },
      },
    }
    const groups = buildPerformanceMetricGroups(allWinners, 'all')

    expect(groups[0].rows.find(({ label }) => label === 'CAGR')?.value).toBe('—')
    expect(groups[2].rows.find(({ label }) => label === 'Profit factor')?.value).toBe('∞')
  })
})
