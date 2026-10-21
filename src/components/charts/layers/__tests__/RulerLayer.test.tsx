import { render, screen } from '@testing-library/react'
import { scaleBand, scaleLinear } from '@visx/scale'
import { describe, expect, it } from 'vitest'
import { RulerLayer } from '@/components/charts/layers/RulerLayer'
import { processBars } from '@/components/charts/hooks/useChartScales'
import { measureRuler } from '@/components/charts/ruler'
import type { OhlcvBar } from '@/types/api'

const HOUR_MS = 3_600_000
const bars: OhlcvBar[] = [0, 1, 2, 3].map((i) => ({
  timestamp: new Date(Date.UTC(2026, 0, 5, 10) + i * HOUR_MS).toISOString(),
  open: 10,
  high: 12,
  low: 8,
  close: 11,
  volume: 100,
}))
const processed = processBars(bars)
const xScale = scaleBand<string>({
  domain: bars.map((bar) => bar.timestamp),
  range: [0, 400],
  padding: 0.2,
})
const priceScale = scaleLinear<number>({ domain: [0, 20], range: [200, 0] })
const layout = { priceTop: 0, priceHeight: 200, innerWidth: 400 }

describe('RulerLayer', () => {
  it('labels the price delta and the candle span between its points', () => {
    const start = { timestamp: bars[0].timestamp, price: 10 }
    const end = { timestamp: bars[3].timestamp, price: 12.5 }
    const measurement = measureRuler(start, end, processed)!

    render(
      <svg>
        <RulerLayer
          start={start}
          end={end}
          measurement={measurement}
          xScale={xScale}
          priceScale={priceScale}
          allBars={processed}
          layout={layout}
          left={0}
        />
      </svg>,
    )

    expect(screen.getByTestId('chart-ruler-price')).toHaveTextContent('+2.50 (+25.00%)')
    expect(screen.getByTestId('chart-ruler-span')).toHaveTextContent('3 bars · 3h 0m')
  })

  it('renders nothing when there are no bars to place the points on', () => {
    const start = { timestamp: bars[0].timestamp, price: 10 }
    const end = { timestamp: bars[1].timestamp, price: 12 }
    const measurement = { priceDelta: 2, percentDelta: 20, bars: 1, durationMs: HOUR_MS }

    const { container } = render(
      <svg>
        <RulerLayer
          start={start}
          end={end}
          measurement={measurement}
          xScale={xScale}
          priceScale={priceScale}
          allBars={[]}
          layout={layout}
          left={0}
        />
      </svg>,
    )

    expect(container.querySelector('[data-testid="chart-ruler"]')).toBeNull()
  })
})
