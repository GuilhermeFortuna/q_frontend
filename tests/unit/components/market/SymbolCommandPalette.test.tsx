import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { SymbolCommandPalette } from '@/components/market/SymbolCommandPalette'
import { handlers } from '@/mocks/handlers'
import { useAppStore } from '@/store/useAppStore'
import type { Instrument } from '@/types/api'

import { renderWithQueryClient } from '../../testUtils'

const server = setupServer(...handlers)

const petr4: Instrument = {
  symbol: 'PETR4',
  name: 'PETROBRAS PN N2',
  exchange: 'BOVESPA',
  assetClass: 'equity',
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  localStorage.clear()
  useAppStore.setState({ selectedSymbol: 'PETR4' })
})
afterAll(() => server.close())

describe('SymbolCommandPalette', () => {
  it('adds to watchlist without changing selected symbol for +SYM commands', async () => {
    const user = userEvent.setup()
    const onSelectSymbol = vi.fn()
    const onAddToWatchlist = vi.fn()

    renderWithQueryClient(
      <SymbolCommandPalette
        onSelectSymbol={onSelectSymbol}
        onAddToWatchlist={onAddToWatchlist}
        onRemoveFromWatchlist={vi.fn()}
        onSelectTimeframe={vi.fn()}
        recentInstruments={[]}
      />,
    )

    await user.keyboard('+')
    await user.keyboard('PETR4')

    await waitFor(() => {
      expect(screen.getByText(/Add PETR4 to watchlist/i)).toBeInTheDocument()
    })

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(onAddToWatchlist).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'PETR4' }))
    })
    expect(onSelectSymbol).not.toHaveBeenCalled()
  })

  it('shows recent symbols from localStorage when input is empty', async () => {
    const user = userEvent.setup()

    localStorage.setItem('quant_recent_symbols', JSON.stringify(['VALE3', 'PETR4']))

    renderWithQueryClient(
      <SymbolCommandPalette
        onSelectSymbol={vi.fn()}
        onAddToWatchlist={vi.fn()}
        onRemoveFromWatchlist={vi.fn()}
        onSelectTimeframe={vi.fn()}
        recentInstruments={[
          {
            symbol: 'VALE3',
            name: 'VALE ON NM',
            exchange: 'BOVESPA',
            assetClass: 'equity',
          },
          petr4,
        ]}
      />,
    )

    await user.keyboard(' ')

    expect(await screen.findByText('VALE3')).toBeInTheDocument()
    expect(screen.getByText('PETR4')).toBeInTheDocument()
    expect(screen.getAllByText('Recent').length).toBeGreaterThan(0)
  })
})
