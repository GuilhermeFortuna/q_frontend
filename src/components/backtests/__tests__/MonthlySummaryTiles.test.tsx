import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MonthlySummaryTiles } from '@/components/backtests/MonthlySummaryTiles'
import type { MonthlyStats } from '@/types/backtesting'

function makeMonth(month: string, pnl: number): MonthlyStats {
  return { month, label: month, pnl, trades: 2, wins: 0, losses: 0, winRate: 0 }
}

describe('MonthlySummaryTiles', () => {
  it('renders nothing when there are no months', () => {
    const { container } = render(<MonthlySummaryTiles monthlyStats={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the monthly roll-up tiles', () => {
    render(
      <MonthlySummaryTiles
        monthlyStats={[
          makeMonth('2025-01', 100),
          makeMonth('2025-02', -50),
          makeMonth('2025-03', 200),
        ]}
      />,
    )

    expect(screen.getByText('Positive Months')).toBeInTheDocument()
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(screen.getByText('+83.33')).toBeInTheDocument()
    expect(screen.getByText('+100.00')).toBeInTheDocument()
    expect(screen.getByText('+200.00')).toBeInTheDocument()
    expect(screen.getByText('-50.00')).toBeInTheDocument()
    expect(screen.getByText('2025-03')).toBeInTheDocument()
    expect(screen.getByText('2025-02')).toBeInTheDocument()
    expect(screen.getByText('2.0 trades / month')).toBeInTheDocument()
  })
})
