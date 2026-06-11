import { describe, expect, it } from 'vitest'

import {
  buildPositionSizingPayload,
  defaultPositionSizingFields,
  hydratePositionSizingFields,
  validatePositionSizing,
} from '@/lib/backtesting/positionSizing'

const defaultFields = defaultPositionSizingFields()

describe('buildPositionSizingPayload', () => {
  it('builds fixed_quantity payload', () => {
    const payload = buildPositionSizingPayload('fixed_quantity', {
      ...defaultFields,
      quantity: 2,
    })

    expect(payload).toEqual({ type: 'fixed_quantity', quantity: 2 })
  })

  it('serializes empty max contracts as null', () => {
    const payload = buildPositionSizingPayload('fixed_safety_margin', defaultFields)

    expect(payload).toEqual({
      type: 'fixed_safety_margin',
      safety_margin_per_contract: 5000,
      min_contracts: 1,
      max_contracts: null,
    })
  })

  it('builds fixed_safety_margin payload with capped max', () => {
    const payload = buildPositionSizingPayload('fixed_safety_margin', {
      ...defaultFields,
      maxContractsInput: '10',
    })

    expect(payload).toEqual({
      type: 'fixed_safety_margin',
      safety_margin_per_contract: 5000,
      min_contracts: 1,
      max_contracts: 10,
    })
  })

  it('builds inverse_volatility payload', () => {
    const payload = buildPositionSizingPayload('inverse_volatility', {
      ...defaultFields,
      targetVolatilityPct: 12,
      inverseMinContracts: 0,
      inverseMaxContractsInput: '5',
    })

    expect(payload).toEqual({
      type: 'inverse_volatility',
      target_volatility_pct: 12,
      min_contracts: 0,
      max_contracts: 5,
    })
  })
})

describe('hydratePositionSizingFields', () => {
  it('round-trips inverse_volatility config', () => {
    const config = {
      type: 'inverse_volatility' as const,
      target_volatility_pct: 8,
      min_contracts: 1,
      max_contracts: 4,
    }
    const hydrated = hydratePositionSizingFields(config)
    expect(hydrated.mode).toBe('inverse_volatility')
    expect(buildPositionSizingPayload(hydrated.mode, hydrated.fields)).toEqual(config)
  })
})

describe('validatePositionSizing', () => {
  it('accepts valid fixed_quantity payload', () => {
    const result = validatePositionSizing('fixed_quantity', defaultFields)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('accepts valid fixed_safety_margin with null max contracts', () => {
    const result = validatePositionSizing('fixed_safety_margin', defaultFields)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('rejects invalid quantity', () => {
    const result = validatePositionSizing('fixed_quantity', {
      ...defaultFields,
      quantity: 0,
    })

    expect(result.valid).toBe(false)
    expect(result.errors.quantity).toBeDefined()
  })

  it('rejects invalid safety margin', () => {
    const result = validatePositionSizing('fixed_safety_margin', {
      ...defaultFields,
      safetyMargin: 0,
    })

    expect(result.valid).toBe(false)
    expect(result.errors.safety_margin_per_contract).toBeDefined()
  })

  it('rejects max contracts less than min contracts', () => {
    const result = validatePositionSizing('fixed_safety_margin', {
      ...defaultFields,
      minContracts: 5,
      maxContractsInput: '2',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.max_contracts).toBeDefined()
  })

  it('rejects non-positive target volatility', () => {
    const result = validatePositionSizing('inverse_volatility', {
      ...defaultFields,
      targetVolatilityPct: 0,
    })

    expect(result.valid).toBe(false)
    expect(result.errors.target_volatility_pct).toBeDefined()
  })

  it('rejects inverse max contracts less than min contracts', () => {
    const result = validatePositionSizing('inverse_volatility', {
      ...defaultFields,
      inverseMinContracts: 5,
      inverseMaxContractsInput: '2',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.max_contracts).toBeDefined()
  })
})
