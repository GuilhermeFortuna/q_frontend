import { describe, expect, it } from 'vitest'
import { emptyCandidateFilters, filterCandidates } from '@/lib/discover/filterCandidates'
import type { CandidateResult } from '@/types/strategySearch'

describe('Discovery candidate filters', () => {
  const candidates = [
    {
      candidate_id: 'a',
      strategy: 'A',
      status: 'completed',
      objective_value: 12,
      efficiency: 0.8,
      passed_gates: true,
      oos_metrics: { total_trades: 20 },
    },
    {
      candidate_id: 'b',
      strategy: 'B',
      status: 'no_result',
      objective_value: null,
      efficiency: null,
      passed_gates: false,
      oos_metrics: null,
    },
  ] as CandidateResult[]
  it('combines categories and inclusive metric bounds', () => {
    expect(
      filterCandidates(candidates, {
        ...emptyCandidateFilters,
        gate: 'passed',
        objectiveMin: '12',
        tradesMax: '20',
      }).map((c) => c.candidate_id),
    ).toEqual(['a'])
    expect(
      filterCandidates(candidates, { ...emptyCandidateFilters, strategy: 'B', objectiveMin: '0' }),
    ).toEqual([])
    expect(filterCandidates(candidates, emptyCandidateFilters)).toHaveLength(2)
  })
})
