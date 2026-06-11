import { screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
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

vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children: ReactNode }) => (
    <div data-testid="market-layout">{children}</div>
  ),
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Separator: () => <div data-testid="resize-handle" />,
  useDefaultLayout: () => ({
    defaultLayout: undefined,
    onLayoutChanged: vi.fn(),
  }),
  usePanelRef: () => ({
    current: { isCollapsed: () => false, collapse: vi.fn(), expand: vi.fn() },
  }),
}))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('MarketDataWorkspace', () => {
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

  it('renders watchlist, toolbar, and chart regions together', async () => {
    renderWithQueryClient(<MarketDataWorkspace />)

    const petrSnapshot = mockSnapshots.PETR4

    await waitFor(() => {
      expect(screen.getByText('Market Watch')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '1D' })).toBeInTheDocument()
      expect(screen.getByText('Draw')).toBeInTheDocument()
      expect(
        screen.getAllByText(formatPrice(petrSnapshot.last, petrSnapshot.digits)).length,
      ).toBeGreaterThan(0)
    })

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
    expect(screen.getByTestId('market-layout')).toBeInTheDocument()
  })
})
