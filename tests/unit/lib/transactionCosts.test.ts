import { describe, expect, it } from 'vitest'

import {
  buildCostsPayload,
  defaultTransactionCostFields,
  hydrateTransactionCostFields,
  validateTransactionCosts,
} from '@/lib/backtesting/transactionCosts'

describe('buildCostsPayload', () => {
  it('returns undefined when both costs are zero', () => {
    expect(buildCostsPayload(defaultTransactionCostFields())).toBeUndefined()
  })

  it('returns costs object when either field is non-zero', () => {
    expect(buildCostsPayload({ costPerContract: 5, costBps: 0 })).toEqual({
      cost_per_contract: 5,
      cost_bps: 0,
    })
    expect(buildCostsPayload({ costPerContract: 0, costBps: 10 })).toEqual({
      cost_per_contract: 0,
      cost_bps: 10,
    })
  })
})

describe('hydrateTransactionCostFields', () => {
  it('defaults to zero when costs are absent', () => {
    expect(hydrateTransactionCostFields()).toEqual(defaultTransactionCostFields())
  })

  it('round-trips persisted costs', () => {
    const fields = hydrateTransactionCostFields({ cost_per_contract: 3.5, cost_bps: 12 })
    expect(buildCostsPayload(fields)).toEqual({ cost_per_contract: 3.5, cost_bps: 12 })
  })
})

describe('validateTransactionCosts', () => {
  it('rejects negative values', () => {
    const result = validateTransactionCosts({ costPerContract: -1, costBps: 0 })
    expect(result.valid).toBe(false)
    expect(result.errors.costPerContract).toBeDefined()
  })
})
