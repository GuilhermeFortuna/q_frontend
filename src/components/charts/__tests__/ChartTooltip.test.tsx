import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ChartTooltip, ChartTooltipFromItems } from '@/components/charts/ChartTooltip'

describe('ChartTooltip (WO198)', () => {
  it('renders recharts-shaped payload with label and tabular values', () => {
    render(
      <ChartTooltip
        active
        label="Jan 2024"
        payload={[
          { name: 'Equity', value: 102_450.55, color: '#d99e22' },
          { name: 'Drawdown', value: -2.4, color: '#fb7185' },
        ]}
      />,
    )

    expect(screen.getByText('Jan 2024')).toBeInTheDocument()
    expect(screen.getByText('Equity')).toBeInTheDocument()
    expect(screen.getByText('102450.55')).toBeInTheDocument()
    expect(screen.getByText('Drawdown')).toBeInTheDocument()
    expect(screen.getByText('-2.4')).toBeInTheDocument()
  })

  it('renders visx-shaped items with series color chips', () => {
    render(
      <ChartTooltipFromItems
        active
        label="14:30"
        items={[
          { name: 'Close', value: '125.40', color: '#ffca47' },
          { name: 'Volume', value: '1,240' },
        ]}
      />,
    )

    expect(screen.getByText('14:30')).toBeInTheDocument()
    expect(screen.getByText('Close')).toBeInTheDocument()
    expect(screen.getByText('125.40')).toBeInTheDocument()
    expect(screen.getByText('Volume')).toBeInTheDocument()
    expect(screen.getByText('1,240')).toBeInTheDocument()
  })

  it('returns null when inactive or empty', () => {
    const { container: inactive } = render(
      <ChartTooltip active={false} payload={[{ name: 'x', value: 1 }]} />,
    )
    expect(inactive.firstChild).toBeNull()

    const { container: empty } = render(<ChartTooltip active payload={[]} />)
    expect(empty.firstChild).toBeNull()
  })

  it('applies formatter for recharts numeric values', () => {
    render(
      <ChartTooltip
        active
        payload={[{ name: 'y', value: 1.234567, color: '#34d399' }]}
        formatter={(value) => ({
          name: 'Sharpe',
          value: value.toFixed(2),
          color: '#34d399',
        })}
      />,
    )

    expect(screen.getByText('Sharpe')).toBeInTheDocument()
    expect(screen.getByText('1.23')).toBeInTheDocument()
  })
})
