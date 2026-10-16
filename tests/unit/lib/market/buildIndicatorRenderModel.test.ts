import { describe, expect, it } from 'vitest'

import {
  requestableIndicators,
  seriesByInstance,
  unknownIndicatorIds,
} from '@/api/queries/marketIndicators'
import { buildIndicatorRenderModel } from '@/lib/market/buildIndicatorRenderModel'
import type { IndicatorConfig } from '@/lib/market/indicatorConfig'
import { alignSeriesValuesToBars } from '@/lib/market/indicatorSeriesAlign'
import { mockIndicatorCatalog } from '@/mocks/marketIndicators'
import type { OhlcvBar } from '@/types/api'
import type { MarketIndicatorSeriesResponse } from '../../../../contracts/api'

const catalog = mockIndicatorCatalog.indicators

const bars: OhlcvBar[] = [0, 1, 2].map((index) => ({
  timestamp: new Date(Date.UTC(2024, 0, 2, 12, 10 * index)).toISOString(),
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1,
}))
// The backend spells the same instants without milliseconds.
const backendTimestamps = bars.map((bar) => bar.timestamp.replace('.000Z', 'Z'))

const sma: IndicatorConfig = { id: 'sma', enabled: true, parameters: { period: 5 } }
const rsi: IndicatorConfig = { id: 'rsi', enabled: true, parameters: { period: 14 } }
const donchian: IndicatorConfig = { id: 'donchian', enabled: true, parameters: { period: 20 } }

function line(values: (number | null)[], pane = 'price') {
  return { key: 'line', pane, values }
}

function respond(indicators: IndicatorConfig[], response: MarketIndicatorSeriesResponse) {
  return seriesByInstance(response, requestableIndicators(indicators, catalog))
}

describe('alignSeriesValuesToBars', () => {
  it('joins on the instant, whatever the timestamp spelling', () => {
    expect(alignSeriesValuesToBars([bars[0].timestamp], [backendTimestamps[0]], [7])).toEqual([7])
    expect(bars[0].timestamp).not.toBe(backendTimestamps[0])
  })

  it('leaves a bar the series does not cover empty', () => {
    // The same wall-clock times read three hours earlier: different instants, no match.
    const threeHoursEarlier = [
      '2024-01-02T09:00:00Z',
      '2024-01-02T09:10:00Z',
      '2024-01-02T09:20:00Z',
    ]
    expect(
      alignSeriesValuesToBars(
        bars.map((bar) => bar.timestamp),
        threeHoursEarlier,
        [1, 2, 3],
      ),
    ).toEqual([null, null, null])
  })
})

describe('buildIndicatorRenderModel', () => {
  it('draws each series under the indicator that requested it', () => {
    const selection = [sma, rsi]
    const series = respond(selection, {
      timestamps: backendTimestamps,
      series: [line([1, 2, 3]), line([40, 50, 60], 'oscillator')],
    })
    const model = buildIndicatorRenderModel(bars, selection, catalog, series)
    expect(model.priceLines.map((group) => [group.catalogId, group.values])).toEqual([
      ['sma', [1, 2, 3]],
    ])
    expect(model.oscillators.map((group) => [group.catalogId, group.outputs[0].values])).toEqual([
      ['rsi', [40, 50, 60]],
    ])
  })

  it('never draws a previous response under a changed selection', () => {
    const previous = respond([sma, rsi], {
      timestamps: backendTimestamps,
      series: [line([1, 2, 3]), line([40, 50, 60], 'oscillator')],
    })

    // SMA removed: the RSI pane keeps its own values instead of inheriting SMA's.
    const afterRemoval = buildIndicatorRenderModel(bars, [rsi], catalog, previous)
    expect(afterRemoval.priceLines).toEqual([])
    expect(afterRemoval.oscillators[0].outputs[0].values).toEqual([40, 50, 60])

    // Reordered: positions changed, the pairing did not.
    const reordered = buildIndicatorRenderModel(bars, [rsi, sma], catalog, previous)
    expect(reordered.priceLines[0].values).toEqual([1, 2, 3])
    expect(reordered.oscillators[0].outputs[0].values).toEqual([40, 50, 60])

    // Parameters changed: nothing is drawn for the new instance until its response arrives.
    const retuned = { ...sma, parameters: { period: 50 } }
    expect(buildIndicatorRenderModel(bars, [retuned], catalog, previous).priceLines).toEqual([])
  })

  it('leaves an identifier the catalog does not list out of the request and reports it', () => {
    const stale: IndicatorConfig = { id: 'retired_indicator', enabled: true, parameters: {} }
    const selection = [stale, sma]
    expect(requestableIndicators(selection, catalog).map((item) => item.config.id)).toEqual(['sma'])
    expect(unknownIndicatorIds(selection, catalog)).toEqual(['retired_indicator'])

    const series = respond(selection, { timestamps: backendTimestamps, series: [line([1, 2, 3])] })
    const model = buildIndicatorRenderModel(bars, selection, catalog, series)
    expect(model.priceLines.map((group) => group.values)).toEqual([[1, 2, 3]])
  })

  it('draws value area levels as step series from catalog output kind', () => {
    const config: IndicatorConfig = {
      id: 'value_area_levels',
      enabled: true,
      parameters: { mode: 'developing', row_ticks: 1, value_area: 0.7 },
    }
    const series = respond([config], {
      timestamps: backendTimestamps,
      series: [
        { key: 'poc', pane: 'price', values: [100, 101, 102] },
        { key: 'vah', pane: 'price', values: [101, 102, 103] },
        { key: 'val', pane: 'price', values: [99, 100, 101] },
      ],
    })
    const model = buildIndicatorRenderModel(bars, [config], catalog, series)
    expect(model.priceLines.map((line) => [line.outputKey, line.kind])).toEqual([
      ['poc', 'step'],
      ['vah', 'step'],
      ['val', 'step'],
    ])
  })

  it('draws Donchian from the two backend outputs and computes no middle band', () => {
    const series = respond([donchian], {
      timestamps: backendTimestamps,
      series: [
        { key: 'upper', pane: 'price', values: [3, 3, 3] },
        { key: 'lower', pane: 'price', values: [1, 1, 1] },
      ],
    })
    const [bands] = buildIndicatorRenderModel(bars, [donchian], catalog, series).priceBands
    expect(bands.upper).toEqual([3, 3, 3])
    expect(bands.lower).toEqual([1, 1, 1])
    expect(bands.middle).toBeUndefined()
  })
})
