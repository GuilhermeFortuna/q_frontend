import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BacktestResultsTabs } from '@/components/backtests/BacktestResultsTabs'
import { getMockBacktestResponse } from '@/mocks/backtest'
import type { BacktestResponse } from '@/types/backtesting'

const exportBacktestCsv = vi.hoisted(() => vi.fn())
vi.mock('@/lib/reports/backtestCsvExport', () => ({ exportBacktestCsv }))

function renderTabs(results: BacktestResponse) {
  return render(
    <BacktestResultsTabs
      results={results}
      request={null}
      initialCapital={100000}
      equityCurve={[]}
      monthlyStats={[]}
      performanceComputing
      symbol="PETR4"
      timeframe="M5"
    />,
  )
}

describe('BacktestResultsTabs CSV export', () => {
  const results = getMockBacktestResponse({ symbol: 'PETR4', timeframe: 'M5' })

  // Braces matter: a function returned from beforeEach runs as its cleanup.
  beforeEach(() => {
    exportBacktestCsv.mockReset()
  })

  it('exports the persisted run when Export CSV is clicked', async () => {
    exportBacktestCsv.mockResolvedValue(['/tmp/market-data.csv', '/tmp/trades.csv'])
    renderTabs({ ...results, run_id: 'run-1' })

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    await waitFor(() =>
      expect(exportBacktestCsv).toHaveBeenCalledWith({
        runId: 'run-1',
        symbol: 'PETR4',
        timeframe: 'M5',
      }),
    )
  })

  it('shows the failure reason next to the buttons', async () => {
    exportBacktestCsv.mockRejectedValue(new Error('CSV data is not stored for this run.'))
    renderTabs({ ...results, run_id: 'run-1' })

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    expect(await screen.findByText('CSV data is not stored for this run.')).toBeInTheDocument()
  })

  it('is disabled when the run was not persisted', () => {
    renderTabs({ ...results, run_id: null })

    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled()
  })
})
