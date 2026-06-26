import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { OptimizeSetupPanel } from '@/components/optimize/setup/OptimizeSetupPanel'
import { useOptimizeConfig } from '@/lib/optimize/useOptimizeConfig'
import { handlers } from '@/mocks/handlers'
import { resetMockCustomStrategies } from '@/mocks/data'
import { renderWithQueryClient } from '../testUtils'
import {
  mockOptimizeCustomSaved,
  strategiesWithCustomCustom,
} from '../fixtures/optimizeCustomStrategyFixtures'
import { http, HttpResponse } from 'msw'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockCustomStrategies()
})
afterAll(() => server.close())

vi.mock('@/api/queries/market-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/queries/market-data')>()
  return { ...actual, fetchOhlcvAvailableRange: vi.fn() }
})

function OptimizeSetupHarness({ onSubmit = vi.fn() }: { onSubmit?: ReturnType<typeof vi.fn> }) {
  const config = useOptimizeConfig()
  return <OptimizeSetupPanel config={config} loading={false} error={null} onSubmit={onSubmit} />
}

describe('OptimizeSetupPanel multi-entry', () => {
  it('renders two per-instance search-space sections, manager selector, and exit ranges', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<OptimizeSetupHarness />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /MA Crossover/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /RSI Mean Reversion/i }))

    await waitFor(() => {
      expect(screen.getByText(/e0 · MA Crossover/i)).toBeInTheDocument()
      expect(screen.getByText(/e1 · RSI Mean Reversion/i)).toBeInTheDocument()
    })

    expect(screen.getByTestId('entry-manager-selector')).toBeInTheDocument()
    expect(screen.getAllByText('Short Period').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Period')).toBeInTheDocument()
  })

  it('adds exit candidate ranges when an exit card is toggled on', async () => {
    server.use(
      http.get('*/api/v1/strategies', () => HttpResponse.json(strategiesWithCustomCustom())),
      http.get('*/api/v1/strategies/custom', () => HttpResponse.json([mockOptimizeCustomSaved])),
    )
    const user = userEvent.setup()
    renderWithQueryClient(<OptimizeSetupHarness />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /MyCustomMA/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /MyCustomMA/i }))

    await waitFor(() => {
      expect(screen.getByText('Stop Loss %')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Fixed Stop Loss/i }))

    await waitFor(() => {
      expect(screen.queryByText('Stop Loss %')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Fixed Stop Loss/i }))

    await waitFor(() => {
      expect(screen.getByText('Stop Loss %')).toBeInTheDocument()
    })
  })
})

describe('OptimizeStrategyDetailPanel majority manager', () => {
  it('surfaces vote_threshold search control when majority is selected', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<OptimizeSetupHarness />)

    await waitFor(() => {
      expect(screen.getByTestId('entry-manager-selector')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /RSI Mean Reversion/i }))
    await user.click(screen.getByRole('radio', { name: /Majority vote/i }))

    await waitFor(() => {
      expect(screen.getAllByText('Vote Threshold').length).toBeGreaterThan(0)
    })
  })
})
