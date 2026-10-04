import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

import { BacktestResultsTabs } from '@/components/backtests/BacktestResultsTabs'
import { MLFilterSummaryCard } from '@/components/backtests/MLFilterSummaryCard'
import { getMockBacktestResponse } from '@/mocks/backtest'
import type { BacktestRequest } from '@/types/backtesting'

beforeEach(() => navigateMock.mockClear())

function renderResults(request: BacktestRequest, runId = 'run-win-ma') {
  const results = {
    ...getMockBacktestResponse(request),
    run_id: runId,
  }
  return render(
    <BacktestResultsTabs
      results={results}
      request={request}
      initialCapital={100000}
      equityCurve={[]}
      monthlyStats={[]}
      symbol="WIN$"
      timeframe="M5"
    />,
  )
}

describe('MLFilterSummaryCard', () => {
  it('shows the exact version, threshold and candidate counts', () => {
    render(
      <MLFilterSummaryCard
        summary={{
          model_version_id: 'mlf-model-a',
          threshold: 0.65,
          dataset_id: 'mlf-dataset-a',
          candidates_scored: 120,
          candidates_accepted: 54,
          candidates_rejected: 60,
          candidates_not_ready: 6,
        }}
      />,
    )
    const card = screen.getByTestId('ml-filter-summary')
    expect(card).toHaveTextContent('mlf-model-a')
    expect(card).toHaveTextContent('threshold 0.65')
    expect(card).toHaveTextContent('Accepted 54')
    expect(card).toHaveTextContent('Not ready 6')
  })

  it('falls back to the saved configuration when no summary exists (history)', () => {
    render(<MLFilterSummaryCard config={{ model_version_id: 'mlf-model-b', threshold: 0.4 }} />)
    expect(screen.getByTestId('ml-filter-summary')).toHaveTextContent('threshold 0.40')
  })

  it('renders nothing for the original strategies', () => {
    const { container } = render(<MLFilterSummaryCard />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Backtest results ML filter entry points', () => {
  const maRequest: BacktestRequest = {
    symbol: 'WIN$',
    timeframe: 'M5',
    strategy: 'MACrossover',
    entries: [{ strategy: 'MACrossover', params: {} }],
  }

  it('offers Train ML filter for a completed MA Crossover run and opens the research tab', async () => {
    const user = userEvent.setup()
    renderResults(maRequest)
    await user.click(await screen.findByTestId('train-ml-filter'))
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/research',
      search: { tab: 'ml-filters', source_run_id: 'run-win-ma' },
    })
  })

  it('does not offer training from the variant itself and shows its summary', async () => {
    renderResults({
      ...maRequest,
      strategy: 'MACrossoverMLFilter',
      entries: [{ strategy: 'MACrossoverMLFilter', params: {} }],
      ml_filter: { model_version_id: 'mlf-model-lightgbm-seed', threshold: 0.6 },
    })
    expect(await screen.findByTestId('ml-filter-summary')).toHaveTextContent(
      'mlf-model-lightgbm-seed',
    )
    expect(screen.queryByTestId('train-ml-filter')).not.toBeInTheDocument()
  })

  it('does not offer training for other strategies', async () => {
    renderResults({ ...maRequest, strategy: 'RSIMeanReversion', entries: [] })
    await screen.findByText(/Performance/)
    expect(screen.queryByTestId('train-ml-filter')).not.toBeInTheDocument()
  })
})
