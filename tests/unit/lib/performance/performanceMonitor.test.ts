import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetAnimationLoopRegistry } from '@/lib/performance/animationLoopRegistry'
import {
  computeFpsFromDeltas,
  countLongTasks,
  createPerformanceMonitor,
  isDroppedFrame,
  resetPerformanceMonitorForTests,
} from '@/lib/performance/performanceMonitor'

describe('performanceMonitor math', () => {
  it('computes fps from steady 60 Hz frame deltas', () => {
    const deltas = Array.from({ length: 60 }, () => 16.67)
    const { fps, droppedFrames } = computeFpsFromDeltas(deltas)
    expect(fps).toBeGreaterThanOrEqual(59)
    expect(fps).toBeLessThanOrEqual(61)
    expect(droppedFrames).toBe(0)
  })

  it('flags dropped frames above the budget threshold', () => {
    expect(isDroppedFrame(20)).toBe(false)
    expect(isDroppedFrame(30)).toBe(true)
    expect(isDroppedFrame(50)).toBe(true)
  })

  it('counts longtask performance entries', () => {
    const entries = [
      { entryType: 'longtask', duration: 80 },
      { entryType: 'measure', duration: 5 },
      { entryType: 'longtask', duration: 120 },
    ] as PerformanceEntry[]

    expect(countLongTasks(entries)).toBe(2)
  })

  it('tracks fps, route settle, and canvas counts via injected deps', () => {
    let rafCb: FrameRequestCallback | undefined
    let now = 0
    const canvases: HTMLCanvasElement[] = []

    const monitor = createPerformanceMonitor({
      requestAnimationFrame: (cb) => {
        rafCb = cb
        return 1
      },
      cancelAnimationFrame: () => {
        rafCb = undefined
      },
      now: () => now,
      countCanvases: () => canvases.length,
      createLongTaskObserver: () => null,
    })

    const snapshots: ReturnType<typeof monitor.getSnapshot>[] = []
    monitor.subscribe((snapshot) => snapshots.push({ ...snapshot }))

    monitor.start()
    monitor.onRouteChange('/backtests')

    for (let i = 0; i < 5; i++) {
      now += 16
      rafCb?.(now)
    }

    rafCb?.(now + 16)

    canvases.push(document.createElement('canvas'))
    monitor.getSnapshot()

    monitor.setRouteMountQueryCount(3)
    monitor.setCinematicStats({ qualityMode: 'launcher', loopActive: true })
    monitor.stop()

    const latest = monitor.getSnapshot()
    expect(latest?.currentRoute).toBe('/backtests')
    expect(latest?.fps).toBeGreaterThan(0)
    expect(latest?.routeSettleMs).toBe(32)
    expect(latest?.canvasCount).toBe(1)
    expect(latest?.routeMountQueryCount).toBe(3)
    expect(latest?.cinematicQualityMode).toBe('launcher')
    expect(latest?.cinematicLoopActive).toBe(true)
  })
})

describe('performanceMonitor singleton', () => {
  afterEach(() => {
    resetPerformanceMonitorForTests()
    resetAnimationLoopRegistry()
    vi.restoreAllMocks()
  })

  it('resets shared monitor for tests', () => {
    const monitor = createPerformanceMonitor({
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: vi.fn(),
      now: () => 0,
      countCanvases: () => 0,
      createLongTaskObserver: () => null,
    })
    monitor.start()
    resetPerformanceMonitorForTests()
    expect(monitor.getSnapshot().fps).toBe(0)
  })
})

describe('performanceMonitor default browser deps', () => {
  afterEach(() => {
    resetPerformanceMonitorForTests()
    vi.restoreAllMocks()
  })

  it('start/stop with default deps does not throw when timers are invoked as object methods', () => {
    const monitor = createPerformanceMonitor()
    expect(() => monitor.start()).not.toThrow()
    expect(() => monitor.stop()).not.toThrow()
  })

  it('stop clears the canvas polling interval', () => {
    let intervalId: ReturnType<typeof setInterval> | undefined
    let clearedId: ReturnType<typeof setInterval> | undefined

    const monitor = createPerformanceMonitor({
      setInterval: (cb, ms) => {
        void cb
        void ms
        intervalId = 77 as unknown as ReturnType<typeof setInterval>
        return intervalId
      },
      clearInterval: (id) => {
        clearedId = id
      },
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      now: () => 0,
      countCanvases: () => 0,
      createLongTaskObserver: () => null,
    })

    monitor.start()
    monitor.stop()
    expect(intervalId).toBe(77)
    expect(clearedId).toBe(77)
  })

  it('tracks canvas count via polling when setInterval is available', () => {
    vi.useFakeTimers()
    let canvasCount = 0
    const monitor = createPerformanceMonitor({
      setInterval: (cb, ms) => {
        expect(ms).toBe(1000)
        return setInterval(cb, ms) as unknown as ReturnType<typeof setInterval>
      },
      clearInterval: (id) => clearInterval(id as unknown as NodeJS.Timeout),
      countCanvases: () => canvasCount,
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      now: () => 0,
      createLongTaskObserver: () => null,
    })

    const polledCounts: number[] = []
    monitor.subscribe((snapshot) => polledCounts.push(snapshot.canvasCount))

    monitor.start()
    expect(polledCounts.at(-1)).toBe(0)

    canvasCount = 3
    vi.advanceTimersByTime(1000)
    expect(polledCounts.at(-1)).toBe(3)
    monitor.stop()
    vi.useRealTimers()
  })

  it('rejects unbound timer refs when called as object properties (Chromium illegal invocation)', () => {
    function illegalSetInterval(this: Window | undefined, cb: () => void, ms: number) {
      void cb
      void ms
      if (typeof window !== 'undefined' && this !== window) {
        throw new TypeError('Illegal invocation')
      }
      return 1
    }

    const deps = { setInterval: illegalSetInterval as unknown as typeof setInterval }
    expect(() => deps.setInterval(() => {}, 1000)).toThrow('Illegal invocation')

    const bound = illegalSetInterval.bind(window) as unknown as typeof setInterval
    expect(() => bound(() => {}, 1000)).not.toThrow()
  })
})
