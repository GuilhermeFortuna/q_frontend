import { describe, expect, it } from 'vitest'

import {
  computeBestMultiObjectiveMetrics,
  formatFractionAsPercent,
  formatMultiObjectiveTeaserValues,
  formatMultiObjectiveTrialValues,
  getCompletedTrialsWithValues,
  isMultiObjectiveObjectiveMode,
} from '@/lib/optimize/multiObjectiveMetrics'
import type { OptimizationTrial } from '@/types/optimization'

function makeTrial(
  number: number,
  values: number[] | null,
  status: string = 'complete',
): OptimizationTrial {
  return {
    number,
    params: {},
    values,
    state: status === 'complete' ? 'COMPLETE' : 'RUNNING',
    user_attrs: { status },
  }
}

describe('isMultiObjectiveObjectiveMode', () => {
  it('returns true for multi_objective_return_drawdown', () => {
    expect(isMultiObjectiveObjectiveMode('multi_objective_return_drawdown')).toBe(true)
  })

  it('returns false for single-objective modes', () => {
    expect(isMultiObjectiveObjectiveMode('maximize_net_profit')).toBe(false)
    expect(isMultiObjectiveObjectiveMode(undefined)).toBe(false)
  })
})

describe('getCompletedTrialsWithValues', () => {
  it('filters to completed trials with at least two values', () => {
    const trials = [
      makeTrial(1, [0.1, 0.05]),
      makeTrial(2, [0.2, 0.08]),
      makeTrial(3, [0.15], 'complete'),
      makeTrial(4, [0.3, 0.04], 'running'),
      makeTrial(5, null, 'complete'),
    ]

    const result = getCompletedTrialsWithValues(trials)
    expect(result).toHaveLength(2)
    expect(result.map((t) => t.number)).toEqual([1, 2])
  })
})

describe('computeBestMultiObjectiveMetrics', () => {
  it('picks max return and min drawdown across completed trials', () => {
    const trials = [
      makeTrial(1, [0.1, 0.15]),
      makeTrial(2, [0.25, 0.08]),
      makeTrial(3, [0.18, 0.05]),
      makeTrial(4, [0.3, 0.12], 'running'),
    ]

    const { bestReturn, bestDrawdown } = computeBestMultiObjectiveMetrics(trials)
    expect(bestReturn).toBe(0.25)
    expect(bestDrawdown).toBe(0.05)
  })

  it('returns nulls when no completed trials exist', () => {
    const { bestReturn, bestDrawdown } = computeBestMultiObjectiveMetrics([])
    expect(bestReturn).toBeNull()
    expect(bestDrawdown).toBeNull()
  })
})

describe('formatFractionAsPercent', () => {
  it('formats fractional values as percentages', () => {
    expect(formatFractionAsPercent(0.25)).toBe('25.00%')
    expect(formatFractionAsPercent(0.05)).toBe('5.00%')
  })

  it('returns em dash for null or NaN', () => {
    expect(formatFractionAsPercent(null)).toBe('—')
    expect(formatFractionAsPercent(undefined)).toBe('—')
    expect(formatFractionAsPercent(Number.NaN)).toBe('—')
  })
})

describe('formatMultiObjectiveTrialValues', () => {
  it('formats trial values with Return and Drawdown labels', () => {
    expect(formatMultiObjectiveTrialValues([0.25, 0.05])).toBe('Return: 25.00%, Drawdown: 5.00%')
  })

  it('returns em dash for missing values', () => {
    expect(formatMultiObjectiveTrialValues(null)).toBe('—')
    expect(formatMultiObjectiveTrialValues([0.25])).toBe('—')
  })
})

describe('formatMultiObjectiveTeaserValues', () => {
  it('formats trial values with abbreviated labels', () => {
    expect(formatMultiObjectiveTeaserValues([0.25, 0.05])).toBe('Ret: 25.00%, DD: 5.00%')
  })

  it('returns em dash for missing values', () => {
    expect(formatMultiObjectiveTeaserValues(null)).toBe('—')
  })
})
