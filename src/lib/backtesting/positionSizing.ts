import { z } from 'zod'

import type { PositionSizingConfig } from '@/types/backtesting'

export type PositionSizingMode = 'fixed_quantity' | 'fixed_safety_margin' | 'inverse_volatility'

export type PositionSizingFields = {
  quantity: number
  safetyMargin: number
  minContracts: number
  maxContractsInput: string
  targetVolatilityPct: number
  inverseMinContracts: number
  inverseMaxContractsInput: string
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

const inverseVolatilitySchema = z.object({
  type: z.literal('inverse_volatility'),
  target_volatility_pct: z.number().positive('Target volatility must be greater than 0'),
  min_contracts: z.number().int().min(0, 'Min contracts must be 0 or greater'),
  max_contracts: z.number().int().min(1).nullable(),
})

export const positionSizingSchema = z
  .discriminatedUnion('type', [
    fixedQuantitySchema,
    fixedSafetyMarginSchema,
    inverseVolatilitySchema,
  ])
  .superRefine((data, ctx) => {
    if (
      (data.type === 'fixed_safety_margin' || data.type === 'inverse_volatility') &&
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

export function defaultPositionSizingFields(): PositionSizingFields {
  return {
    quantity: 1,
    safetyMargin: 5000,
    minContracts: 1,
    maxContractsInput: '',
    targetVolatilityPct: 10,
    inverseMinContracts: 0,
    inverseMaxContractsInput: '',
  }
}

function parseMaxContractsInput(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : NaN
}

export function hydratePositionSizingFields(config?: PositionSizingConfig | null): {
  mode: PositionSizingMode
  fields: PositionSizingFields
} {
  const fields = defaultPositionSizingFields()
  if (!config) {
    return { mode: 'fixed_quantity', fields }
  }

  if (config.type === 'fixed_quantity') {
    return {
      mode: 'fixed_quantity',
      fields: { ...fields, quantity: config.quantity },
    }
  }

  if (config.type === 'fixed_safety_margin') {
    return {
      mode: 'fixed_safety_margin',
      fields: {
        ...fields,
        safetyMargin: config.safety_margin_per_contract,
        minContracts: config.min_contracts,
        maxContractsInput: config.max_contracts != null ? String(config.max_contracts) : '',
      },
    }
  }

  return {
    mode: 'inverse_volatility',
    fields: {
      ...fields,
      targetVolatilityPct: config.target_volatility_pct,
      inverseMinContracts: config.min_contracts,
      inverseMaxContractsInput: config.max_contracts != null ? String(config.max_contracts) : '',
    },
  }
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

  if (mode === 'fixed_safety_margin') {
    const maxContracts = parseMaxContractsInput(fields.maxContractsInput)
    return {
      type: 'fixed_safety_margin',
      safety_margin_per_contract: fields.safetyMargin,
      min_contracts: fields.minContracts,
      max_contracts: maxContracts,
    }
  }

  const maxContracts = parseMaxContractsInput(fields.inverseMaxContractsInput)
  return {
    type: 'inverse_volatility',
    target_volatility_pct: fields.targetVolatilityPct,
    min_contracts: fields.inverseMinContracts,
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

  const maxInput =
    mode === 'inverse_volatility' ? fields.inverseMaxContractsInput : fields.maxContractsInput
  if ((mode === 'fixed_safety_margin' || mode === 'inverse_volatility') && maxInput.trim() !== '') {
    const maxContracts = parseMaxContractsInput(maxInput)
    if (!Number.isFinite(maxContracts)) {
      errors.max_contracts = 'Max contracts must be a valid number'
    }
  }

  return { valid: false, errors }
}
