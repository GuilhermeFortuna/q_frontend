import { describe, expect, it } from 'vitest'

import type { ResearchStudyMetadata, ResearchStudySeriesResponse } from '../../../../contracts/api'
import {
  buildStudyRenderModel,
  mergeIndicatorRenderModels,
  STUDY_SERIES_PALETTE,
} from '@/lib/market/buildStudyRenderModel'
import type { OhlcvBar } from '@/types/api'

function bar(timestamp: string): OhlcvBar {
  return { timestamp, open: 1, high: 1, low: 1, close: 1, volume: 0 } as OhlcvBar
}

const bars = [
  bar('2026-01-05T13:00:00+00:00'),
  bar('2026-01-05T13:10:00+00:00'),
  bar('2026-01-05T13:20:00+00:00'),
  bar('2026-01-05T13:30:00+00:00'),
]

const study: ResearchStudyMetadata = {
  studyId: 'study-1',
  name: 'Keltner 20/2',
  symbol: 'WDO$N',
  timeframe: 'M10',
  notes: null,
  series: [
    {
      key: 'kc_upper',
      label: 'Upper',
      pane: 'price',
      color: '#6eb5ff',
      lineStyle: 'dashed',
      lineWidth: 2,
    },
    {
      key: 'kc_width',
      label: 'Width',
      pane: 'oscillator',
      color: null,
      lineStyle: null,
      lineWidth: null,
    },
  ],
  start: '2026-01-05T13:00:00+00:00',
  end: '2026-01-05T13:30:00+00:00',
  pointCount: 4,
  revision: 1,
  createdAt: '2026-01-05T19:00:00+00:00',
  updatedAt: '2026-01-05T19:00:00+00:00',
  provenance: null,
}

function response(
  timestamps: string[],
  upper: (number | null)[],
  width: (number | null)[],
): ResearchStudySeriesResponse {
  return {
    timestamps,
    series: [
      { key: 'kc_upper', values: upper },
      { key: 'kc_width', values: width },
    ],
  }
}

describe('buildStudyRenderModel', () => {
  it('places each value on the bar with the same instant and labels it with the study name', () => {
    const { model, notices } = buildStudyRenderModel(bars, [
      {
        study,
        response: response(
          [
            '2026-01-05T13:00:00Z',
            '2026-01-05T13:10:00Z',
            '2026-01-05T13:20:00Z',
            '2026-01-05T13:30:00Z',
          ],
          [3, null, 3.2, 3.3],
          [1, 1.1, 1.2, 1.3],
        ),
      },
    ])

    expect(notices).toEqual([])
    expect(model.priceLines).toHaveLength(1)
    const line = model.priceLines[0]
    expect(line.label).toBe('Keltner 20/2 · Upper')
    expect(line.values).toEqual([3, null, 3.2, 3.3])
    expect(line.config.style).toMatchObject({
      color: '#6eb5ff',
      lineStyle: 'dashed',
      strokeWidth: 2,
    })

    expect(model.oscillators).toHaveLength(1)
    expect(model.oscillators[0].label).toBe('Keltner 20/2')
    expect(model.oscillators[0].outputs[0]).toMatchObject({
      label: 'Keltner 20/2 · Width',
      values: [1, 1.1, 1.2, 1.3],
    })
  })

  it('reports values that fall between bars, with the counts, and moves nothing', () => {
    const { model, notices } = buildStudyRenderModel(bars, [
      {
        study,
        response: response(
          [
            '2026-01-05T13:00:00Z',
            '2026-01-05T13:05:00Z',
            '2026-01-05T13:10:00Z',
            '2026-01-05T13:15:00Z',
          ],
          [1, 2, 3, 4],
          [null, null, null, null],
        ),
      },
    ])

    expect(notices).toEqual([
      'Keltner 20/2: 2 of 4 points fall between bars; check the timezone or whether timestamps are bar open times.',
    ])
    expect(model.priceLines[0].values).toEqual([1, 3, null, null])
  })

  it('assigns theme colours to series that set none, in palette order', () => {
    const plain: ResearchStudyMetadata = {
      ...study,
      series: [
        {
          key: 'kc_upper',
          label: 'Upper',
          pane: 'price',
          color: null,
          lineStyle: null,
          lineWidth: null,
        },
      ],
    }
    const { model } = buildStudyRenderModel(bars, [
      {
        study: plain,
        response: { timestamps: [bars[0].timestamp], series: [{ key: 'kc_upper', values: [1] }] },
      },
    ])
    expect(model.priceLines[0].config.style?.color).toBe(STUDY_SERIES_PALETTE[0])
  })

  it('draws nothing without bars', () => {
    const { model } = buildStudyRenderModel([], [{ study, response: response([], [], []) }])
    expect(model).toEqual({ priceLines: [], priceBands: [], oscillators: [] })
  })

  it('keeps catalog indicator entries and study entries side by side', () => {
    const indicators = { priceLines: [], priceBands: [], oscillators: [] }
    const { model } = buildStudyRenderModel(bars, [
      {
        study,
        response: response(
          bars.map((b) => b.timestamp),
          [1, 2, 3, 4],
          [1, 2, 3, 4],
        ),
      },
    ])
    const merged = mergeIndicatorRenderModels(indicators, model)
    expect(merged.priceLines).toHaveLength(1)
    expect(merged.oscillators).toHaveLength(1)
  })
})
