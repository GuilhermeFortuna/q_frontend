import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { QuoteRibbon } from '@/components/market/QuoteRibbon'
import { mockSnapshots } from '@/mocks/data'

describe('QuoteRibbon', () => {
  it('renders symbol details and toggles the sidebar', async () => {
    const user = userEvent.setup()
    const onToggleSidebar = vi.fn()
    const snapshot = mockSnapshots.PETR4

    render(
      <QuoteRibbon
        symbol="PETR4"
        instrument={{
          symbol: 'PETR4',
          name: 'PETROBRAS PN N2',
          exchange: 'BOVESPA',
          assetClass: 'equity',
        }}
        activeBar={{
          timestamp: '2026-06-09T00:00:00.000Z',
          open: 41.2,
          high: 41.5,
          low: 40.9,
          close: 41.08,
          volume: 1000,
        }}
        snapshot={snapshot}
        connectionStatus="live"
        priceDigits={2}
        sidebarCollapsed={false}
        onToggleSidebar={onToggleSidebar}
      />,
    )

    expect(screen.getByText('PETR4')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByText('PETROBRAS PN N2')).toBeInTheDocument()

    await user.click(screen.getByTitle('Toggle Market Watch Panel'))
    expect(onToggleSidebar).toHaveBeenCalledTimes(1)
  })
})
