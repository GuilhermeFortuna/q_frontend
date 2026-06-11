import { z } from 'zod'

import type { TransactionCostConfig } from '@/types/backtesting'

export type TransactionCostFields = {
  costPerContract: number
  costBps: number
}

const transactionCostFieldsSchema = z.object({
  costPerContract: z.number().min(0, 'Cost per contract must be 0 or greater'),
  costBps: z.number().min(0, 'Cost in bps must be 0 or greater'),
})

export type TransactionCostValidationResult = {
  valid: boolean
  errors: Partial<Record<keyof TransactionCostFields, string>>
}

export function defaultTransactionCostFields(): TransactionCostFields {
  return { costPerContract: 0, costBps: 0 }
}

export function hydrateTransactionCostFields(
  costs?: TransactionCostConfig | null,
): TransactionCostFields {
  if (!costs) return defaultTransactionCostFields()
  return {
    costPerContract: costs.cost_per_contract,
    costBps: costs.cost_bps,
  }
}

export function buildCostsPayload(
  fields: TransactionCostFields,
): TransactionCostConfig | undefined {
  if (fields.costPerContract === 0 && fields.costBps === 0) {
    return undefined
  }
  return {
    cost_per_contract: fields.costPerContract,
    cost_bps: fields.costBps,
  }
}

export function validateTransactionCosts(
  fields: TransactionCostFields,
): TransactionCostValidationResult {
  const result = transactionCostFieldsSchema.safeParse(fields)
  if (result.success) {
    return { valid: true, errors: {} }
  }

  const errors: Partial<Record<keyof TransactionCostFields, string>> = {}
  for (const issue of result.error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !errors[key as keyof TransactionCostFields]) {
      errors[key as keyof TransactionCostFields] = issue.message
    }
  }
  return { valid: false, errors }
}
