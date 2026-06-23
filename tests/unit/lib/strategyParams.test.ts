import { describe, expect, it } from 'vitest'

import {
  defaultParamsFromSpecs,
  defaultSearchSpaceFromSpecs,
  hydrateSearchSpaceFromPayload,
  hydrateStrategyParamsFromPending,
  mergeParamValues,
  searchSpaceToPayload,
  validateSearchSpace,
} from '@/lib/strategies/strategyParams'
import { mockStrategies } from '@/mocks/data'
import { mockSampleGenome } from '@/mocks/strategySearch'

const maCrossover = mockStrategies.strategies.find((s) => s.name === 'MACrossover')!
const compositeStrategy = mockStrategies.strategies.find((s) => s.name === 'CompositeStrategy')!

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

  it('passes through genome params when strategy has no param specs', () => {
    const staged = { genome: mockSampleGenome, sma_period: 12 }
    expect(hydrateStrategyParamsFromPending(compositeStrategy.params, staged)).toEqual(staged)
    expect(mergeParamValues(compositeStrategy.params, staged)).toEqual({})
  })

  it('builds default search space from search bounds when present', () => {
    const space = defaultSearchSpaceFromSpecs(maCrossover.params)
    expect(space.short_period).toEqual({ kind: 'numeric', low: 10, high: 60, step: 10 })
    expect(space.short_ma_type).toEqual({ kind: 'categorical', choices: ['sma'] })
  })

  it('carries per-parameter step into the optimizer payload', () => {
    const space = defaultSearchSpaceFromSpecs(maCrossover.params)
    const payload = searchSpaceToPayload(space, maCrossover.params)
    expect(payload.short_period).toMatchObject({ type: 'int', step: 10 })
    expect(payload.threshold).toMatchObject({ type: 'float', step: 0.25 })
  })

  it('coerces invalid steps to safe values in the payload', () => {
    const payload = searchSpaceToPayload(
      {
        short_period: { kind: 'numeric', low: 2, high: 400, step: 0 },
        threshold: { kind: 'numeric', low: 0, high: 100, step: null },
      },
      maCrossover.params,
    )
    // int step must stay a positive integer; float step may be null (continuous).
    expect(payload.short_period).toMatchObject({ type: 'int', step: 1 })
    expect(payload.threshold).toMatchObject({ type: 'float', step: null })
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
