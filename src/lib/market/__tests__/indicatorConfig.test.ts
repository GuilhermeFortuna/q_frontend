import { describe, expect, it } from 'vitest'

import {
  migrateLegacyIndicatorConfig,
  normalizeIndicatorConfigs,
  rsiLevelErrors,
  rsiLevels,
} from '@/lib/market/indicatorConfig'

describe('indicatorConfig migration', () => {
  it('maps legacy SMA, Bollinger and RSI entries to catalog ids', () => {
    const legacy = [
      { type: 'sma', enabled: true, period: 20, color: '#c9a227' },
      { type: 'bollinger', enabled: true, period: 20, stdDev: 2, showCloud: true },
      { type: 'rsi', enabled: false, period: 14 },
    ]

    const migrated = normalizeIndicatorConfigs(legacy)
    expect(migrated).toEqual([
      {
        id: 'sma',
        enabled: true,
        parameters: { period: 20 },
        style: { color: '#c9a227' },
      },
      {
        id: 'bollinger',
        enabled: true,
        parameters: { period: 20, num_std: 2 },
        style: { showCloud: true },
      },
      expect.objectContaining({
        id: 'rsi',
        enabled: false,
        parameters: { period: 14 },
      }),
    ])
  })

  it('maps volumeMa and macd parameter names', () => {
    const volume = migrateLegacyIndicatorConfig({
      type: 'volumeMa',
      enabled: true,
      period: 10,
    })
    expect(volume.id).toBe('volume_ma')

    const macd = migrateLegacyIndicatorConfig({
      type: 'macd',
      enabled: true,
      fast: 8,
      slow: 21,
      signal: 5,
    })
    expect(macd.parameters).toEqual({
      fast_period: 8,
      slow_period: 21,
      signal_period: 5,
    })
  })
})

describe('RSI levels', () => {
  const rsi = (style = {}) => ({ id: 'rsi', enabled: true, parameters: { period: 14 }, style })

  it('defaults to 70 and 30 and keeps saved levels through normalization', () => {
    expect(rsiLevels(rsi())).toEqual({ overbought: 70, oversold: 30 })
    const [saved] = normalizeIndicatorConfigs([
      { id: 'rsi', enabled: true, parameters: { period: 14 }, style: { overboughtLevel: 80 } },
    ])
    expect(saved.style?.overboughtLevel).toBe(80)
    expect(rsiLevels(saved)).toEqual({ overbought: 80, oversold: 30 })
  })

  it('accepts levels in range with oversold below overbought', () => {
    expect(rsiLevelErrors(rsi({ overboughtLevel: 80, oversoldLevel: 20 }))).toEqual({})
  })

  it('rejects levels outside 0 to 100 and an oversold level at or above overbought', () => {
    expect(rsiLevelErrors(rsi({ overboughtLevel: 120 }))).toHaveProperty('overboughtLevel')
    expect(rsiLevelErrors(rsi({ oversoldLevel: -1 }))).toHaveProperty('oversoldLevel')
    expect(rsiLevelErrors(rsi({ overboughtLevel: 60, oversoldLevel: 60 }))).toHaveProperty(
      'oversoldLevel',
    )
  })
})
