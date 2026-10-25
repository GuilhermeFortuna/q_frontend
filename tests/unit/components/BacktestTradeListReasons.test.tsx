import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BacktestResultsTabs } from '@/components/backtests/BacktestResultsTabs'
import { getMockBacktestResponse } from '@/mocks/backtest'
import type { BacktestResponse, Trade } from '@/types/backtesting'

vi.mock('@/lib/reports/backtestCsvExport', () => ({ exportBacktestCsv: vi.fn() }))

function renderTradeList(trades: Trade[]) {
  const base = getMockBacktestResponse({ symbol: 'WDO$N', timeframe: 'M15' })
  const results: BacktestResponse = { ...base, trades }
  render(
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
  return userEvent.click(screen.getByRole('button', { name: 'Trade List' }))
}

function trade(overrides: Partial<Trade> & Pick<Trade, 'id'>): Trade {
  const base = getMockBacktestResponse({ symbol: 'WDO$N', timeframe: 'M15' }).trades[0]!
  return {
    ...base,
    entry_reason: null,
    exit_reason: null,
    exit_resolution: null,
    ...overrides,
  }
}

const TRADES: Trade[] = [
  trade({ id: 't1', entry_reason: 'Breakout', exit_reason: 'SIGNAL', pnl: 100 }),
  trade({ id: 't2', entry_reason: null, exit_reason: 'STOP_LOSS', pnl: -50 }),
  trade({ id: 't3', entry_reason: 'vwap reclaim', exit_reason: 'trailing', pnl: 300 }),
  trade({
    id: 't4',
    entry_reason: 'Alpha',
    exit_reason: null,
    exit_time: null,
    exit_price: null,
    pnl: null,
  }),
]

function rowOrder(): string[] {
  return Array.from(document.querySelectorAll('tbody tr[data-row-key]')).map(
    (row) => row.getAttribute('data-row-key') ?? '',
  )
}

async function clickHeader(name: RegExp) {
  await userEvent.click(screen.getByRole('columnheader', { name }))
}

describe('Trade List entry and exit reasons', () => {
  it('renders the Entry Reason column with user reasons verbatim and a dash when absent', async () => {
    await renderTradeList(TRADES)

    expect(screen.getByRole('columnheader', { name: /Entry Reason/ })).toBeInTheDocument()
    expect(screen.getByText('vwap reclaim')).toBeInTheDocument()
    expect(screen.getByText('Breakout')).toBeInTheDocument()
    expect(screen.getByText('Signal Exit')).toBeInTheDocument()
  })

  it('sorts Entry Reason ascending, descending, then back to the original order, nulls last', async () => {
    await renderTradeList(TRADES)

    await clickHeader(/Entry Reason/)
    expect(rowOrder()).toEqual(['t4', 't1', 't3', 't2'])

    await clickHeader(/Entry Reason/)
    expect(rowOrder()).toEqual(['t3', 't1', 't4', 't2'])

    await clickHeader(/Entry Reason/)
    expect(rowOrder()).toEqual(['t1', 't2', 't3', 't4'])
  })

  it('sorts Exit Reason by its displayed label, nulls last', async () => {
    await renderTradeList(TRADES)

    await clickHeader(/Exit Reason/)
    expect(rowOrder()).toEqual(['t2', 't1', 't3', 't4'])

    await clickHeader(/Exit Reason/)
    expect(rowOrder()).toEqual(['t3', 't1', 't2', 't4'])
  })

  it('sorts PnL numerically with open trades last in both directions', async () => {
    await renderTradeList(TRADES)

    await clickHeader(/PnL/)
    expect(rowOrder()).toEqual(['t2', 't1', 't3', 't4'])

    await clickHeader(/PnL/)
    expect(rowOrder()).toEqual(['t3', 't1', 't2', 't4'])
  })

  it('leaves the other columns unsorted', async () => {
    await renderTradeList(TRADES)

    await clickHeader(/Entry Time/)
    expect(rowOrder()).toEqual(['t1', 't2', 't3', 't4'])
    expect(screen.getByRole('columnheader', { name: /Entry Time/ })).not.toHaveTextContent('▲')
  })
})
