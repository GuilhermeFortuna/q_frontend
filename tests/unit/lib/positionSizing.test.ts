import { describe, expect, it } from 'vitest'

import {
  buildPositionSizingPayload,
  validatePositionSizing,
} from '@/lib/backtesting/positionSizing'

const defaultFields = {
  quantity: 1,
  safetyMargin: 5000,
  minContracts: 1,
  maxContractsInput: '',
}

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
})
