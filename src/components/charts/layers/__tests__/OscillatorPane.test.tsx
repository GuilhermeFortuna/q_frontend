import { render } from '@testing-library/react'
import { scaleBand, scaleLinear } from '@visx/scale'
import { describe, expect, it } from 'vitest'
import { OscillatorPane } from '@/components/charts/layers/OscillatorPane'
import type { OscillatorRenderGroup } from '@/lib/market/buildIndicatorRenderModel'
import type { ProcessedBar } from '@/components/charts/types/chart'
import type { OhlcvBar } from '@/types/api'

const bars: OhlcvBar[] = [0, 1, 2].map((i) => ({
  timestamp: `2026-01-01T0${i}:00:00Z`,
  open: 10,
  high: 12,
  low: 8,
  close: 11,
  volume: 100,
}))
const visible = bars.map((bar, index) => ({
  ...bar,
  index,
  timeMs: Date.parse(bar.timestamp),
  isBullish: true,
  color: '#26a69a',
})) as ProcessedBar[]
const group: OscillatorRenderGroup = {
  instanceKey: 'study:s',
  catalogId: 'study:s',
  label: 'Momentum',
  config: { id: 'study:s', enabled: true, parameters: {}, style: { color: '#6eb5ff' } },
  outputs: [
    {
      outputKey: 'regime',
      label: 'Momentum · Regime',
      values: [1, 2, null],
      kind: 'step',
      color: '#6eb5ff',
    },
    {
      outputKey: 'score',
      label: 'Momentum · Score',
      values: [-2, 0, 3],
      kind: 'histogram',
      baseline: -1,
      color: '#26a69a',
      negativeColor: '#ef5350',
    },
  ],
}

describe('OscillatorPane study plots', () => {
  it('draws held step values with gaps and histogram columns from the configured baseline', () => {
    const xScale = scaleBand<string>({
      domain: bars.map((bar) => bar.timestamp),
      range: [0, 100],
      padding: 0.2,
    })
    const yScale = scaleLinear<number>({ domain: [-3, 4], range: [100, 0] })
    render(
      <svg>
        <OscillatorPane
          allBars={bars}
          visibleBars={visible}
          xScale={xScale}
          yScale={yScale}
          top={0}
          height={100}
          left={0}
          group={group}
        />
      </svg>,
    )
    const path = document.querySelector('path[stroke="#6eb5ff"]')
    expect(path?.getAttribute('d')).toContain('H')
    expect(document.querySelector('rect[fill="#ef5350"]')).toBeTruthy()
    expect(document.querySelector('rect[fill="#26a69a"]')).toBeTruthy()
  })
})
