import { describe, expect, it } from 'vitest'

import { buildChartMarkers } from '@/workspaces/execution/liveChartMarkers'
import type { Decision, Fill } from '@/types/execution'

const BARS = [
  { timestamp: '2026-06-30T10:00:00.000Z' },
  { timestamp: '2026-06-30T11:00:00.000Z' },
  { timestamp: '2026-06-30T12:00:00.000Z' },
]

function decision(overrides: Partial<Decision>): Decision {
  return {
    id: 'dec',
    deployment_id: 'dep',
    bar_close_time: '2026-06-30T11:00:00.000Z',
    strategy_name: 'MACrossover',
    strategy_version: 1,
    config_hash: 'h',
    symbol: 'WIN$',
    timeframe: 'H1',
    signal_action: 'buy',
    outcome: 'submitted',
    requested_quantity: '1',
    reason: 'fast crossed slow',
    created_at: '2026-06-30T11:00:00.000Z',
    ...overrides,
  }
}

function fill(overrides: Partial<Fill>): Fill {
  return {
    id: 'fill',
    deployment_id: 'dep',
    order_id: 'ord',
    broker_mode: 'paper',
    external_fill_id: 'ext',
    side: 'buy',
    quantity: '1.00',
    price: '132000.00',
    fee: '0',
    slippage: '0',
    filled_at: '2026-06-30T11:30:00.000Z',
    created_at: '2026-06-30T11:30:00.000Z',
    ...overrides,
  }
}

describe('buildChartMarkers', () => {
  it('skips hold decisions', () => {
    const markers = buildChartMarkers({
      decisions: [decision({ id: 'h', signal_action: 'hold' })],
      fills: [],
      bars: BARS,
      timeframe: 'H1',
    })
    expect(markers).toHaveLength(0)
  })

  it('maps a decision whose close time coincides with a bar open', () => {
    const markers = buildChartMarkers({
      decisions: [decision({ id: 'b', signal_action: 'buy', bar_close_time: BARS[1].timestamp })],
      fills: [],
      bars: BARS,
      timeframe: 'H1',
    })
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({ timestamp: BARS[1].timestamp, kind: 'buy' })
  })

  it('falls back to close − timeframe when the close time is not a bar open', () => {
    const markers = buildChartMarkers({
      decisions: [
        decision({ id: 's', signal_action: 'sell', bar_close_time: '2026-06-30T13:00:00.000Z' }),
      ],
      fills: [],
      bars: BARS,
      timeframe: 'H1',
    })
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({ timestamp: BARS[2].timestamp, kind: 'sell' })
  })

  it('drops decisions that fall outside the chart window', () => {
    const markers = buildChartMarkers({
      decisions: [
        decision({ id: 'old', signal_action: 'buy', bar_close_time: '2026-06-30T08:00:00.000Z' }),
      ],
      fills: [],
      bars: BARS,
      timeframe: 'H1',
    })
    expect(markers).toHaveLength(0)
  })

  it('maps a fill to the bar whose window contains it', () => {
    const markers = buildChartMarkers({
      decisions: [],
      fills: [fill({ id: 'f1', price: '104.5', filled_at: '2026-06-30T11:30:00.000Z' })],
      bars: BARS,
      timeframe: 'H1',
    })
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({
      timestamp: BARS[1].timestamp,
      kind: 'fill',
      price: 104.5,
    })
  })
})
