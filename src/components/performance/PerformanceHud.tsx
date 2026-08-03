import {
  LONG_TASK_WARNING_MS,
  routeFeatureRendererBudget,
  routeMountQueryBudget,
  TARGET_FPS,
} from '@/lib/performance/budgets'
import { usePerformanceStore } from '@/lib/performance/usePerformanceStore'

function formatSettle(ms: number | null): string {
  if (ms === null) return '…'
  return `${ms}ms`
}

export function PerformanceHud() {
  const enabled = usePerformanceStore((s) => s.enabled)
  const fps = usePerformanceStore((s) => s.fps)
  const droppedFrames = usePerformanceStore((s) => s.droppedFrames)
  const longTaskCount = usePerformanceStore((s) => s.longTaskCount)
  const canvasCount = usePerformanceStore((s) => s.canvasCount)
  const animationLoopCount = usePerformanceStore((s) => s.animationLoopCount)
  const cinematicQualityMode = usePerformanceStore((s) => s.cinematicQualityMode)
  const cinematicLoopActive = usePerformanceStore((s) => s.cinematicLoopActive)
  const currentRoute = usePerformanceStore((s) => s.currentRoute)
  const routeSettleMs = usePerformanceStore((s) => s.routeSettleMs)
  const routeMountQueryCount = usePerformanceStore((s) => s.routeMountQueryCount)
  const inactiveRouteRefetchCount = usePerformanceStore((s) => s.inactiveRouteRefetchCount)

  if (!enabled) {
    return null
  }

  const queryBudget = routeMountQueryBudget(currentRoute)
  const featureRendererBudget = routeFeatureRendererBudget(currentRoute)
  const fpsWarn = fps > 0 && fps < TARGET_FPS
  const queryWarn = queryBudget !== null && routeMountQueryCount > queryBudget
  const canvasWarn =
    featureRendererBudget !== null && canvasCount > featureRendererBudget.canvases
  const loopWarn =
    featureRendererBudget !== null && animationLoopCount > featureRendererBudget.animationLoops

  return (
    <div
      aria-hidden
      data-testid="performance-hud"
      className="surface-overlay--hud pointer-events-none fixed right-2 bottom-2 z-[90] max-w-[16rem] rounded px-2 py-1.5 font-mono text-[10px] leading-tight text-lime-300/90"
    >
      <div className="mb-1 text-[9px] tracking-wider text-white/50 uppercase">Perf HUD</div>
      <div className={fpsWarn ? 'text-amber-300' : undefined}>
        FPS {fps || '—'} · dropped {droppedFrames}
      </div>
      <div>
        long tasks {longTaskCount} (≥{LONG_TASK_WARNING_MS}ms)
      </div>
      <div className={canvasWarn || loopWarn ? 'text-amber-300' : undefined}>
        canvas {canvasCount}
        {featureRendererBudget ? ` / ${featureRendererBudget.canvases}` : ''}
        {' · '}
        loops {animationLoopCount}
        {featureRendererBudget ? ` / ${featureRendererBudget.animationLoops}` : ''}
      </div>
      <div className="truncate text-white/60">
        cinematic {cinematicQualityMode ?? '—'}
        {cinematicLoopActive ? ' · loop on' : ''}
      </div>
      <div className="truncate text-white/70">{currentRoute}</div>
      <div>settle {formatSettle(routeSettleMs)}</div>
      <div className={queryWarn ? 'text-amber-300' : undefined}>
        mount queries {routeMountQueryCount}
        {queryBudget !== null ? ` / ${queryBudget}` : ''}
      </div>
      {inactiveRouteRefetchCount > 0 ? (
        <div className="text-amber-300">inactive refetch {inactiveRouteRefetchCount}</div>
      ) : null}
    </div>
  )
}
