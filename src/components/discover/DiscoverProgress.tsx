import { useEffect, useState } from 'react'
import { Button, Panel } from '@/components/ui'
import type { StrategySearchStatus } from '@/types/strategySearch'

function duration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return `${seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ` : ''}${seconds >= 60 ? `${Math.floor((seconds % 3600) / 60)}m ` : ''}${seconds % 60}s`
}

export function DiscoverProgress({
  status,
  onCancel,
  cancelling,
}: {
  status: StrategySearchStatus
  onCancel: () => void
  cancelling: boolean
}) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const timestamp = status.started_at ? Date.parse(status.started_at) : Date.now()
    const start = Number.isFinite(timestamp) ? timestamp : Date.now()
    const update = () => setElapsed(Math.max(0, Date.now() - start))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [status.run_id, status.started_at])

  const completed = status.completed_candidates ?? Math.floor(status.current_candidate)
  const progress =
    status.progress ??
    (status.total_candidates ? status.current_candidate / status.total_candidates : 0)
  const pct = Math.min(99, Math.max(0, Math.round(progress * 100)))
  const finished = status.finished_windows ?? 0
  const planned = status.planned_windows ?? 0
  const evaluating = !status.stage || status.stage === 'evaluation'
  const eta =
    evaluating && finished > 0 && planned > finished
      ? duration((elapsed / finished) * (planned - finished))
      : 'Estimating…'
  const legacyDetail =
    status.progress == null &&
    status.strategy &&
    status.window_index != null &&
    status.total_windows != null
  return (
    <Panel className="quant-panel--active-run shrink-0 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="accent-wayfinding font-semibold uppercase">
            <span className="live-status-dot mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            {status.status === 'pending' ? 'Search queued' : 'Search running'}
          </span>
          <span className="text-silver-200">
            {status.stage
              ? status.stage.charAt(0).toUpperCase() + status.stage.slice(1)
              : 'Evaluation'}
          </span>
          <span>
            Candidates: {completed} / {status.total_candidates}
          </span>
          {status.planned_windows != null ? (
            <span>
              Finished windows: {finished} / {planned}
            </span>
          ) : null}
          {status.settled_trials != null ? <span>Trials: {status.settled_trials}</span> : null}
          {status.total_generations ? (
            <span>
              Generation {status.generation ?? 0} / {status.total_generations}
            </span>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={cancelling}>
          {cancelling ? 'Cancelling…' : 'Cancel Search'}
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div
          className="surface-well h-2 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Discovery evaluation progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div
            className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-silver-300 font-mono text-xs">
          {pct}% · Elapsed {duration(elapsed)} · Remaining (est) {eta}
        </span>
      </div>
      {status.progress == null ? (
        <p className="text-silver-400 mt-2 text-xs">
          {legacyDetail
            ? `Candidate ${completed} / ${status.total_candidates} — ${status.strategy} — window ${status.window_index! + 1}/${status.total_windows} ${status.phase}`
            : `Candidate ${completed} / ${status.total_candidates}${status.strategy ? ` — ${status.strategy}` : ''}`}
        </p>
      ) : null}
      {status.phase == null && status.status === 'running' && status.progress == null ? (
        <p className="text-silver-500 mt-2 text-xs">
          Live window phase unavailable — showing persisted candidate progress after restart.
        </p>
      ) : null}
      <details className="mt-3 text-xs">
        <summary className="text-silver-300 cursor-pointer">
          Active candidates ({status.active_candidates?.length ?? 0})
        </summary>
        <div className="mt-2 max-h-36 overflow-auto">
          {!status.active_candidates?.length ? (
            <p className="text-silver-500">Waiting for candidate activity…</p>
          ) : (
            status.active_candidates.map((candidate) => (
              <div
                key={candidate.candidate_id}
                className="border-carbon-700 flex flex-wrap justify-between gap-2 border-b py-2"
              >
                <span title={candidate.candidate_id}>
                  {candidate.strategy} · {candidate.candidate_id}
                </span>
                <span>
                  {candidate.phase} · Window{' '}
                  {candidate.window_index == null ? '—' : candidate.window_index + 1}/
                  {candidate.total_windows} · Trials {candidate.trials}/{candidate.trial_budget} ·{' '}
                  {candidate.finished_windows} windows finished
                </span>
              </div>
            ))
          )}
        </div>
      </details>
    </Panel>
  )
}
