import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { MarketWatchPanel } from '@/components/market/MarketWatchPanel'
import { formatPrice } from '@/lib/market/format'
import { mockSnapshots } from '@/mocks/data'
import { handlers } from '@/mocks/handlers'
import type { Instrument } from '@/types/api'

import { renderWithQueryClient } from '../../testUtils'

const server = setupServer(...handlers)

const equityInstrument = (symbol: string, name: string): Instrument => ({
  symbol,
  name,
  exchange: 'BOVESPA',
  assetClass: 'equity',
})

const futureInstrument = (symbol: string, name: string): Instrument => ({
  symbol,
  name,
  exchange: 'BMF',
  assetClass: 'future',
})

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  localStorage.clear()
})
afterAll(() => server.close())

describe('MarketWatchPanel', () => {
  it('renders watchlist rows and fires selection callbacks', async () => {
    const user = userEvent.setup()
    const onSelectSymbol = vi.fn()
    const snapshot = mockSnapshots.PETR4

    renderWithQueryClient(
      <MarketWatchPanel
        watchlist={[equityInstrument('PETR4', 'PETROBRAS PN N2')]}
        snapshotsBySymbol={{ PETR4: snapshot }}
        selectedSymbol="VALE3"
        isLoadingInstruments={false}
        mt5SearchResults={[]}
        mt5SearchLoading={false}
        onSelectSymbol={onSelectSymbol}
        onAddInstrument={vi.fn()}
        onRemoveInstrument={vi.fn()}
      />,
    )

    expect(screen.getByText(formatPrice(snapshot.last, snapshot.digits))).toBeInTheDocument()

    await user.click(screen.getByText('PETR4'))
    expect(onSelectSymbol).toHaveBeenCalledWith('PETR4')
  })

  it('cycles sort order without mutating persisted watchlist order', async () => {
    const user = userEvent.setup()
    const watchlist = [
      equityInstrument('PETR4', 'PETROBRAS PN N2'),
      equityInstrument('VALE3', 'VALE ON NM'),
    ]

    localStorage.setItem('quant_watchlist', JSON.stringify(watchlist))

    renderWithQueryClient(
      <MarketWatchPanel
        watchlist={watchlist}
        snapshotsBySymbol={{
          PETR4: mockSnapshots.PETR4,
          VALE3: mockSnapshots.VALE3,
        }}
        selectedSymbol="PETR4"
        isLoadingInstruments={false}
        mt5SearchResults={[]}
        mt5SearchLoading={false}
        onSelectSymbol={vi.fn()}
        onAddInstrument={vi.fn()}
        onRemoveInstrument={vi.fn()}
      />,
    )

    const getSymbols = () =>
      screen.getAllByRole('option').map((row) => {
        const symbolCell = row.querySelector('.font-mono.text-xs.font-bold')
        return symbolCell?.textContent ?? ''
      })

    expect(getSymbols()).toEqual(['PETR4', 'VALE3'])

    await user.click(screen.getByRole('button', { name: /symbol/i }))
    expect(getSymbols()[0]).toBe('PETR4')

    await user.click(screen.getByRole('button', { name: /symbol/i }))
    expect(getSymbols()[0]).toBe('VALE3')

    await user.click(screen.getByRole('button', { name: /symbol/i }))
    expect(getSymbols()).toEqual(['PETR4', 'VALE3'])

    expect(
      JSON.parse(localStorage.getItem('quant_watchlist') || '[]').map((i: Instrument) => i.symbol),
    ).toEqual(['PETR4', 'VALE3'])
  })

  it('supports keyboard navigation for select and delete', async () => {
    const user = userEvent.setup()
    const onSelectSymbol = vi.fn()
    const onRemoveInstrument = vi.fn()

    renderWithQueryClient(
      <MarketWatchPanel
        watchlist={[
          equityInstrument('PETR4', 'PETROBRAS PN N2'),
          equityInstrument('VALE3', 'VALE ON NM'),
        ]}
        snapshotsBySymbol={{
          PETR4: mockSnapshots.PETR4,
          VALE3: mockSnapshots.VALE3,
        }}
        selectedSymbol="PETR4"
        isLoadingInstruments={false}
        mt5SearchResults={[]}
        mt5SearchLoading={false}
        onSelectSymbol={onSelectSymbol}
        onAddInstrument={vi.fn()}
        onRemoveInstrument={onRemoveInstrument}
      />,
    )

    const listbox = screen.getByRole('listbox')
    listbox.focus()

    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')
    expect(onSelectSymbol).toHaveBeenCalledWith('VALE3')

    await user.keyboard('{ArrowUp}')
    await user.keyboard('{Delete}')
    expect(onRemoveInstrument).toHaveBeenCalledWith('PETR4')
  })

  it('renders asset-class section headers only when multiple classes exist', () => {
    const { unmount } = renderWithQueryClient(
      <MarketWatchPanel
        watchlist={[
          equityInstrument('PETR4', 'PETROBRAS PN N2'),
          equityInstrument('VALE3', 'VALE ON NM'),
        ]}
        snapshotsBySymbol={{
          PETR4: mockSnapshots.PETR4,
          VALE3: mockSnapshots.VALE3,
        }}
        selectedSymbol="PETR4"
        isLoadingInstruments={false}
        mt5SearchResults={[]}
        mt5SearchLoading={false}
        onSelectSymbol={vi.fn()}
        onAddInstrument={vi.fn()}
        onRemoveInstrument={vi.fn()}
      />,
    )

    expect(screen.queryByText('Stocks')).not.toBeInTheDocument()
    unmount()

    renderWithQueryClient(
      <MarketWatchPanel
        watchlist={[
          equityInstrument('PETR4', 'PETROBRAS PN N2'),
          futureInstrument('WIN$', 'IBOVESPA MINI'),
        ]}
        snapshotsBySymbol={{
          PETR4: mockSnapshots.PETR4,
          WIN$: mockSnapshots['WIN$'],
        }}
        selectedSymbol="PETR4"
        isLoadingInstruments={false}
        mt5SearchResults={[]}
        mt5SearchLoading={false}
        onSelectSymbol={vi.fn()}
        onAddInstrument={vi.fn()}
        onRemoveInstrument={vi.fn()}
      />,
    )

    expect(screen.getByText('Stocks')).toBeInTheDocument()
    expect(screen.getByText('Futures')).toBeInTheDocument()
  })

  it('shows skeleton rows while instruments are loading', () => {
    const { container } = renderWithQueryClient(
      <MarketWatchPanel
        watchlist={[]}
        snapshotsBySymbol={{}}
        selectedSymbol="PETR4"
        isLoadingInstruments
        mt5SearchResults={[]}
        mt5SearchLoading={false}
        onSelectSymbol={vi.fn()}
        onAddInstrument={vi.fn()}
        onRemoveInstrument={vi.fn()}
      />,
    )

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('Loading assets…')).not.toBeInTheDocument()
  })
})
