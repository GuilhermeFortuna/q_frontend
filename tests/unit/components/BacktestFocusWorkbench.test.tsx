import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useState } from 'react'

import { BacktestFocusWorkbench } from '@/components/backtests/focus/BacktestFocusWorkbench'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { aggregateMonthlyStats, buildEquityCurve } from '@/lib/backtesting/performance'
import { getMockBacktestResponse } from '@/mocks/backtest'
import { handlers } from '@/mocks/handlers'
import { EquityCurveChart } from '@/components/backtests/EquityCurveChart'
import type { BacktestRequest, BacktestResponse } from '@/types/backtesting'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

const resultsRenderCount = vi.hoisted(() => ({ current: 0 }))

vi.mock('@/components/backtests/EquityCurveChart', () => ({
  EquityCurveChart: vi.fn(() => <div data-testid="equity-chart-mock" />),
}))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resultsRenderCount.current = 0
  vi.mocked(EquityCurveChart).mockClear()
})
afterAll(() => server.close())

const mockLastRequest: BacktestRequest = {
  symbol: 'PETR4',
  timeframe: 'D1',
  initial_capital: 100000,
  strategy: 'MACrossover',
}

function WorkbenchHarness({
  results,
  lastRequest = mockLastRequest,
  initialCapital = 100000,
  focus = 'results',
}: {
  results: BacktestResponse
  lastRequest?: BacktestRequest
  initialCapital?: number
  focus?: 'setup' | 'results'
}) {
  const config = useBacktestConfig()
  const equityCurve = useMemo(
    () => buildEquityCurve(results.trades, initialCapital),
    [results.trades, initialCapital],
  )
  const monthlyStats = useMemo(() => aggregateMonthlyStats(results.trades), [results.trades])

  return (
    <BacktestFocusWorkbench
      focus={focus}
      onFocusChange={vi.fn()}
      onOpenHistory={vi.fn()}
      reducedMotion
      config={config}
      loading={false}
      error={null}
      onSubmit={vi.fn()}
      results={results}
      lastRequest={lastRequest}
      initialCapital={initialCapital}
      equityCurve={equityCurve}
      monthlyStats={monthlyStats}
    />
  )
}

function ResultsUpdaterHarness() {
  const config = useBacktestConfig()
  const [results, setResults] = useState(() => getMockBacktestResponse(mockLastRequest))
  const equityCurve = useMemo(() => buildEquityCurve(results.trades, 100000), [results.trades])
  const monthlyStats = useMemo(() => aggregateMonthlyStats(results.trades), [results.trades])

  return (
    <>
      <button
        type="button"
        onClick={() => setResults(getMockBacktestResponse({ ...mockLastRequest, symbol: 'VALE3' }))}
      >
        Refresh results
      </button>
      <BacktestFocusWorkbench
        focus="results"
        onFocusChange={vi.fn()}
        onOpenHistory={vi.fn()}
        reducedMotion
        config={config}
        loading={false}
        error={null}
        onSubmit={vi.fn()}
        results={results}
        lastRequest={mockLastRequest}
        initialCapital={100000}
        equityCurve={equityCurve}
        monthlyStats={monthlyStats}
      />
    </>
  )
}

describe('BacktestFocusWorkbench', () => {
  beforeEach(() => {
    resultsRenderCount.current = 0
    vi.mocked(EquityCurveChart).mockImplementation(() => {
      resultsRenderCount.current += 1
      return <div data-testid="equity-chart-mock" />
    })
  })

  it('does not mount results charts while setup is focused', () => {
    const results = getMockBacktestResponse(mockLastRequest)

    renderWithQueryClient(<WorkbenchHarness results={results} focus="setup" />)

    expect(screen.queryByTestId('equity-chart-mock')).not.toBeInTheDocument()
    expect(resultsRenderCount.current).toBe(0)
  })

  it('does not re-render the results subtree while typing in config fields', async () => {
    const user = userEvent.setup()
    const results = getMockBacktestResponse(mockLastRequest)

    renderWithQueryClient(<WorkbenchHarness results={results} focus="results" />)

    await waitFor(() => {
      expect(screen.getByTestId('equity-chart-mock')).toBeInTheDocument()
    })

    const rendersAfterMount = resultsRenderCount.current
    expect(rendersAfterMount).toBeGreaterThan(0)

    const capitalInput = screen.getByDisplayValue('100000')

    await user.clear(capitalInput)
    await user.type(capitalInput, '150000')

    expect(resultsRenderCount.current).toBe(rendersAfterMount)
    expect(capitalInput).toHaveValue(150000)
  })

  it('re-renders the results subtree when backtest data changes', async () => {
    const user = userEvent.setup()

    renderWithQueryClient(<ResultsUpdaterHarness />)

    await waitFor(() => {
      expect(screen.getByTestId('equity-chart-mock')).toBeInTheDocument()
    })

    const rendersAfterMount = resultsRenderCount.current

    await user.click(screen.getByRole('button', { name: 'Refresh results' }))

    await waitFor(() => {
      expect(resultsRenderCount.current).toBeGreaterThan(rendersAfterMount)
    })
  })
})
