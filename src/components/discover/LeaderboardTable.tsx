import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { CandidateDetailPanel } from '@/components/discover/CandidateDetailPanel'
import { ComplexityLine } from '@/components/discover/GenomeViewer'
import { VirtualTableScroller } from '@/components/shared/VirtualTableBody'
import type { VirtualRowMeta } from '@/components/shared/virtualRowMeta'
import { Button } from '@/components/ui/button'
import { gateFlagsLabel } from '@/lib/discover/candidateMetrics'
import { candidateExitDisplayLabel } from '@/lib/discover/exitInsights'
import {
  sortLeaderboardCandidates,
  type LeaderboardSortKey,
} from '@/lib/discover/sortLeaderboardCandidates'
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
import {
  isGeneticCandidate,
  isGeneticSearchConfig,
  maxCandidateGeneration,
} from '@/types/strategySearch'

type SortKey = LeaderboardSortKey

type LeaderboardTableProps = {
  runId: string
  candidates: CandidateResult[]
  objectiveMode: ObjectiveMode
  backtest: OptimizationBacktestConfig
  searchConfig: StrategySearchConfig | undefined
}

const ALL_GENERATIONS = 'all'

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
  const patchBacktestSession = useAppStore((s) => s.patchBacktestSession)
  const patchOptimizeSession = useAppStore((s) => s.patchOptimizeSession)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortAsc, setSortAsc] = useState(true)

  const isGenetic = isGeneticSearchConfig(searchConfig)
  const championGeneration = maxCandidateGeneration(candidates)

  const generationOptions = useMemo(() => {
    const gens = new Set<number>()
    for (const c of candidates) {
      if (c.generation != null) gens.add(c.generation)
    }
    return Array.from(gens).sort((a, b) => a - b)
  }, [candidates])

  const [generationFilter, setGenerationFilter] = useState<string>(() =>
    championGeneration != null ? String(championGeneration) : ALL_GENERATIONS,
  )

  useEffect(() => {
    if (championGeneration != null) {
      setGenerationFilter(String(championGeneration))
    }
  }, [championGeneration, runId])

  const filteredCandidates = useMemo(() => {
    if (!isGenetic || generationFilter === ALL_GENERATIONS) return candidates
    const gen = Number(generationFilter)
    return candidates.filter((c) => c.generation === gen)
  }, [candidates, generationFilter, isGenetic])

  const sortedCandidates = useMemo(
    () => sortLeaderboardCandidates(filteredCandidates, sortKey, sortAsc),
    [filteredCandidates, sortKey, sortAsc],
  )

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((value) => !value)
    else {
      setSortKey(key)
      setSortAsc(key === 'strategy')
    }
  }

  const handlePromoteBacktest = (candidate: CandidateResult) => {
    setPendingBacktestConfig(buildBacktestRequestFromCandidate(candidate, backtest))
    patchBacktestSession({
      workflowMode: 'backtest',
      focus: 'setup',
      rightPanelTab: 'results',
    })
    void navigate({ to: '/backtests' })
  }

  const handlePromoteOptimize = (candidate: CandidateResult) => {
    if (!searchConfig) return
    setPendingOptimizationConfig(buildOptimizationConfigFromCandidate(candidate, searchConfig))
    patchBacktestSession({
      workflowMode: 'optimize',
    })
    patchOptimizeSession({
      focus: 'setup',
      rightPanelTab: 'results',
    })
    void navigate({ to: '/backtests', search: { mode: 'optimize' } })
  }

  const objectiveHeader = `OOS ${objectiveMetricLabel(objectiveMode)} (out-of-sample)`
  const showGenerationFilter = isGenetic && generationOptions.length > 0
  const columnCount = showGenerationFilter ? 9 : 8

  const renderCandidateRows = (candidate: CandidateResult, meta?: VirtualRowMeta) => {
    const expanded = expandedId === candidate.candidate_id
    const dimmed = isDeemphasized(candidate)
    const canPromote = candidate.status === 'completed' && candidate.best_params != null
    const exitDisplay = candidateExitDisplayLabel(candidate)

    return (
      <>
        <tr
          ref={meta?.measureRef}
          data-index={meta?.virtualIndex}
          className={cn(
            'border-carbon-600/30 border-t',
            dimmed ? 'text-silver-500 opacity-70' : 'text-silver-100',
          )}
        >
          <td className="px-3 py-2 font-mono tabular-nums">{candidate.rank ?? '—'}</td>
          <td className="px-3 py-2">
            <button
              type="button"
              className="hover:text-brass-400 flex items-start gap-1 text-left font-medium transition-colors"
              onClick={() => setExpandedId(expanded ? null : candidate.candidate_id)}
            >
              {expanded ? (
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {candidate.strategy}
                  {isGeneticCandidate(candidate) ? (
                    <span className="border-brass-500/30 text-brass-400 rounded-full border px-1.5 py-0 text-[9px] font-semibold tracking-wide uppercase">
                      Evolved
                    </span>
                  ) : null}
                </span>
                <ComplexityLine
                  genomeNodeCount={candidate.genome_node_count}
                  genome={candidate.genome}
                />
              </span>
            </button>
          </td>
          <td
            className={cn(
              'px-3 py-2 text-xs',
              exitDisplay.explicit ? 'text-silver-300' : 'text-silver-500',
            )}
            title={
              exitDisplay.explicit
                ? undefined
                : "Closes on the strategy's own signal — no stop/target overlay."
            }
          >
            {exitDisplay.label}
          </td>
          <td className="px-3 py-2 font-mono tabular-nums">
            {formatObjectiveMetricValue(candidate.objective_value, objectiveMode)}
          </td>
          <td className="px-3 py-2 font-mono tabular-nums">
            {formatEfficiencyRatio(candidate.efficiency)}
          </td>
          <td className="px-3 py-2 font-mono tabular-nums">{candidateTrades(candidate) ?? '—'}</td>
          {showGenerationFilter ? (
            <td className="text-silver-400 px-3 py-2 font-mono text-xs tabular-nums">
              {candidate.generation ?? '—'}
            </td>
          ) : null}
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
          <tr className="border-carbon-600/30 border-t">
            <td colSpan={columnCount} className="bg-carbon-950/40 px-4 py-4">
              <CandidateDetailPanel
                runId={runId}
                candidate={candidate}
                backtest={backtest}
                objectiveMode={objectiveMode}
                searchConfig={searchConfig}
              />
            </td>
          </tr>
        ) : null}
      </>
    )
  }

  return (
    <div className="space-y-3">
      {showGenerationFilter ? (
        <div className="flex items-center justify-end gap-2">
          <label className="text-silver-500 text-xs" htmlFor="generation-filter">
            Generation
          </label>
          <select
            id="generation-filter"
            value={generationFilter}
            onChange={(event) => setGenerationFilter(event.target.value)}
            className="border-brass-600/20 bg-carbon-950/50 text-silver-200 h-8 rounded-md border px-2 text-xs"
          >
            <option value={ALL_GENERATIONS}>All generations</option>
            {generationOptions.map((g) => (
              <option key={g} value={String(g)}>
                Generation {g}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="border-carbon-600/40 overflow-x-auto rounded-lg border">
        <VirtualTableScroller
          items={sortedCandidates}
          colSpan={columnCount}
          rowHeight={56}
          remeasureKey={expandedId}
          estimateSize={(index) =>
            expandedId === sortedCandidates[index]?.candidate_id ? 360 : 56
          }
          getItemKey={(index) => sortedCandidates[index]!.candidate_id}
          className="max-h-[min(70vh,640px)]"
          tableClassName="min-w-[720px] text-sm"
          theadClassName="bg-carbon-950/60 text-xs tracking-wide uppercase"
          header={
            <tr>
              {(
                [
                  ['rank', 'Rank'],
                  ['strategy', 'Entry'],
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
              <th className="px-3 py-2 font-semibold">Exit</th>
              {(
                [
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
              {showGenerationFilter ? <th className="px-3 py-2 font-semibold">Gen</th> : null}
              <th className="px-3 py-2 font-semibold">Gate</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          }
          renderRow={(candidate, _index, meta) => renderCandidateRows(candidate, meta)}
        />
      </div>
    </div>
  )
}
