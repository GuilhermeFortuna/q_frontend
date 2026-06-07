import { z } from 'zod'

import type { PositionSizingConfig } from '@/types/backtesting'

export type PositionSizingMode = 'fixed_quantity' | 'fixed_safety_margin'

export type PositionSizingFields = {
  quantity: number
  safetyMargin: number
  minContracts: number
  maxContractsInput: string
}

const fixedQuantitySchema = z.object({
  type: z.literal('fixed_quantity'),
  quantity: z.number().positive('Quantity must be greater than 0'),
})

const fixedSafetyMarginSchema = z.object({
  type: z.literal('fixed_safety_margin'),
  safety_margin_per_contract: z.number().positive('Safety margin must be greater than 0'),
  min_contracts: z.number().int().min(0, 'Min contracts must be 0 or greater'),
  max_contracts: z.number().int().min(0).nullable(),
})

export const positionSizingSchema = z
  .discriminatedUnion('type', [fixedQuantitySchema, fixedSafetyMarginSchema])
  .superRefine((data, ctx) => {
    if (
      data.type === 'fixed_safety_margin' &&
      data.max_contracts !== null &&
      data.max_contracts < data.min_contracts
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Max contracts must be greater than or equal to min contracts',
        path: ['max_contracts'],
      })
    }
  })

export type PositionSizingValidationResult = {
  valid: boolean
  errors: Partial<Record<string, string>>
}

function parseMaxContractsInput(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : NaN
}

export function buildPositionSizingPayload(
  mode: PositionSizingMode,
  fields: PositionSizingFields,
): PositionSizingConfig {
  if (mode === 'fixed_quantity') {
    return {
      type: 'fixed_quantity',
      quantity: fields.quantity,
    }
  }

  const maxContracts = parseMaxContractsInput(fields.maxContractsInput)

  return {
    type: 'fixed_safety_margin',
    safety_margin_per_contract: fields.safetyMargin,
    min_contracts: fields.minContracts,
    max_contracts: maxContracts,
  }
}

export function validatePositionSizing(
  mode: PositionSizingMode,
  fields: PositionSizingFields,
): PositionSizingValidationResult {
  const payload = buildPositionSizingPayload(mode, fields)
  const result = positionSizingSchema.safeParse(payload)

  if (result.success) {
    return { valid: true, errors: {} }
  }

  const errors: Partial<Record<string, string>> = {}

  for (const issue of result.error.issues) {
    const key = issue.path[issue.path.length - 1]
    if (typeof key === 'string' && !errors[key]) {
      errors[key] = issue.message
    }
  }

  if (mode === 'fixed_safety_margin' && fields.maxContractsInput.trim() !== '') {
    const maxContracts = parseMaxContractsInput(fields.maxContractsInput)
    if (!Number.isFinite(maxContracts)) {
      errors.max_contracts = 'Max contracts must be a valid number'
    }
  }

  return { valid: false, errors }
}
