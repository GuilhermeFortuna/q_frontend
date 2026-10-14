import { describe, expect, it } from 'vitest'
import { buildStudyRenderModel } from '@/lib/market/buildStudyRenderModel'
import type { ResearchStudyMetadata, ResearchStudySeriesResponse } from '../../../../contracts/api'
import type { OhlcvBar } from '@/types/api'

const bars: OhlcvBar[] = [0, 1, 2].map((n) => ({
  timestamp: new Date(Date.UTC(2026, 0, 1, n)).toISOString(),
  open: 10,
  high: 12,
  low: 8,
  close: 11,
  volume: 100,
}))
const study: ResearchStudyMetadata = {
  studyId: 'study-1',
  name: 'Signals',
  symbol: 'TEST',
  timeframe: 'H1',
  updatedAt: bars[0].timestamp,
  series: [
    { key: 'upper', label: 'Upper', pane: 'price', kind: 'step', color: '#123456' },
    {
      key: 'entry',
      label: 'Entry',
      pane: 'price',
      kind: 'markers',
      position: 'below-bar',
      shape: 'triangle-up',
    },
    {
      key: 'score',
      label: 'Score',
      pane: 'oscillator',
      kind: 'histogram',
      baseline: -1,
      negativeColor: '#f00',
    },
    {
      key: 'lower',
      label: 'Lower',
      pane: 'price',
      kind: 'line',
      fillTo: 'upper',
      fillOpacity: 0.3,
    },
  ],
} as ResearchStudyMetadata
const response: ResearchStudySeriesResponse = {
  timestamps: bars.map((bar) => bar.timestamp),
  series: [
    { key: 'upper', values: [10, null, 12] },
    { key: 'entry', values: [0, 1, 0] },
    { key: 'score', values: [-2, 0, 3] },
    { key: 'lower', values: [8, 9, 10] },
  ],
}

describe('buildStudyRenderModel plot metadata', () => {
  it('keeps each kind and aligns fill targets and histogram styling to chart bars', () => {
    const { model } = buildStudyRenderModel(bars, [{ study, response }])
    expect(model.priceLines.map(({ kind }) => kind)).toEqual(['step', 'markers', 'line'])
    expect(model.priceLines[2].fillValues).toEqual([10, null, 12])
    expect(model.priceLines[1].position).toBe('below-bar')
    expect(model.oscillators[0].outputs[0]).toMatchObject({
      kind: 'histogram',
      baseline: -1,
      negativeColor: '#f00',
    })
  })

  it('defaults metadata from studies without a kind to line', () => {
    const legacy = {
      ...study,
      series: [{ key: 'upper', label: 'Upper', pane: 'price' }],
    } as ResearchStudyMetadata
    const { model } = buildStudyRenderModel(bars, [{ study: legacy, response }])
    expect(model.priceLines[0].kind).toBe('line')
  })
})
