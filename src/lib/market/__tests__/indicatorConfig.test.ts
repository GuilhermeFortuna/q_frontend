import { describe, expect, it } from 'vitest'

import {
  migrateLegacyIndicatorConfig,
  normalizeIndicatorConfigs,
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
