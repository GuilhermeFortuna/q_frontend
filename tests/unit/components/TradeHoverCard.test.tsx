import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TradeHoverCard } from '@/components/backtests/TradeHoverCard'
import type { Trade } from '@/types/backtesting'

const trade: Trade = {
  id: 't1',
  order_id: 'o1',
  symbol: 'WDO$N',
  action: 'BUY',
  quantity: 1,
  entry_time: '2024-01-02T10:00:00-03:00',
  entry_price: 100,
  exit_time: '2024-01-02T10:30:00-03:00',
  exit_price: 99,
  status: 'CLOSED',
  pnl: -10,
  commission: 0,
  point_value: 10,
  exit_reason: 'breakeven',
}

function renderCard(exit_resolution?: Trade['exit_resolution']) {
  return render(
    <TradeHoverCard
      trade={{ ...trade, exit_resolution }}
      x={100}
      y={100}
      containerWidth={800}
      containerHeight={600}
    />,
  )
}

describe('TradeHoverCard exit basis', () => {
  it('labels an exit decided on a substituted minute as approximate', () => {
    renderCard('minute')

    expect(screen.getByText('Exit Basis')).toBeInTheDocument()
    expect(screen.getByText('Approximate: one-minute bar')).toBeInTheDocument()
  })

  it('labels an exit decided on candle prices as approximate', () => {
    renderCard('candle')

    expect(screen.getByText('Approximate: candle prices')).toBeInTheDocument()
  })

  it.each([
    ['tick', 'tick'],
    ['closed bar', null],
    ['absent', undefined],
  ])('omits the exit basis for %s', (_label, resolution) => {
    renderCard(resolution as Trade['exit_resolution'])

    expect(screen.queryByText('Exit Basis')).not.toBeInTheDocument()
  })
})
