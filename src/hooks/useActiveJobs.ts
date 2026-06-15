import { useBacktestJobStatus } from '@/api/queries/backtests'
import { useOptimizationStatus } from '@/api/queries/optimize'
import { useStrategySearchStatus } from '@/api/queries/strategySearch'
import { useWalkForwardStatus } from '@/api/queries/walkforward'
import { useAppStore } from '@/store/useAppStore'
import type { WorkspaceId } from '@/types/api'

export type ActiveJobInfo = {
  /** Completion percentage, 0–100. */
  pct: number
  /** Short progress caption, e.g. "Trial 12 / 50" or "Candidate 3 / 9 · optimizing". */
  detail: string
}

export type ActiveJobsMap = Partial<Record<WorkspaceId, ActiveJobInfo>>

const isActive = (status?: string) => status === 'pending' || status === 'running'

const pctOf = (current: number, total: number) =>
  total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0

/**
 * Polls the status of every persisted active job, regardless of which workspace
 * is mounted. Mounting this in the always-present dock keeps the status queries
 * alive while the user roams elsewhere — React Query dedupes by query key, so a
 * workspace that later remounts shares the same in-flight query and cache.
 *
 * Returns progress info for each workspace that currently has a running
 * (pending/running) job; workspaces without one are absent from the map.
 */
export function useActiveJobs(): ActiveJobsMap {
  const optimizeStudyId = useAppStore((s) => s.optimizeSession.studyId)
  const walkForwardRunId = useAppStore((s) => s.walkForwardSession.runId)
  const discoverRunId = useAppStore((s) => s.discoverSession.runId)
  const backtestRunId = useAppStore((s) => s.backtestSession.runId)

  const optimize = useOptimizationStatus(optimizeStudyId).data
  const walkForward = useWalkForwardStatus(walkForwardRunId).data
  const discover = useStrategySearchStatus(discoverRunId).data
  const backtest = useBacktestJobStatus(backtestRunId).data

  const map: ActiveJobsMap = {}

  if (backtest?.status === 'running') {
    // A single backtest has no granular progress; show an indeterminate caption.
    map.backtests = { pct: 0, detail: 'Running…' }
  }

  if (isActive(optimize?.status) && optimize) {
    map.optimize = {
      pct: pctOf(optimize.completed_trials, optimize.n_trials),
      detail: `Trial ${optimize.completed_trials} / ${optimize.n_trials}`,
    }
  }

  if (isActive(walkForward?.status) && walkForward) {
    const phase = walkForward.phase ? ` · ${walkForward.phase}` : ''
    map.validate = {
      pct: pctOf(walkForward.windows_completed, walkForward.total_windows),
      detail: `Window ${walkForward.windows_completed} / ${walkForward.total_windows}${phase}`,
    }
  }

  if (isActive(discover?.status) && discover) {
    const phase = discover.phase ? ` · ${discover.phase}` : ''
    // current_candidate can be fractional (genetic reports completed windows); the
    // percentage stays smooth, but the caption shows a whole candidate count.
    map.discover = {
      pct: pctOf(discover.current_candidate, discover.total_candidates),
      detail:
        discover.total_candidates > 0
          ? `Candidate ${Math.floor(discover.current_candidate)} / ${discover.total_candidates}${phase}`
          : 'Preparing…',
    }
  }

  return map
}
