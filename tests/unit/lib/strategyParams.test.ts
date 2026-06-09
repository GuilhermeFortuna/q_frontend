import { describe, expect, it } from 'vitest'

import {
  defaultParamsFromSpecs,
  defaultSearchSpaceFromSpecs,
  hydrateSearchSpaceFromPayload,
  mergeParamValues,
  searchSpaceToPayload,
  validateSearchSpace,
} from '@/lib/strategies/strategyParams'
import { mockStrategies } from '@/mocks/data'

const maCrossover = mockStrategies.strategies.find((s) => s.name === 'MACrossover')!

describe('strategyParams utilities', () => {
  it('builds default param values from specs', () => {
    expect(defaultParamsFromSpecs(maCrossover.params)).toEqual({
      short_period: 50,
      long_period: 200,
      short_ma_type: 'sma',
      long_ma_type: 'sma',
      threshold: 0.0,
    })
  })

  it('merges staged strategy_params over defaults', () => {
    expect(
      mergeParamValues(maCrossover.params, {
        short_period: 12,
        long_period: 48,
        threshold: 1.25,
      }),
    ).toMatchObject({
      short_period: 12,
      long_period: 48,
      threshold: 1.25,
      short_ma_type: 'sma',
    })
  })

  it('builds default search space from min/max bounds', () => {
    const space = defaultSearchSpaceFromSpecs(maCrossover.params)
    expect(space.short_period).toEqual({ kind: 'numeric', low: 2, high: 400 })
    expect(space.short_ma_type).toEqual({ kind: 'categorical', choices: ['sma'] })
  })

  it('round-trips search space through payload helpers', () => {
    const defaults = defaultSearchSpaceFromSpecs(maCrossover.params)
    const payload = searchSpaceToPayload(defaults, maCrossover.params)
    const hydrated = hydrateSearchSpaceFromPayload(payload, maCrossover.params)
    expect(hydrated).toEqual(defaults)
  })

  it('validates search space ranges and categorical choices', () => {
    expect(validateSearchSpace(defaultSearchSpaceFromSpecs(maCrossover.params))).toBe(true)
    expect(
      validateSearchSpace({
        short_period: { kind: 'numeric', low: 10, high: 5 },
      }),
    ).toBe(false)
    expect(
      validateSearchSpace({
        short_ma_type: { kind: 'categorical', choices: [] },
      }),
    ).toBe(false)
  })
})
