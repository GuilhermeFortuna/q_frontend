import type { CandidateResult } from '@/types/strategySearch'

export type LeaderboardSortKey = 'rank' | 'strategy' | 'objective' | 'efficiency' | 'trades'

function candidateTrades(candidate: CandidateResult): number | null {
  return candidate.oos_metrics?.total_trades ?? null
}

function sortPartition(list: CandidateResult[], sortKey: LeaderboardSortKey, sortAsc: boolean) {
  const sorted = [...list]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'rank':
        cmp = (a.rank ?? 999) - (b.rank ?? 999)
        break
      case 'strategy':
        cmp = a.strategy.localeCompare(b.strategy)
        break
      case 'objective':
        cmp = (a.objective_value ?? -Infinity) - (b.objective_value ?? -Infinity)
        break
      case 'efficiency':
        cmp = (a.efficiency ?? -Infinity) - (b.efficiency ?? -Infinity)
        break
      case 'trades':
        cmp = (candidateTrades(a) ?? -1) - (candidateTrades(b) ?? -1)
        break
      default: {
        const exhaustive: never = sortKey
        return exhaustive
      }
    }
    return sortAsc ? cmp : -cmp
  })
  return sorted
}

/** Stable sort: gated candidates first, then trailing — computed once per input identity. */
export function sortLeaderboardCandidates(
  candidates: CandidateResult[],
  sortKey: LeaderboardSortKey,
  sortAsc: boolean,
): CandidateResult[] {
  const passing = candidates.filter((c) => c.passed_gates && c.rank != null)
  const trailing = candidates.filter((c) => !c.passed_gates || c.rank == null)
  return [...sortPartition(passing, sortKey, sortAsc), ...sortPartition(trailing, sortKey, sortAsc)]
}
