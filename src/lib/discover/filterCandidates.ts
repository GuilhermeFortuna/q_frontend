import type { CandidateResult } from '@/types/strategySearch'

export type CandidateFilters = {
  strategy: string
  state: string
  gate: string
  objectiveMin: string
  objectiveMax: string
  efficiencyMin: string
  efficiencyMax: string
  tradesMin: string
  tradesMax: string
}

export const emptyCandidateFilters: CandidateFilters = {
  strategy: '',
  state: '',
  gate: '',
  objectiveMin: '',
  objectiveMax: '',
  efficiencyMin: '',
  efficiencyMax: '',
  tradesMin: '',
  tradesMax: '',
}

function inBounds(value: number | null | undefined, min: string, max: string): boolean {
  if (!min && !max) return true
  if (value == null || !Number.isFinite(value)) return false
  return (!min || value >= Number(min)) && (!max || value <= Number(max))
}

export function filterCandidates(
  candidates: CandidateResult[],
  filters: CandidateFilters,
): CandidateResult[] {
  return candidates.filter(
    (c) =>
      (!filters.strategy || c.strategy === filters.strategy) &&
      (!filters.state || c.status === filters.state) &&
      (!filters.gate || (filters.gate === 'passed' ? c.passed_gates : !c.passed_gates)) &&
      inBounds(c.objective_value, filters.objectiveMin, filters.objectiveMax) &&
      inBounds(c.efficiency, filters.efficiencyMin, filters.efficiencyMax) &&
      inBounds(c.oos_metrics?.total_trades, filters.tradesMin, filters.tradesMax),
  )
}
