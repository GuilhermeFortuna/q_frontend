import { FRAME_BUDGET_MS } from '@/lib/performance/budgets'
import { getAnimationLoopCount } from '@/lib/performance/animationLoopRegistry'

export type PerformanceSnapshot = {
  fps: number
  droppedFrames: number
  longTaskCount: number
  canvasCount: number
  animationLoopCount: number
  cinematicQualityMode: string | null
  cinematicLoopActive: boolean
  currentRoute: string
  routeSettleMs: number | null
  routeMountQueryCount: number
  inactiveRouteRefetchCount: number
}

export type PerformanceListener = (snapshot: PerformanceSnapshot) => void

const DROPPED_FRAME_THRESHOLD_MS = FRAME_BUDGET_MS * 1.5
const FPS_SAMPLE_SIZE = 60
const CANVAS_POLL_MS = 1000
const ROUTE_SETTLE_FRAMES = 2

export const INITIAL_SNAPSHOT: PerformanceSnapshot = {
  fps: 0,
  droppedFrames: 0,
  longTaskCount: 0,
  canvasCount: 0,
  animationLoopCount: 0,
  cinematicQualityMode: null,
  cinematicLoopActive: false,
  currentRoute: '/',
  routeSettleMs: null,
  routeMountQueryCount: 0,
  inactiveRouteRefetchCount: 0,
}

/** Pure FPS / dropped-frame estimate from recent frame deltas (ms). */
export function computeFpsFromDeltas(deltasMs: number[]): {
  fps: number
  droppedFrames: number
} {
  if (deltasMs.length === 0) {
    return { fps: 0, droppedFrames: 0 }
  }

  let droppedFrames = 0
  let totalMs = 0

  for (const delta of deltasMs) {
    totalMs += delta
    if (isDroppedFrame(delta)) {
      droppedFrames++
    }
  }

  const avgMs = totalMs / deltasMs.length
  const fps = avgMs > 0 ? Math.round(1000 / avgMs) : 0

  return { fps, droppedFrames }
}

export function isDroppedFrame(deltaMs: number): boolean {
  return deltaMs > DROPPED_FRAME_THRESHOLD_MS
}

export function countLongTasks(entries: PerformanceEntry[]): number {
  return entries.filter((entry) => entry.entryType === 'longtask').length
}

export type PerformanceMonitorDeps = {
  requestAnimationFrame: (cb: FrameRequestCallback) => number
  cancelAnimationFrame: (id: number) => void
  now: () => number
  countCanvases: () => number
  createLongTaskObserver?: (
    onEntry: (entry: PerformanceEntry) => void,
  ) => PerformanceObserver | null
  setInterval?: (cb: () => void, ms: number) => ReturnType<typeof setInterval>
  clearInterval?: (id: ReturnType<typeof setInterval>) => void
}

const defaultDeps = (): PerformanceMonitorDeps => {
  const global =
    typeof window !== 'undefined'
      ? window
      : typeof globalThis !== 'undefined'
        ? globalThis
        : undefined

  return {
    requestAnimationFrame:
      global && typeof global.requestAnimationFrame === 'function'
        ? global.requestAnimationFrame.bind(global)
        : () => 0,
    cancelAnimationFrame:
      global && typeof global.cancelAnimationFrame === 'function'
        ? global.cancelAnimationFrame.bind(global)
        : () => undefined,
    now:
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now.bind(performance)
        : () => Date.now(),
    countCanvases: () =>
      typeof document !== 'undefined' ? document.querySelectorAll('canvas').length : 0,
    createLongTaskObserver: (onEntry) => {
      if (typeof PerformanceObserver === 'undefined') {
        return null
      }
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            onEntry(entry)
          }
        })
        observer.observe({ entryTypes: ['longtask'] as string[] })
        return observer
      } catch {
        return null
      }
    },
    setInterval:
      global && typeof global.setInterval === 'function'
        ? global.setInterval.bind(global)
        : undefined,
    clearInterval:
      global && typeof global.clearInterval === 'function'
        ? global.clearInterval.bind(global)
        : undefined,
  }
}

export type CinematicPerfStats = {
  qualityMode: string
  loopActive: boolean
}

export type PerformanceMonitor = {
  start: () => void
  stop: () => void
  subscribe: (listener: PerformanceListener) => () => void
  getSnapshot: () => PerformanceSnapshot
  onRouteChange: (pathname: string) => void
  setRouteMountQueryCount: (count: number) => void
  setInactiveRouteRefetchCount: (count: number) => void
  recordInactiveRouteRefetch: () => void
  setCinematicStats: (stats: CinematicPerfStats) => void
}

export function createPerformanceMonitor(
  deps: Partial<PerformanceMonitorDeps> = {},
): PerformanceMonitor {
  const resolved = { ...defaultDeps(), ...deps }

  let running = false
  let rafId = 0
  let canvasIntervalId: ReturnType<typeof setInterval> | undefined
  let longTaskObserver: PerformanceObserver | null = null

  const listeners = new Set<PerformanceListener>()
  const frameDeltas: number[] = []
  let lastFrameTime: number | null = null
  let totalDroppedFrames = 0

  let snapshot: PerformanceSnapshot = { ...INITIAL_SNAPSHOT }

  let routeChangeTime: number | null = null
  let settleFramesRemaining = 0

  const getSnapshot = (): PerformanceSnapshot => {
    const { fps } = computeFpsFromDeltas(frameDeltas)
    return {
      ...snapshot,
      fps,
      droppedFrames: totalDroppedFrames,
      animationLoopCount: getAnimationLoopCount(),
      canvasCount: resolved.countCanvases(),
    }
  }

  const emit = () => {
    const next = getSnapshot()
    snapshot = next
    for (const listener of listeners) {
      listener(next)
    }
  }

  const tick = (timestamp: number) => {
    if (!running) return

    if (lastFrameTime !== null) {
      const delta = timestamp - lastFrameTime
      frameDeltas.push(delta)
      if (frameDeltas.length > FPS_SAMPLE_SIZE) {
        frameDeltas.shift()
      }
      if (isDroppedFrame(delta)) {
        totalDroppedFrames++
      }
    }
    lastFrameTime = timestamp

    if (settleFramesRemaining > 0) {
      settleFramesRemaining--
      if (settleFramesRemaining === 0 && routeChangeTime !== null) {
        snapshot = {
          ...snapshot,
          routeSettleMs: Math.round(resolved.now() - routeChangeTime),
        }
        emit()
      }
    }

    emit()
    rafId = resolved.requestAnimationFrame(tick)
  }

  const pollCanvasCount = () => {
    const canvasCount = resolved.countCanvases()
    if (canvasCount !== snapshot.canvasCount) {
      snapshot = { ...snapshot, canvasCount }
      emit()
    }
  }

  return {
    start() {
      if (running) return
      running = true
      lastFrameTime = null
      rafId = resolved.requestAnimationFrame(tick)

      longTaskObserver =
        resolved.createLongTaskObserver?.(() => {
          snapshot = { ...snapshot, longTaskCount: snapshot.longTaskCount + 1 }
          emit()
        }) ?? null

      if (resolved.setInterval) {
        canvasIntervalId = resolved.setInterval(pollCanvasCount, CANVAS_POLL_MS)
      }
      pollCanvasCount()
    },

    stop() {
      running = false
      if (rafId) {
        resolved.cancelAnimationFrame(rafId)
        rafId = 0
      }
      longTaskObserver?.disconnect()
      longTaskObserver = null
      if (canvasIntervalId && resolved.clearInterval) {
        resolved.clearInterval(canvasIntervalId)
        canvasIntervalId = undefined
      }
    },

    subscribe(listener) {
      listeners.add(listener)
      listener(getSnapshot())
      return () => listeners.delete(listener)
    },

    getSnapshot,

    onRouteChange(pathname) {
      routeChangeTime = resolved.now()
      settleFramesRemaining = ROUTE_SETTLE_FRAMES
      snapshot = {
        ...snapshot,
        currentRoute: pathname,
        routeSettleMs: null,
        routeMountQueryCount: 0,
      }
      emit()
    },

    setRouteMountQueryCount(count) {
      snapshot = { ...snapshot, routeMountQueryCount: count }
      emit()
    },

    setInactiveRouteRefetchCount(count) {
      snapshot = { ...snapshot, inactiveRouteRefetchCount: count }
      emit()
    },

    recordInactiveRouteRefetch() {
      snapshot = {
        ...snapshot,
        inactiveRouteRefetchCount: snapshot.inactiveRouteRefetchCount + 1,
      }
      emit()
    },

    setCinematicStats(stats) {
      snapshot = {
        ...snapshot,
        cinematicQualityMode: stats.qualityMode,
        cinematicLoopActive: stats.loopActive,
      }
      emit()
    },
  }
}

let sharedMonitor: PerformanceMonitor | null = null

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!sharedMonitor) {
    sharedMonitor = createPerformanceMonitor()
  }
  return sharedMonitor
}

export function resetPerformanceMonitorForTests(): void {
  sharedMonitor?.stop()
  sharedMonitor = null
}
