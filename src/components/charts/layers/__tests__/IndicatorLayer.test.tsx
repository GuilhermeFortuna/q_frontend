import { render, screen } from '@testing-library/react'
import { scaleBand, scaleLinear } from '@visx/scale'
import { describe, expect, it } from 'vitest'
import { IndicatorLayer } from '@/components/charts/layers/IndicatorLayer'
import type { ProcessedBar } from '@/components/charts/types/chart'
import type { IndicatorRenderModel } from '@/lib/market/buildIndicatorRenderModel'
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
const xScale = scaleBand<string>({
  domain: bars.map((bar) => bar.timestamp),
  range: [0, 100],
  padding: 0.2,
})
const yScale = scaleLinear<number>({ domain: [0, 20], range: [100, 0] })
const model: IndicatorRenderModel = {
  priceBands: [],
  oscillators: [],
  priceLines: [
    {
      kind: 'markers',
      instanceKey: 'entry',
      catalogId: 'study:s',
      outputKey: 'entry',
      label: 'Signals · Entry',
      values: [0, 1, 0],
      position: 'below-bar',
      shape: 'triangle-up',
      size: 8,
      studyName: 'Signals',
      seriesLabel: 'Entry',
      config: { id: 'study:s', enabled: true, parameters: {}, style: { color: '#26a69a' } },
    },
    {
      kind: 'line',
      instanceKey: 'bottom',
      catalogId: 'study:s',
      outputKey: 'bottom',
      label: 'Signals · Bottom',
      values: [8, 9, 10],
      fillValues: [10, 11, 12],
      fillOpacity: 0.3,
      config: { id: 'study:s', enabled: true, parameters: {}, style: { color: '#c9a227' } },
    },
  ],
}

describe('IndicatorLayer study plots', () => {
  it('draws non-zero markers only in the visible range with the study tooltip', () => {
    render(
      <svg>
        <IndicatorLayer
          allBars={bars}
          visibleBars={visible.slice(0, 2)}
          xScale={xScale}
          yScale={yScale}
          model={model}
          left={0}
          phase="overlays"
        />
      </svg>,
    )
    expect(screen.getAllByTestId('market-study-marker-entry')).toHaveLength(1)
    expect(
      screen.getByTestId('market-study-marker-entry').querySelector('title')?.textContent,
    ).toBe('Signals · Entry: 1')
  })

  it('renders study fills in the underlay phase at the configured opacity', () => {
    render(
      <svg>
        <IndicatorLayer
          allBars={bars}
          visibleBars={visible}
          xScale={xScale}
          yScale={yScale}
          model={model}
          left={0}
          phase="fills"
        />
      </svg>,
    )
    const fill = screen.getByTestId('market-study-fill-bottom')
    expect(fill.getAttribute('fill-opacity')).toBe('0.3')
    expect(fill.getAttribute('d')).toContain('Z')
  })
})
