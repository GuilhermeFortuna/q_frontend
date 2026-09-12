import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LiveStrategyChart } from '@/components/charts/LiveStrategyChart'
import type { ChartMarker, PrecomputedIndicatorSeries } from '@/components/charts/types/chart'
import type { OhlcvBar } from '@/types/api'

function bar(i: number): OhlcvBar {
  const base = 100 + i
  return {
    timestamp: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
    open: base,
    high: base + 2,
    low: base - 2,
    close: base + 1,
    volume: 1000 + i,
  }
}

const BARS: OhlcvBar[] = Array.from({ length: 6 }, (_, i) => bar(i))

// First two values are warm-up NaNs → null; the rest are contiguous.
const OVERLAY: PrecomputedIndicatorSeries = {
  key: 'ma_short',
  label: 'MA(5)',
  pane: 'price',
  color: '#c9a227',
  values: [null, null, 101, 102, 103, 104],
}

const OSCILLATOR: PrecomputedIndicatorSeries = {
  key: 'osc',
  label: 'Momentum',
  pane: 'oscillator',
  color: '#a78bfa',
  values: [null, null, 10, -5, 8, -3],
}

describe('LiveStrategyChart', () => {
  it('renders precomputed price overlays, skipping null warm-up points', async () => {
    render(
      <LiveStrategyChart
        bars={BARS}
        indicators={[OVERLAY, OSCILLATOR]}
        symbol="WIN$"
        timeframe="H1"
      />,
    )

    const overlay = await screen.findByTestId('live-chart-overlay-ma_short')
    const d = overlay.getAttribute('d') ?? ''
    expect(d).not.toBe('')
    expect(d).not.toContain('NaN')
    // 4 non-null points → one M and three L commands.
    expect((d.match(/[ML]/g) ?? []).length).toBe(4)
  })

  it('renders a dedicated oscillator pane per oscillator series', async () => {
    render(
      <LiveStrategyChart
        bars={BARS}
        indicators={[OVERLAY, OSCILLATOR]}
        symbol="WIN$"
        timeframe="H1"
      />,
    )
    expect(await screen.findByTestId('live-chart-oscillator-osc')).toBeInTheDocument()
  })

  it('renders the live forming bar distinctly and does not extend indicators into it', async () => {
    const forming: OhlcvBar = {
      timestamp: new Date(Date.UTC(2026, 0, 1, 6)).toISOString(),
      open: 105,
      high: 107,
      low: 104,
      close: 106,
      volume: 0,
    }
    render(
      <LiveStrategyChart
        bars={BARS}
        formingBar={forming}
        indicators={[OVERLAY]}
        symbol="WIN$"
        timeframe="H1"
      />,
    )
    const formingGroup = await screen.findByTestId('live-chart-forming-bar')
    expect(formingGroup).toBeInTheDocument()
    // Overlay still only spans the 4 completed non-null points.
    const d = screen.getByTestId('live-chart-overlay-ma_short').getAttribute('d') ?? ''
    expect((d.match(/[ML]/g) ?? []).length).toBe(4)
  })

  it('renders decision/fill markers with hover detail', async () => {
    const markers: ChartMarker[] = [
      {
        id: 'd1',
        timestamp: BARS[3].timestamp,
        kind: 'buy',
        label: 'BUY',
        detail: 'BUY decision\nreason: fast crossed slow',
      },
      {
        id: 'f1',
        timestamp: BARS[4].timestamp,
        kind: 'fill',
        label: 'FILL buy',
        detail: 'FILL buy\nqty: 1\nprice: 104',
        price: 104,
      },
    ]
    render(<LiveStrategyChart bars={BARS} markers={markers} symbol="WIN$" timeframe="H1" />)
    const buyMarker = await screen.findByTestId('live-chart-marker-d1')
    expect(buyMarker).toHaveAttribute('data-kind', 'buy')
    expect(buyMarker.querySelector('title')?.textContent).toContain('fast crossed slow')
    expect(screen.getByTestId('live-chart-marker-f1')).toHaveAttribute('data-kind', 'fill')
  })

  it('shows an empty state when there are no bars', () => {
    render(<LiveStrategyChart bars={[]} symbol="WIN$" timeframe="H1" />)
    expect(screen.getByTestId('live-chart-empty')).toBeInTheDocument()
  })
})
