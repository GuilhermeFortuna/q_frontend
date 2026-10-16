import catalogJson from '@/mocks/data/indicatorCatalog.json'
import type {
  IndicatorCatalogResponse,
  MarketIndicatorSeriesRequest,
  MarketIndicatorSeriesResponse,
  MarketVolumeProfileRequest,
  MarketVolumeProfileResponse,
} from '../../contracts/api'
import { sessionDayKey } from '@/lib/market/volumeProfileConfig'
import type { OhlcvBar } from '@/types/api'

export const mockIndicatorCatalog = catalogJson as IndicatorCatalogResponse

const catalogById = new Map(mockIndicatorCatalog.indicators.map((entry) => [entry.id, entry]))

function smaValues(closes: number[], period: number): (number | null)[] {
  return closes.map((_, index) => {
    if (index + 1 < period) return null
    const slice = closes.slice(index + 1 - period, index + 1)
    return slice.reduce((sum, value) => sum + value, 0) / period
  })
}

function rsiValues(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = 0; i < closes.length; i += 1) {
    if (i < period) {
      out.push(null)
      continue
    }
    let gains = 0
    let losses = 0
    for (let j = i - period + 1; j <= i; j += 1) {
      const delta = closes[j] - closes[j - 1]
      if (delta >= 0) gains += delta
      else losses -= delta
    }
    if (losses === 0) {
      out.push(100)
    } else {
      const rs = gains / losses
      out.push(100 - 100 / (1 + rs))
    }
  }
  return out
}

function atrFractionValues(bars: OhlcvBar[], period: number): (number | null)[] {
  const tr: number[] = []
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i]
    const prevClose = i > 0 ? bars[i - 1].close : bar.close
    tr.push(
      Math.max(bar.high - bar.low, Math.abs(bar.high - prevClose), Math.abs(bar.low - prevClose)),
    )
  }
  const atr = smaValues(tr, period)
  return atr.map((value, index) => (value == null ? null : value / bars[index].close))
}

export function mockMarketIndicatorSeries(
  bars: OhlcvBar[],
  body: MarketIndicatorSeriesRequest,
): MarketIndicatorSeriesResponse {
  const timestamps = bars.map((bar) => bar.timestamp)
  const closes = bars.map((bar) => bar.close)
  const series: MarketIndicatorSeriesResponse['series'] = []

  for (const request of body.indicators) {
    const entry = catalogById.get(request.id)
    if (!entry) continue

    if (request.id === 'quote_spread') {
      for (const _output of entry.outputs) {
        series.push({
          key: _output.key,
          pane: _output.pane,
          unit: entry.unit,
          values: timestamps.map(() => null),
          unavailableReason: 'No tick history for this range (mock)',
        })
      }
      continue
    }

    if (request.id === 'value_area_levels') {
      const base = closes[closes.length - 1] ?? 100
      for (const output of entry.outputs) {
        const offset = output.key === 'poc' ? 0 : output.key === 'vah' ? 0.5 : -0.5
        series.push({
          key: output.key,
          pane: output.pane,
          unit: entry.unit,
          values: closes.map((_, index) => (index < 2 ? null : base + offset)),
          unavailableReason: null,
        })
      }
      continue
    }

    const periodRaw = request.parameters?.period
    const period = typeof periodRaw === 'number' ? periodRaw : 14

    for (const output of entry.outputs) {
      let values: (number | null)[]
      if (request.id === 'atr_fraction' && output.key === 'line') {
        values = atrFractionValues(bars, period)
      } else if (output.key === 'line' && (request.id === 'sma' || request.id === 'ema')) {
        values = smaValues(closes, period)
      } else if (request.id === 'rsi' && output.key === 'line') {
        values = rsiValues(closes, period)
      } else if (request.id === 'bollinger') {
        const mid = smaValues(closes, period)
        if (output.key === 'middle') values = mid
        else if (output.key === 'upper' || output.key === 'lower') {
          const numStd =
            typeof request.parameters?.num_std === 'number' ? request.parameters.num_std : 2
          values = mid.map((value, index) => {
            if (value == null) return null
            const slice = closes.slice(Math.max(0, index + 1 - period), index + 1)
            const mean = value
            const variance =
              slice.reduce((sum, close) => sum + (close - mean) ** 2, 0) / Math.max(slice.length, 1)
            const std = Math.sqrt(variance)
            return output.key === 'upper' ? mean + numStd * std : mean - numStd * std
          })
        } else values = timestamps.map(() => null)
      } else {
        values = timestamps.map((_, index) => (index < 2 ? null : closes[index] * 0.01))
      }

      series.push({
        key: output.key,
        pane: output.pane,
        unit: entry.unit,
        values,
        unavailableReason: null,
      })
    }
  }

  return { timestamps, series }
}

export function mockMarketVolumeProfile(
  bars: OhlcvBar[],
  body: MarketVolumeProfileRequest,
): MarketVolumeProfileResponse {
  if (bars.length === 0) {
    return { segments: [], unavailableReason: 'No tick history for this range (mock)' }
  }

  const tickSize = 0.01
  const rowSize = tickSize * (body.rowTicks ?? 1)
  const buildRows = (anchor: number) => {
    const prices = [anchor - rowSize, anchor, anchor + rowSize]
    return {
      price: prices,
      buy: [120, 400, 90],
      sell: [80, 50, 110],
      unknown: [10, 5, 15],
    }
  }

  if (body.segment === 'range') {
    const anchor = bars[bars.length - 1].close
    return {
      tickSize,
      rowSize,
      segments: [
        {
          start: bars[0].timestamp,
          end: bars[bars.length - 1].timestamp,
          total: 880,
          buy: 610,
          sell: 240,
          unknown: 30,
          trades: 42,
          poc: anchor,
          vah: anchor + rowSize,
          val: anchor - rowSize,
          rows: buildRows(anchor),
        },
      ],
    }
  }

  const bySession = new Map<string, OhlcvBar[]>()
  for (const bar of bars) {
    const key = sessionDayKey(bar.timestamp)
    bySession.set(key, [...(bySession.get(key) ?? []), bar])
  }

  const segments = [...bySession.entries()].map(([, sessionBars]) => {
    const anchor = sessionBars[Math.floor(sessionBars.length / 2)].close
    return {
      start: sessionBars[0].timestamp,
      end: sessionBars[sessionBars.length - 1].timestamp,
      total: 880,
      buy: 610,
      sell: 240,
      unknown: 30,
      trades: 42,
      poc: anchor,
      vah: anchor + rowSize,
      val: anchor - rowSize,
      rows: buildRows(anchor),
    }
  })

  return { tickSize, rowSize, segments, unavailableReason: null }
}
