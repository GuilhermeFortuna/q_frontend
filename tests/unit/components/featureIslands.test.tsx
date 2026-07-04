import { setupServer } from 'msw/node'
import { useState } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BacktestFocusWorkbench } from '@/components/backtests/focus/BacktestFocusWorkbench'
import { StrategyBuilderWorkspace } from '@/workspaces/strategy-builder/StrategyBuilderWorkspace'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { handlers } from '@/mocks/handlers'
import { MOCK_CAPABILITIES, MOCK_MODELS } from '../fixtures/strategyBuilderFixtures'
import { renderWithQueryClient } from '../testUtils'
import { http, HttpResponse } from 'msw'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(() => {
  server.use(
    http.get('*/api/v1/strategy-builder/capabilities', () => HttpResponse.json(MOCK_CAPABILITIES)),
    http.get('*/api/v1/strategy-builder/models', () => HttpResponse.json(MOCK_MODELS)),
  )
})

function FocusSwapHarness() {
  const [focus, setFocus] = useState<'setup' | 'results'>('setup')
  const config = useBacktestConfig()
  return (
    <div>
      <button type="button" onClick={() => setFocus('results')}>
        focus-results
      </button>
      <button type="button" onClick={() => setFocus('setup')}>
        focus-setup
      </button>
      <BacktestFocusWorkbench
        focus={focus}
        onFocusChange={setFocus}
        onOpenHistory={vi.fn()}
        reducedMotion
        config={config}
        loading={false}
        error={null}
        onSubmit={vi.fn()}
        results={undefined}
        lastRequest={null}
        initialCapital={100000}
        equityCurve={[]}
        monthlyStats={[]}
      />
    </div>
  )
}

function FocusHarness({
  focus,
  onFocusChange = vi.fn(),
}: {
  focus: 'setup' | 'results'
  onFocusChange?: ReturnType<typeof vi.fn>
}) {
  const config = useBacktestConfig()
  return (
    <BacktestFocusWorkbench
      focus={focus}
      onFocusChange={onFocusChange}
      onOpenHistory={vi.fn()}
      reducedMotion
      config={config}
      loading={false}
      error={null}
      onSubmit={vi.fn()}
      results={undefined}
      lastRequest={null}
      initialCapital={100000}
      equityCurve={[]}
      monthlyStats={[]}
    />
  )
}

describe('feature islands — pane parking', () => {
  it('does not mount setup panel while results are focused', async () => {
    renderWithQueryClient(<FocusHarness focus="results" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand setup' })).toBeInTheDocument()
    })
    expect(screen.queryByTestId('run-simulation-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('strategy-studio')).not.toBeInTheDocument()
  })

  it('remounts setup and preserves config after collapse/expand', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<FocusSwapHarness />)

    await waitFor(() => {
      expect(screen.getByTestId('strategy-studio')).toBeInTheDocument()
    })

    const symbolInput = screen.getByPlaceholderText('e.g. PETR4') as HTMLInputElement
    await user.clear(symbolInput)
    await user.type(symbolInput, 'VALE3')

    await user.click(screen.getByRole('button', { name: 'focus-results' }))
    expect(screen.queryByTestId('strategy-studio')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'focus-setup' }))

    await waitFor(() => {
      expect(screen.getByTestId('strategy-studio')).toBeInTheDocument()
    })
    expect((screen.getByPlaceholderText('e.g. PETR4') as HTMLInputElement).value).toBe('VALE3')
  })
})

describe('feature islands — AI Strategy Builder workspace', () => {
  it('renders StrategyBuilderWorkspace directly and displays the AI panel', async () => {
    renderWithQueryClient(<StrategyBuilderWorkspace />)

    await waitFor(() => {
      expect(screen.getByTestId('ai-strategy-panel')).toBeInTheDocument()
    })
  })
})

describe('feature islands — 3D lazy wrappers', () => {
  it('does not import three.js terrain module from results tabs entry', async () => {
    const module = await import('@/components/optimize/OptimizationResultsTabs')
    expect(module.OptimizationResultsTabs).toBeDefined()
    expect(Object.getOwnPropertyNames(module).some((name) => name.includes('Terrain'))).toBe(false)
  })

  it('does not import recharts modules from backtest results tabs entry', async () => {
    const module = await import('@/components/backtests/BacktestResultsTabs')
    expect(module.BacktestResultsTabs).toBeDefined()
    expect(Object.getOwnPropertyNames(module).some((name) => name.includes('EquityCurve'))).toBe(
      false,
    )
  })
})
