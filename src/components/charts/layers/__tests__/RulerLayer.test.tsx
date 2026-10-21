import { render, screen } from '@testing-library/react'
import { scaleBand, scaleLinear } from '@visx/scale'
import { describe, expect, it } from 'vitest'
import { RulerLayer } from '@/components/charts/layers/RulerLayer'
import { timeMapperFromScale } from '@/components/charts/drawings/timeMapping'
import { measureRuler } from '@/components/charts/ruler'

const HOUR_MS = 3_600_000
const START = Date.UTC(2026, 0, 5, 10)
const times = [0, 1, 2, 3].map((i) => START + i * HOUR_MS)
const xScale = scaleBand<string>({
  domain: times.map((time) => String(time)),
  range: [0, 400],
  padding: 0.2,
})
const mapper = timeMapperFromScale(xScale, 0, times, HOUR_MS, 0)
const priceScale = scaleLinear<number>({ domain: [0, 20], range: [200, 0] })
const layout = { priceTop: 0, priceHeight: 200, innerWidth: 400 }

describe('RulerLayer', () => {
  it('labels the price delta and the candle span between its points', () => {
    const start = { time: times[0], price: 10 }
    const end = { time: times[3], price: 12.5 }
    const measurement = measureRuler(start, end, mapper.positionOfTime)

    render(
      <svg>
        <RulerLayer
          start={start}
          end={end}
          measurement={measurement}
          mapper={mapper}
          priceScale={priceScale}
          layout={layout}
          left={0}
          digits={2}
        />
      </svg>,
    )

    expect(screen.getByTestId('chart-ruler-price')).toHaveTextContent('+2.50 (+25.00%)')
    expect(screen.getByTestId('chart-ruler-span')).toHaveTextContent('3 bars · 3h 0m')
  })
})
