import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/Panel'
import type { StrategySearchStatus } from '@/types/strategySearch'
import { cn } from '@/lib/utils'

type DiscoverProgressProps = {
  status: StrategySearchStatus
  onCancel: () => void
  cancelling: boolean
}

function phaseLabel(phase: StrategySearchStatus['phase']): string {
  if (phase === 'optimizing') return 'optimizing'
  if (phase === 'testing') return 'testing'
  if (phase === 'done') return 'done'
  return 'working'
}

function formatDuration(ms: number): string {
  if (ms < 0) return '0s'
  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(' ')
}

export function DiscoverProgress({ status, onCancel, cancelling }: DiscoverProgressProps) {
  const total = Math.max(status.total_candidates, 1)
  const currentRaw = status.current_candidate
  const current = Math.floor(currentRaw)
  const pct = Math.min(100, Math.round((currentRaw / total) * 100))
  const hasGenerationProgress =
    status.total_generations != null && status.total_generations > 0 && status.generation != null
  const generationPct = hasGenerationProgress
    ? Math.min(100, Math.round(((status.generation ?? 0) / (status.total_generations ?? 1)) * 100))
    : 0

  const hasLiveDetail =
    status.phase != null &&
    status.strategy != null &&
    status.window_index != null &&
    status.total_windows != null

  const headerLabel =
    status.total_candidates > 0
      ? hasLiveDetail
        ? `Candidate ${Math.min(current, status.total_candidates)} / ${status.total_candidates} — ${status.strategy} — window ${status.window_index! + 1}/${status.total_windows} ${phaseLabel(status.phase)}`
        : `Candidate ${Math.min(current, status.total_candidates)} / ${status.total_candidates}${
            status.strategy ? ` — ${status.strategy}` : ''
          }`
      : 'Preparing search…'

  const [elapsed, setElapsed] = useState(0)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!status.run_id) return

    const key = `discover:start-time:${status.run_id}`
    let startTimeStr = localStorage.getItem(key)
    if (!startTimeStr) {
      startTimeStr = String(Date.now())
      localStorage.setItem(key, startTimeStr)
    }
    const startTime = Number(startTimeStr)

    const updateTimes = () => {
      const now = Date.now()
      const elapsedMs = now - startTime
      setElapsed(elapsedMs)

      if (currentRaw > 0) {
        const progress = currentRaw / total
        const remainingMs = elapsedMs / progress - elapsedMs
        setRemaining(remainingMs)
      } else {
        setRemaining(0)
      }
    }

    updateTimes()
    const timer = setInterval(updateTimes, 1000)
    return () => clearInterval(timer)
  }, [status.run_id, currentRaw, total])

  return (
    <div className="animate-fade-in-up flex flex-1 flex-col items-center justify-center gap-4">
      <Panel
        className={cn(
          'quant-panel--active-run relative w-full max-w-md overflow-hidden rounded-2xl px-6 py-8',
        )}
      >
        <div className="relative z-20">
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="live-status-dot h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            <span className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase">
              Search running
            </span>
          </div>
          {hasGenerationProgress ? (
            <>
              <p className="text-silver-200 mb-1 text-center text-sm font-medium">
                Generation {status.generation} / {status.total_generations}
              </p>
              <div className="text-silver-300 mb-2 flex justify-between font-mono text-xs font-[560] tracking-[0.08em] uppercase">
                <span>Generations</span>
                <span className="text-silver-100 quant-tabular-nums">{generationPct}%</span>
              </div>
              <div className="surface-well mb-4 h-2 w-full overflow-hidden rounded-full">
                <div
                  className="from-brass-700 to-brass-500 h-full rounded-full bg-gradient-to-r transition-all duration-500"
                  style={{ width: `${generationPct}%` }}
                />
              </div>
            </>
          ) : null}
          <p className="text-silver-200 mb-1 text-center text-sm font-medium">{headerLabel}</p>
          {status.phase == null && status.status === 'running' ? (
            <p className="text-silver-500 mb-3 text-center text-xs">
              Live window phase unavailable — showing persisted candidate progress after restart.
            </p>
          ) : null}
          <div className="text-silver-300 mb-2.5 flex justify-between font-mono text-xs font-[560] tracking-[0.08em] uppercase">
            <span>
              Candidates: {current} / {status.total_candidates}
            </span>
            <span className="text-silver-100 quant-tabular-nums">{pct}%</span>
          </div>
          <div className="surface-well h-2.5 w-full overflow-hidden rounded-full">
            <div
              className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {hasLiveDetail ? (
            <div className="text-silver-400 mt-4 text-center text-xs">
              Window {status.window_index! + 1} / {status.total_windows} —{' '}
              {phaseLabel(status.phase)}
            </div>
          ) : null}

          {status.run_id && (
            <Panel className="text-silver-400 mt-4 p-3 text-xs">
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="flex flex-col">
                  <span className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase">
                    Elapsed Time
                  </span>
                  <span className="text-silver-200 quant-tabular-nums mt-0.5 font-semibold">
                    {formatDuration(elapsed)}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase">
                    Remaining (Est)
                  </span>
                  <span className="text-silver-100 quant-tabular-nums mt-0.5 font-semibold">
                    {currentRaw / total > 0.02 ? formatDuration(remaining) : 'Estimating...'}
                  </span>
                </div>
              </div>
            </Panel>
          )}

          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              className="text-silver-400 text-xs font-bold tracking-wider uppercase hover:text-red-400"
              onClick={onCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Search'}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  )
}
