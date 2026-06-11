import { screen, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatPrice } from '@/lib/market/format'
import { mockSnapshots } from '@/mocks/data'
import { handlers } from '@/mocks/handlers'
import { MarketDataWorkspace } from '@/workspaces/market-data/MarketDataWorkspace'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

vi.mock('@/api/queries/useProgressiveOhlcv', () => ({
  useProgressiveOhlcv: () => ({
    bars: [],
    isInitialLoading: false,
    isBackfilling: false,
    isProbingRange: false,
    error: null,
    chartRef: { current: null },
    handleViewportChange: vi.fn(),
  }),
}))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('MarketDataWorkspace watchlist quotes', () => {
  beforeEach(() => {
    localStorage.setItem(
      'quant_watchlist',
      JSON.stringify([
        {
          symbol: 'PETR4',
          name: 'PETROBRAS PN N2',
          exchange: 'BOVESPA',
          assetClass: 'equity',
        },
        {
          symbol: 'UNKNOWN',
          name: 'Missing Symbol',
          exchange: 'TEST',
          assetClass: 'equity',
        },
      ]),
    )
  })

  it('renders live mock prices and em-dashes for missing batch symbols', async () => {
    renderWithQueryClient(<MarketDataWorkspace />)

    const petrSnapshot = mockSnapshots.PETR4

    await waitFor(() => {
      expect(
        screen.getAllByText(formatPrice(petrSnapshot.last, petrSnapshot.digits)).length,
      ).toBeGreaterThan(0)
    })

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
  })
})
