import { describe, expect, it } from 'vitest'

import { sortLeaderboardCandidates } from '@/lib/discover/sortLeaderboardCandidates'
import type { CandidateResult } from '@/types/strategySearch'

function candidate(
  partial: Partial<CandidateResult> & Pick<CandidateResult, 'candidate_id' | 'strategy'>,
): CandidateResult {
  return {
    rank: 1,
    passed_gates: true,
    status: 'completed',
    objective_value: 1,
    efficiency: 0.5,
    oos_metrics: { total_trades: 10 },
    ...partial,
  } as CandidateResult
}

describe('sortLeaderboardCandidates', () => {
  it('keeps gated candidates ahead of trailing rows', () => {
    const sorted = sortLeaderboardCandidates(
      [
        candidate({ candidate_id: 'b', strategy: 'B', rank: null, passed_gates: false }),
        candidate({ candidate_id: 'a', strategy: 'A', rank: 1 }),
      ],
      'rank',
      true,
    )

    expect(sorted.map((c) => c.candidate_id)).toEqual(['a', 'b'])
  })

  it('returns a new array without mutating the input', () => {
    const input = [candidate({ candidate_id: 'a', strategy: 'A', rank: 2 })]
    const sorted = sortLeaderboardCandidates(input, 'rank', true)
    expect(sorted).not.toBe(input)
    expect(input[0]?.rank).toBe(2)
  })
})
