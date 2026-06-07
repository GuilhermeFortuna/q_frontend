import { describe, expect, it } from 'vitest'

import type { OptimizationResults } from '@/types/optimization'

function shouldFetchResults(status: string | undefined): boolean {
  return status === 'done' || status === 'cancelled'
}

describe('optimization results gating', () => {
  it('fetches results when study is done', () => {
    expect(shouldFetchResults('done')).toBe(true)
  })

  it('fetches results when study is cancelled', () => {
    expect(shouldFetchResults('cancelled')).toBe(true)
  })

  it('does not fetch results while running', () => {
    expect(shouldFetchResults('running')).toBe(false)
    expect(shouldFetchResults('pending')).toBe(false)
  })
})

describe('optimization trial selection', () => {
  const results: OptimizationResults = {
    study_id: 'abc',
    objective_mode: 'maximize_net_profit',
    is_multi_objective: false,
    best_params: {},
    best_trial: {
      number: 2,
      params: {},
      values: [100],
      state: 'COMPLETE',
      user_attrs: {
        status: 'complete',
        strategy_params: { short_period: 5 },
        risk_params: { type: 'fixed_quantity' },
      },
    },
    trials: [
      {
        number: 1,
        params: {},
        values: [50],
        state: 'COMPLETE',
        user_attrs: { status: 'complete' },
      },
      {
        number: 2,
        params: {},
        values: [100],
        state: 'COMPLETE',
        user_attrs: { status: 'complete' },
      },
    ],
    pareto_trials: [],
    failures: [],
  }

  it('finds trial by number for backtest handoff', () => {
    const selected = results.trials.find((t) => t.number === 1)
    expect(selected?.values?.[0]).toBe(50)
    expect(results.best_trial?.number).toBe(2)
  })
})
