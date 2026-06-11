import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MarketWatchPanel } from '@/components/market/MarketWatchPanel'
import { formatPrice } from '@/lib/market/format'
import { mockSnapshots } from '@/mocks/data'

describe('MarketWatchPanel', () => {
  it('renders watchlist rows and fires selection callbacks', async () => {
    const user = userEvent.setup()
    const onSelectSymbol = vi.fn()
    const snapshot = mockSnapshots.PETR4

    render(
      <MarketWatchPanel
        watchlist={[
          {
            symbol: 'PETR4',
            name: 'PETROBRAS PN N2',
            exchange: 'BOVESPA',
            assetClass: 'equity',
          },
        ]}
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
})
