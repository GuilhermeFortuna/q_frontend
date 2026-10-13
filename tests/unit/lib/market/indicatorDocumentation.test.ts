import { describe, expect, it } from 'vitest'
import { mockIndicatorCatalog } from '@/mocks/marketIndicators'
import { defaultParametersForEntry } from '@/lib/market/indicatorConfig'
import {
  indicatorDocumentation,
  indicatorParameterHelp,
  indicatorParameterErrors,
} from '@/lib/market/indicatorDocumentation'

describe('indicator reference content and validation', () => {
  it('documents every shipped catalog indicator and parameter', () => {
    for (const entry of mockIndicatorCatalog.indicators) {
      expect(indicatorDocumentation[entry.id]?.calculation, entry.id).toBeTruthy()
      expect(indicatorDocumentation[entry.id]?.limitations, entry.id).toBeTruthy()
      for (const parameter of entry.parameters)
        expect(indicatorParameterHelp[parameter.name]?.description, parameter.name).toBeTruthy()
      expect(
        indicatorParameterErrors(entry, {
          id: entry.id,
          enabled: true,
          parameters: defaultParametersForEntry(entry),
        }),
      ).toEqual({})
    }
  })
  it('rejects invalid integers and enforces MACD ordering', () => {
    const entry = mockIndicatorCatalog.indicators.find((e) => e.id === 'macd')!
    expect(
      indicatorParameterErrors(entry, {
        id: 'macd',
        enabled: true,
        parameters: { fast_period: 26, slow_period: 26, signal_period: 1.5 },
      }),
    ).toEqual({
      fast_period: 'Fast period must be smaller than slow period.',
      signal_period: 'Signal period must be a whole number.',
    })
  })
  it('validates the active volatility ratio ordering and rejects unknown parameters', () => {
    const entry = mockIndicatorCatalog.indicators.find((e) => e.id === 'volatility_log_ratio')!
    const parameters = {
      ...defaultParametersForEntry(entry),
      vol_estimator: 'ewma',
      short_window: 50,
      long_window: 20,
      short_half_life: 40,
      long_half_life: 32,
      unknown: 1,
    }
    expect(indicatorParameterErrors(entry, { id: entry.id, enabled: true, parameters })).toEqual({
      short_half_life: 'Short half-life must be smaller than long half-life.',
      unknown: 'Unknown parameter: unknown. Reset to defaults to remove it.',
    })
  })
})
