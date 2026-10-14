import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import {
  StrategyIndicatorLayer,
  StrategyOscillatorLayer,
} from '@/components/backtests/StrategyIndicatorLayer'
import type { BandScale, LinearScale } from '@/components/charts/types/scales'
import type { ProcessedBar } from '@/components/charts/types/chart'
import type { ChartIndicatorSeries } from '@/types/backtesting'
import type { OhlcvBar } from '@/types/api'

const bars: OhlcvBar[] = Array.from({ length: 7 }, (_, i) => ({
  timestamp: `t${i}`,
  open: 5,
  high: 10 + i,
  low: 1,
  close: 5,
  volume: 1,
}))

const processed: ProcessedBar[] = bars.map((bar, index) => ({
  ...bar,
  index,
  timeMs: index,
  isBullish: true,
  color: '#ffffff',
}))

// Bar i sits at x = 10 * i with an 8 px band; price 100 - value maps to y.
const xScale = Object.assign((ts: string) => bars.findIndex((bar) => bar.timestamp === ts) * 10, {
  bandwidth: () => 8,
  range: () => [0, 70],
}) as unknown as BandScale
const yScale = ((value: number) => 100 - value) as unknown as LinearScale

function series(
  overrides: Partial<ChartIndicatorSeries> & Pick<ChartIndicatorSeries, 'key' | 'values'>,
) {
  return { label: overrides.key, pane: 'price', ...overrides } as ChartIndicatorSeries
}

function renderPrice(indicators: ChartIndicatorSeries[]) {
  return render(
    <svg>
      <StrategyIndicatorLayer
        allBars={bars}
        visibleBars={processed}
        xScale={xScale}
        yScale={yScale}
        indicators={indicators}
        left={0}
      />
    </svg>,
  )
}

describe('StrategyIndicatorLayer plot kinds', () => {
  it('draws a segment from its start bar to the bar holding its value', () => {
    const { getByTestId } = renderPrice([
      series({
        key: 'top',
        kind: 'segment',
        values: [null, null, null, null, null, 10, null],
        start_index: [null, null, null, null, null, 2, null],
        color: '#26a69a',
      }),
    ])
    // start bar 2 at x 24, end bar 5 at x 54, both at y 90
    expect(getByTestId('backtest-indicator-segment-top').getAttribute('d')).toBe('M 24 90 L 54 90')
  })

  it('clamps a segment that starts before the visible window to its first bar', () => {
    const windowed = { allBars: bars, visibleBars: processed.slice(3), xScale, yScale }
    const { getByTestId } = render(
      <svg>
        <StrategyIndicatorLayer
          {...windowed}
          indicators={[
            series({
              key: 'top',
              kind: 'segment',
              values: [null, null, null, null, null, 10, null],
              start_index: [null, null, null, null, null, 0, null],
            }),
          ]}
          left={0}
        />
      </svg>,
    )
    expect(getByTestId('backtest-indicator-segment-top').getAttribute('d')).toBe('M 34 90 L 54 90')
  })

  it('skips segments that end outside the visible window', () => {
    const { getByTestId } = render(
      <svg>
        <StrategyIndicatorLayer
          allBars={bars}
          visibleBars={processed.slice(0, 3)}
          xScale={xScale}
          yScale={yScale}
          indicators={[
            series({
              key: 'top',
              kind: 'segment',
              values: [null, null, null, null, null, 10, null],
              start_index: [null, null, null, null, null, 2, null],
            }),
          ]}
          left={0}
        />
      </svg>,
    )
    expect(getByTestId('backtest-indicator-segment-top').getAttribute('d')).toBe('')
  })

  it('draws one marker per non-null value and skips zeros for above-bar markers', () => {
    const { getAllByTestId, container } = renderPrice([
      series({
        key: 'entry',
        kind: 'markers',
        shape: 'triangle-up',
        values: [1, null, 0, 2, null, null, null],
      }),
      series({
        key: 'flag',
        kind: 'markers',
        position: 'above-bar',
        values: [0, 1, 0, 1, null, null, null],
      }),
    ])
    expect(getAllByTestId('backtest-indicator-marker-entry')).toHaveLength(3)
    expect(getAllByTestId('backtest-indicator-marker-flag')).toHaveLength(2)
    expect(container.querySelectorAll('title').length).toBe(5)
  })

  it('draws a fill beneath the lines when fill_to names another series in the pane', () => {
    const { getByTestId } = renderPrice([
      series({ key: 'upper', values: [5, 5, 5, 5, 5, 5, 5] }),
      series({ key: 'lower', values: [1, 1, 1, 1, 1, 1, 1], fill_to: 'upper', fill_opacity: 0.3 }),
    ])
    expect(getByTestId('backtest-indicator-fill-lower').getAttribute('fill-opacity')).toBe('0.3')
  })

  it('keeps results without a kind drawing as lines', () => {
    const { getByTestId } = renderPrice([
      series({ key: 'sma', values: [null, 1, 2, 3, null, null, null] }),
    ])
    expect(getByTestId('backtest-indicator-line-sma').getAttribute('d')).toMatch(/^M .* L /)
  })

  it('draws histogram bars from the baseline, using the negative colour below it', () => {
    const { getAllByTestId } = render(
      <svg>
        <StrategyOscillatorLayer
          allBars={bars}
          visibleBars={processed}
          xScale={xScale}
          yScale={((value: number) => 50 - value) as unknown as LinearScale}
          indicators={[
            series({
              key: 'score',
              pane: 'oscillator',
              kind: 'histogram',
              negative_color: '#ef5350',
              color: '#26a69a',
              values: [1, -2, null, 3, null, null, null],
            }),
          ]}
          top={0}
          height={100}
          left={0}
        />
      </svg>,
    )
    const histogram = getAllByTestId('backtest-indicator-histogram-score')
    expect(histogram).toHaveLength(3)
    expect(histogram.map((rect) => rect.getAttribute('fill'))).toEqual([
      '#26a69a',
      '#ef5350',
      '#26a69a',
    ])
  })
})
