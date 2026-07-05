import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { CandidateDetailPanel } from '@/components/discover/CandidateDetailPanel'
import { ComplexityLine } from '@/components/discover/GenomeViewer'
import { Button } from '@/components/ui/button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { LabeledField } from '@/components/ui/LabeledField'
import { Panel } from '@/components/ui/Panel'
import { inputClass } from '@/components/optimize/optimizeFormShared'
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
const ROW_HEIGHT = 56

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

  const SortHeader = ({ label, colKey }: { label: string; colKey: SortKey }) => (
    <button
      type="button"
      className="hover:text-brass-400 transition-colors"
      onClick={() => toggleSort(colKey)}
    >
      {label}
      {sortKey === colKey ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </button>
  )

  const columns = useMemo<DataColumn<CandidateResult>[]>(() => {
    const cols: DataColumn<CandidateResult>[] = [
      {
        id: 'rank',
        header: <SortHeader label="Rank" colKey="rank" />,
        numeric: true,
        render: (candidate) => candidate.rank ?? '—',
      },
      {
        id: 'strategy',
        header: <SortHeader label="Entry" colKey="strategy" />,
        render: (candidate) => {
          const expanded = expandedId === candidate.candidate_id
          return (
            <button
              type="button"
              className="hover:text-brass-400 flex items-start gap-1 text-left font-medium transition-colors"
              onClick={(event) => {
                event.stopPropagation()
                setExpandedId(expanded ? null : candidate.candidate_id)
              }}
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
                    <span className="border-brass-500/30 text-brass-400 text-2xs rounded-full border px-1.5 py-0 font-[560] tracking-[0.08em] uppercase">
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
          )
        },
      },
      {
        id: 'exit',
        header: 'Exit',
        render: (candidate) => {
          const exitDisplay = candidateExitDisplayLabel(candidate)
          return (
            <span
              className={cn(
                'text-xs',
                exitDisplay.explicit ? 'text-silver-300' : 'text-silver-500',
              )}
              title={
                exitDisplay.explicit
                  ? undefined
                  : "Closes on the strategy's own signal — no stop/target overlay."
              }
            >
              {exitDisplay.label}
            </span>
          )
        },
      },
      {
        id: 'objective',
        header: <SortHeader label={objectiveHeader} colKey="objective" />,
        numeric: true,
        render: (candidate) => formatObjectiveMetricValue(candidate.objective_value, objectiveMode),
      },
      {
        id: 'efficiency',
        header: <SortHeader label="Efficiency" colKey="efficiency" />,
        numeric: true,
        render: (candidate) => formatEfficiencyRatio(candidate.efficiency),
      },
      {
        id: 'trades',
        header: <SortHeader label="OOS trades" colKey="trades" />,
        numeric: true,
        render: (candidate) => candidateTrades(candidate) ?? '—',
      },
    ]

    if (showGenerationFilter) {
      cols.push({
        id: 'generation',
        header: 'Gen',
        render: (candidate) => (
          <span className="text-silver-400 quant-tabular-nums font-mono font-sans text-xs">
            {candidate.generation ?? '—'}
          </span>
        ),
      })
    }

    cols.push(
      {
        id: 'gate',
        header: 'Gate',
        render: (candidate) => <GateBadge candidate={candidate} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        render: (candidate) => {
          const canPromote = candidate.status === 'completed' && candidate.best_params != null
          return (
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-xs"
                disabled={!canPromote}
                onClick={(event) => {
                  event.stopPropagation()
                  handlePromoteBacktest(candidate)
                }}
              >
                Send to Backtest
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-xs"
                disabled={!canPromote || !searchConfig}
                onClick={(event) => {
                  event.stopPropagation()
                  handlePromoteOptimize(candidate)
                }}
              >
                Send to Optimizer
              </Button>
            </div>
          )
        },
      },
    )

    return cols
  }, [
    expandedId,
    objectiveHeader,
    objectiveMode,
    showGenerationFilter,
    sortAsc,
    sortKey,
    searchConfig,
  ])

  return (
    <div className="space-y-3">
      {showGenerationFilter ? (
        <div className="flex justify-end">
          <LabeledField label="Generation" htmlFor="generation-filter" className="w-auto">
            <select
              id="generation-filter"
              value={generationFilter}
              onChange={(event) => setGenerationFilter(event.target.value)}
              className={inputClass}
            >
              <option value={ALL_GENERATIONS}>All generations</option>
              {generationOptions.map((g) => (
                <option key={g} value={String(g)}>
                  Generation {g}
                </option>
              ))}
            </select>
          </LabeledField>
        </div>
      ) : null}

      <Panel className="overflow-x-auto p-0">
        <DataTable
          columns={columns}
          rows={sortedCandidates}
          rowKey={(candidate) => candidate.candidate_id}
          expandedKey={expandedId}
          renderExpandedRow={(candidate) => (
            <CandidateDetailPanel
              runId={runId}
              candidate={candidate}
              backtest={backtest}
              objectiveMode={objectiveMode}
              searchConfig={searchConfig}
            />
          )}
          getRowClassName={(candidate) =>
            cn(isDeemphasized(candidate) ? 'text-silver-500 opacity-70' : 'text-silver-100')
          }
          virtualize={{
            rowHeight: ROW_HEIGHT,
            remeasureKey: expandedId,
            estimateSize: (index) =>
              expandedId === sortedCandidates[index]?.candidate_id ? 360 : ROW_HEIGHT,
          }}
          scrollContainerClassName="max-h-[min(70vh,640px)]"
          tableClassName="min-w-[720px] text-xs"
          theadClassName="tracking-wide uppercase"
        />
      </Panel>
    </div>
  )
}
