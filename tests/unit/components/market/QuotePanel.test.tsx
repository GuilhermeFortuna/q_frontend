import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { QuotePanel } from '@/components/market/QuotePanel'
import { formatPrice } from '@/lib/market/format'
import { mockSnapshots } from '@/mocks/data'

describe('QuotePanel', () => {
  it('renders quote stats from a snapshot', () => {
    const snapshot = mockSnapshots.PETR4

    render(<QuotePanel snapshot={snapshot} />)

    expect(screen.getByText(formatPrice(snapshot.last, snapshot.digits))).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText(formatPrice(snapshot.dayOpen, snapshot.digits))).toBeInTheDocument()
    expect(screen.getByText('Prev Close')).toBeInTheDocument()
    expect(screen.getByText(formatPrice(snapshot.prevClose, snapshot.digits))).toBeInTheDocument()
    expect(screen.getByText('Day High')).toBeInTheDocument()
    expect(
      screen.getAllByText(formatPrice(snapshot.dayHigh, snapshot.digits)).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('Day Low')).toBeInTheDocument()
    expect(
      screen.getAllByText(formatPrice(snapshot.dayLow, snapshot.digits)).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('Volume')).toBeInTheDocument()
    expect(screen.getByText(snapshot.volume.toLocaleString())).toBeInTheDocument()
    expect(screen.getByText('Last Update')).toBeInTheDocument()
    expect(screen.getByText('Bid')).toBeInTheDocument()
    expect(screen.getByText(formatPrice(snapshot.bid, snapshot.digits))).toBeInTheDocument()
    expect(screen.getByText(formatPrice(snapshot.ask, snapshot.digits))).toBeInTheDocument()
  })

  it('renders skeleton placeholders without a snapshot', () => {
    const { container } = render(<QuotePanel snapshot={undefined} />)

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('Open')).not.toBeInTheDocument()
  })
})
