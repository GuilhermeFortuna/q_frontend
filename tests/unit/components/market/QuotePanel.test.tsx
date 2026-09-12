import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { QuotePanel } from '@/components/market/QuotePanel'
import { formatPrice } from '@/lib/market/format'
import { mockSnapshots } from '@/mocks/data'

describe('QuotePanel', () => {
  it('renders quote stats from a snapshot', () => {
    const snapshot = mockSnapshots.PETR4

    render(<QuotePanel snapshot={snapshot} />)

    expect(screen.getByLabelText(formatPrice(snapshot.last, snapshot.digits))).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(
      screen.getByLabelText(formatPrice(snapshot.dayOpen, snapshot.digits)),
    ).toBeInTheDocument()
    expect(screen.getByText('Prev Close')).toBeInTheDocument()
    expect(screen.getByText(formatPrice(snapshot.prevClose, snapshot.digits))).toBeInTheDocument()
    expect(screen.getByText('Day High')).toBeInTheDocument()
    expect(
      screen.getByLabelText(formatPrice(snapshot.dayHigh, snapshot.digits)),
    ).toBeInTheDocument()
    expect(screen.getByText('Day Low')).toBeInTheDocument()
    expect(screen.getByLabelText(formatPrice(snapshot.dayLow, snapshot.digits))).toBeInTheDocument()
    expect(screen.getByText('Volume')).toBeInTheDocument()
    expect(screen.getByLabelText(snapshot.volume.toLocaleString())).toBeInTheDocument()
    expect(screen.getByText('Last Update')).toBeInTheDocument()
    expect(screen.getByText('Bid')).toBeInTheDocument()
    expect(screen.getByText(formatPrice(snapshot.bid, snapshot.digits))).toBeInTheDocument()
    expect(screen.getByText(formatPrice(snapshot.ask, snapshot.digits))).toBeInTheDocument()
  })

  it('passes numeric values into QuantNumberFlow before formatting for live quote KPIs', () => {
    const snapshot = mockSnapshots.PETR4
    render(<QuotePanel snapshot={snapshot} />)

    const flows = Array.from(document.querySelectorAll('[data-quant-number-flow]'))
    const values = flows.map((node) => node.getAttribute('data-value'))

    expect(values).toEqual(
      expect.arrayContaining([
        String(snapshot.last),
        String(snapshot.dayOpen),
        String(snapshot.dayHigh),
        String(snapshot.dayLow),
        String(snapshot.volume),
      ]),
    )
    expect(values).toHaveLength(5)

    // Prev Close and Last Update remain static strings — no flow node for them.
    const prevClose = screen.getByText('Prev Close').parentElement
    expect(prevClose?.querySelector('[data-quant-number-flow]')).toBeNull()
    const lastUpdate = screen.getByText('Last Update').parentElement
    expect(lastUpdate?.querySelector('[data-quant-number-flow]')).toBeNull()
  })

  it('renders skeleton placeholders without a snapshot', () => {
    const { container } = render(<QuotePanel snapshot={undefined} />)

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('Open')).not.toBeInTheDocument()
  })
})
