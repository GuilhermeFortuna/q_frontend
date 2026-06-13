import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'

import { CandidateDetailPanel } from '@/components/discover/CandidateDetailPanel'
import { Button } from '@/components/ui/button'
import { gateFlagsLabel } from '@/lib/discover/candidateMetrics'
import {
  buildBacktestRequestFromCandidate,
  buildOptimizationConfigFromCandidate,
} from '@/lib/discover/promoteCandidate'
import {
  formatEfficiencyRatio,
  formatObjectiveMetricValue,
  objectiveMetricLabel,
} from '@/lib/walkforward/objectiveMetric'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { ObjectiveMode, OptimizationBacktestConfig } from '@/types/optimization'
import type { CandidateResult, StrategySearchConfig } from '@/types/strategySearch'

type SortKey = 'rank' | 'strategy' | 'objective' | 'efficiency' | 'trades'

type LeaderboardTableProps = {
  runId: string
  candidates: CandidateResult[]
  objectiveMode: ObjectiveMode
  backtest: OptimizationBacktestConfig
  searchConfig: StrategySearchConfig | undefined
}

function candidateTrades(candidate: CandidateResult): number | null {
  return candidate.oos_metrics?.total_trades ?? null
}

function isDeemphasized(candidate: CandidateResult): boolean {
  return (
    !candidate.passed_gates ||
    candidate.status === 'no_result' ||
    candidate.status === 'unsupported' ||
    candidate.status === 'error'
  )
}

function GateBadge({ candidate }: { candidate: CandidateResult }) {
  const passed = candidate.passed_gates && candidate.status === 'completed'
  const label = passed ? 'Passed' : candidate.status === 'completed' ? 'Flagged' : candidate.status

  return (
    <span
      title={gateFlagsLabel(candidate.gate_flags)}
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
        passed
          ? 'bg-emerald-500/10 text-emerald-400'
          : candidate.status === 'completed'
            ? 'bg-amber-500/10 text-amber-300'
            : 'bg-silver-500/10 text-silver-400',
      )}
    >
      {label}
    </span>
  )
}

export function LeaderboardTable({
  runId,
  candidates,
  objectiveMode,
  backtest,
  searchConfig,
}: LeaderboardTableProps) {
  const navigate = useNavigate()
  const setPendingBacktestConfig = useAppStore((s) => s.setPendingBacktestConfig)
  const setPendingOptimizationConfig = useAppStore((s) => s.setPendingOptimizationConfig)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortAsc, setSortAsc] = useState(true)

  const sortedCandidates = useMemo(() => {
    const passing = candidates.filter((c) => c.passed_gates && c.rank != null)
    const trailing = candidates.filter((c) => !c.passed_gates || c.rank == null)

    const sortFn = (list: CandidateResult[]) => {
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

    return [...sortFn(passing), ...sortFn(trailing)]
  }, [candidates, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((value) => !value)
    else {
      setSortKey(key)
      setSortAsc(key === 'strategy')
    }
  }

  const handlePromoteBacktest = (candidate: CandidateResult) => {
    setPendingBacktestConfig(buildBacktestRequestFromCandidate(candidate, backtest))
    void navigate({ to: '/backtests' })
  }

  const handlePromoteOptimize = (candidate: CandidateResult) => {
    if (!searchConfig) return
    setPendingOptimizationConfig(buildOptimizationConfigFromCandidate(candidate, searchConfig))
    void navigate({ to: '/optimize' })
  }

  const objectiveHeader = `OOS ${objectiveMetricLabel(objectiveMode)} (out-of-sample)`

  return (
    <div className="border-carbon-600/40 overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-carbon-950/60 text-silver-400 text-xs tracking-wide uppercase">
          <tr>
            {(
              [
                ['rank', 'Rank'],
                ['strategy', 'Strategy'],
                ['objective', objectiveHeader],
                ['efficiency', 'Efficiency'],
                ['trades', 'OOS trades'],
              ] as const
            ).map(([key, label]) => (
              <th key={key} className="px-3 py-2 font-semibold">
                <button
                  type="button"
                  className="hover:text-brass-400 transition-colors"
                  onClick={() => toggleSort(key)}
                >
                  {label}
                  {sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
                </button>
              </th>
            ))}
            <th className="px-3 py-2 font-semibold">Gate</th>
            <th className="px-3 py-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedCandidates.map((candidate) => {
            const expanded = expandedId === candidate.candidate_id
            const dimmed = isDeemphasized(candidate)
            const canPromote = candidate.status === 'completed' && candidate.best_params != null

            return (
              <Fragment key={candidate.candidate_id}>
                <tr
                  key={candidate.candidate_id}
                  className={cn(
                    'border-carbon-600/30 border-t',
                    dimmed ? 'text-silver-500 opacity-70' : 'text-silver-100',
                  )}
                >
                  <td className="px-3 py-2 font-mono tabular-nums">{candidate.rank ?? '—'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="hover:text-brass-400 flex items-center gap-1 font-medium transition-colors"
                      onClick={() => setExpandedId(expanded ? null : candidate.candidate_id)}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      {candidate.strategy}
                    </button>
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">
                    {formatObjectiveMetricValue(candidate.objective_value, objectiveMode)}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">
                    {formatEfficiencyRatio(candidate.efficiency)}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">
                    {candidateTrades(candidate) ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <GateBadge candidate={candidate} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        disabled={!canPromote}
                        onClick={() => handlePromoteBacktest(candidate)}
                      >
                        Send to Backtest
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        disabled={!canPromote || !searchConfig}
                        onClick={() => handlePromoteOptimize(candidate)}
                      >
                        Send to Optimizer
                      </Button>
                    </div>
                  </td>
                </tr>
                {expanded ? (
                  <tr
                    key={`${candidate.candidate_id}-detail`}
                    className="border-carbon-600/30 border-t"
                  >
                    <td colSpan={7} className="bg-carbon-950/40 px-4 py-4">
                      <CandidateDetailPanel
                        runId={runId}
                        candidate={candidate}
                        backtest={backtest}
                        objectiveMode={objectiveMode}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
