import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BacktestResultsTabs } from '@/components/backtests/BacktestResultsTabs'
import { getMockBacktestResponse } from '@/mocks/backtest'
import type { BacktestResponse } from '@/types/backtesting'

vi.mock('@/lib/reports/backtestCsvExport', () => ({ exportBacktestCsv: vi.fn() }))

function renderTabs(results: BacktestResponse) {
  return render(
    <BacktestResultsTabs
      results={results}
      request={null}
      initialCapital={100000}
      equityCurve={[]}
      monthlyStats={[]}
      performanceComputing
      symbol="WDO$N"
      timeframe="M15"
    />,
  )
}

describe('BacktestResultsTabs notes', () => {
  const base = getMockBacktestResponse({ symbol: 'WDO$N', timeframe: 'M15' })

  it('shows the Notes section when the result carries notes', () => {
    renderTabs({
      ...base,
      notes: [{ code: 'intrabar_incomplete_ticks', message: 'Two exits used approximate prices.' }],
    })

    expect(screen.getByRole('region', { name: 'Notes' })).toBeInTheDocument()
    expect(screen.getByText('Two exits used approximate prices.')).toBeInTheDocument()
  })

  it('omits the Notes section when the notes list is empty', () => {
    renderTabs({ ...base, notes: [] })

    expect(screen.queryByRole('region', { name: 'Notes' })).not.toBeInTheDocument()
  })

  it('loads a stored result that predates notes', () => {
    const { notes: _omitted, ...stored } = { ...base, notes: [] }

    renderTabs(stored as BacktestResponse)

    expect(screen.queryByRole('region', { name: 'Notes' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
  })

  it('shows the approximate basis beside an exit decided on substituted prices', async () => {
    const [first] = base.trades
    renderTabs({ ...base, trades: [{ ...first, exit_resolution: 'minute' }] })

    await userEvent.click(screen.getByRole('button', { name: 'Trade List' }))

    expect(screen.getByText('Approximate: one-minute bar')).toBeInTheDocument()
  })
})
