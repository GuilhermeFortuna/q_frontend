import { describe, expect, it } from 'vitest'

import { normalizeIndicatorConfigs } from '@/lib/market/indicatorConfig'
import {
  VOLUME_PROFILE_INDICATOR_ID,
  volumeProfileFromIndicators,
} from '@/lib/market/volumeProfileConfig'
import type { ChartProfile } from '@/components/charts/types/chart'

describe('Chart profile volume profile persistence', () => {
  it('loads legacy SMA and RSI selections without volume profile overlay', () => {
    const legacy = normalizeIndicatorConfigs([
      { type: 'sma', enabled: true, period: 20 },
      { type: 'rsi', enabled: true, period: 14 },
    ])
    const profile: ChartProfile = {
      id: 'legacy',
      name: 'Legacy',
      chartType: 'candles',
      showGrid: true,
      indicators: legacy,
      chartSettings: {
        backgroundType: 'gradient',
        backgroundColor: '#000',
        showWatermark: true,
        candleOpacity: 0.85,
        volumeOpacity: 0.4,
        crosshairColor: '#fff',
      },
    }
    expect(profile.indicators.map((item) => item.id)).toEqual(['sma', 'rsi'])
    expect(volumeProfileFromIndicators(profile.indicators).enabled).toBe(false)
  })

  it('restores saved volume profile settings from indicators', () => {
    const indicators = normalizeIndicatorConfigs([
      {
        id: VOLUME_PROFILE_INDICATOR_ID,
        enabled: true,
        parameters: {
          segment: 'visibleRange',
          rowTicks: 4,
          valueArea: 0.65,
          splitBuySell: false,
          widthPercent: 40,
        },
      },
    ])
    const { enabled, settings } = volumeProfileFromIndicators(indicators)
    expect(enabled).toBe(true)
    expect(settings).toEqual({
      segment: 'visibleRange',
      rowTicks: 4,
      valueArea: 0.65,
      splitBuySell: false,
      widthPercent: 40,
    })
  })
})
