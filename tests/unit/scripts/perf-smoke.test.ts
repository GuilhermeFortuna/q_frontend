import { describe, expect, it } from 'vitest'

import {
  classifyConsoleMessage,
  evaluateRouteSample,
  parsePerfConsoleLine,
  PERF_BUDGETS,
  ROUTE_SMOKE_PATHS,
  summarizeSmokeRun,
} from '@/lib/performance/perfSmokeLib'

describe('perf-smoke-lib', () => {
  it('lists the core runtime routes', () => {
    expect(ROUTE_SMOKE_PATHS.map((r) => r.path)).toEqual([
      '/',
      '/backtests',
      '/discover',
      '/market-data',
    ])
  })

  it('classifies GPU-ish console warnings', () => {
    const gpu = classifyConsoleMessage('WebGL context lost', 'warning')
    expect(gpu.bucket).toBe('gpu')
    const ignored = classifyConsoleMessage('Download the React DevTools', 'info')
    expect(ignored.bucket).toBe('ignored')
  })

  it('parses [perf] console JSON', () => {
    const parsed = parsePerfConsoleLine('[perf] {"route":"/","fps":58,"canvases":1}')
    expect(parsed).toEqual({ route: '/', fps: 58, canvases: 1 })
  })

  it('flags budget warnings without failing clean samples', () => {
    const clean = evaluateRouteSample({
      path: '/backtests',
      label: 'backtests',
      workspace: 'backtests',
      navigationMs: 1200,
      settleMs: 80,
      canvasCount: 0,
      animationLoops: 0,
      routeMountQueries: 5,
      fps: 58,
      longTasks: 1,
      hudVisible: false,
      hasVisible3dWorkspace: false,
      consoleErrors: [],
      gpuWarnings: [],
    })
    expect(clean.ok).toBe(true)
    expect(clean.warnings).toHaveLength(0)

    const hot = evaluateRouteSample({
      path: '/backtests',
      label: 'backtests',
      workspace: 'backtests',
      navigationMs: 9000,
      settleMs: 80,
      canvasCount: 2,
      animationLoops: 1,
      routeMountQueries: 99,
      fps: 40,
      longTasks: 5,
      hudVisible: true,
      hasVisible3dWorkspace: false,
      consoleErrors: ['TypeError: boom'],
      gpuWarnings: [],
    })
    expect(hot.ok).toBe(false)
    expect(hot.issues.length).toBeGreaterThan(0)
    expect(hot.warnings.some((w) => w.includes('fps'))).toBe(true)
    expect(hot.warnings.some((w) => w.includes('mount queries'))).toBe(true)
  })

  it('summarizes a smoke run', () => {
    const summary = summarizeSmokeRun([
      { path: '/', label: 'launcher', ok: true, issues: [], warnings: [] },
      {
        path: '/backtests',
        label: 'backtests',
        ok: false,
        issues: ['console errors: 1'],
        warnings: [],
      },
    ])
    expect(summary.routes).toBe(2)
    expect(summary.failed).toBe(1)
    expect(summary.ok).toBe(false)
  })

  it('documents WO96 budget mirrors', () => {
    expect(PERF_BUDGETS.targetFps).toBeGreaterThanOrEqual(55)
    expect(PERF_BUDGETS.routeMountQueryBudgets.backtests).toBe(20)
  })
})
