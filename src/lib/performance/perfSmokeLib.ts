/**
 * Shared helpers for runtime performance smoke checks (WO101).
 */

import {
  MAX_ALWAYS_ON_CANVASES_OUTSIDE_3D,
  MAX_APP_SHELL_ANIMATION_LOOPS,
  ROUTE_MOUNT_QUERY_BUDGETS,
  TARGET_FPS,
} from '@/lib/performance/budgets'

export const ROUTE_SMOKE_PATHS = [
  { path: '/', label: 'launcher', workspace: 'launcher' as const },
  { path: '/backtests', label: 'backtests', workspace: 'backtests' as const },
  { path: '/discover', label: 'discover', workspace: 'discover' as const },
  { path: '/market-data', label: 'market-data', workspace: 'market-data' as const },
]

export const PERF_BUDGETS = {
  targetFps: TARGET_FPS,
  longTaskWarningMs: 50,
  maxAlwaysOnCanvasesOutside3d: MAX_ALWAYS_ON_CANVASES_OUTSIDE_3D,
  maxAppShellAnimationLoops: MAX_APP_SHELL_ANIMATION_LOOPS,
  routeMountQueryBudgets: ROUTE_MOUNT_QUERY_BUDGETS,
}

export type RouteSample = {
  path: string
  label: string
  workspace: keyof typeof ROUTE_MOUNT_QUERY_BUDGETS
  navigationMs: number
  settleMs: number | null
  canvasCount: number
  animationLoops: number
  routeMountQueries: number
  fps: number | null
  longTasks: number
  hudVisible: boolean
  hasVisible3dWorkspace: boolean
  consoleErrors: string[]
  gpuWarnings: string[]
}

export type RouteEvalResult = {
  path: string
  label: string
  ok: boolean
  issues: string[]
  warnings: string[]
}

const GPU_WARNING_PATTERNS = [
  /webgl/i,
  /gpu/i,
  /compositor/i,
  /webkit/i,
  /nvidia/i,
  /wayland/i,
  /glx/i,
  /vulkan/i,
  /shader/i,
]

const IGNORED_CONSOLE_PATTERNS = [
  /favicon\.ico/i,
  /mockServiceWorker/i,
  /Download the React DevTools/i,
]

export function classifyConsoleMessage(
  text: string,
  type: 'error' | 'warning' | 'info' | string,
): { bucket: string; text: string; type: string } {
  if (!text || IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text))) {
    return { bucket: 'ignored', text, type }
  }
  if (type === 'error') {
    return { bucket: 'error', text, type }
  }
  if (GPU_WARNING_PATTERNS.some((re) => re.test(text))) {
    return { bucket: 'gpu', text, type }
  }
  if (type === 'warning') {
    return { bucket: 'warning', text, type }
  }
  return { bucket: 'info', text, type }
}

export function evaluateRouteSample(sample: RouteSample): RouteEvalResult {
  const issues: string[] = []
  const warnings: string[] = []
  const budget = PERF_BUDGETS.routeMountQueryBudgets[sample.workspace]

  if (sample.consoleErrors.length > 0) {
    issues.push(`console errors: ${sample.consoleErrors.length}`)
  }

  if (sample.navigationMs > 8000) {
    warnings.push(`slow navigation ${sample.navigationMs}ms`)
  }

  if (sample.settleMs != null && sample.settleMs > 500) {
    warnings.push(`slow route settle ${sample.settleMs}ms`)
  }

  if (
    sample.workspace !== 'launcher' &&
    sample.canvasCount > PERF_BUDGETS.maxAlwaysOnCanvasesOutside3d
  ) {
    warnings.push(
      `canvas count ${sample.canvasCount} > shell budget ${PERF_BUDGETS.maxAlwaysOnCanvasesOutside3d} outside launcher/3D`,
    )
  }

  if (sample.workspace === 'launcher' && sample.canvasCount > 1 && !sample.hasVisible3dWorkspace) {
    warnings.push(`launcher canvas count ${sample.canvasCount} (expected ≤1 cinematic canvas)`)
  }

  if (
    sample.animationLoops > PERF_BUDGETS.maxAppShellAnimationLoops &&
    sample.workspace !== 'launcher'
  ) {
    warnings.push(
      `animation loops ${sample.animationLoops} > shell budget ${PERF_BUDGETS.maxAppShellAnimationLoops}`,
    )
  }

  if (budget != null && sample.routeMountQueries > budget) {
    warnings.push(`mount queries ${sample.routeMountQueries} > budget ${budget}`)
  }

  if (sample.fps != null && sample.fps > 0 && sample.fps < PERF_BUDGETS.targetFps) {
    warnings.push(`fps ${sample.fps} < target ${PERF_BUDGETS.targetFps}`)
  }

  if (sample.longTasks > 3) {
    warnings.push(`long tasks ${sample.longTasks} (investigate >3 after settle)`)
  }

  return {
    path: sample.path,
    label: sample.label,
    ok: issues.length === 0,
    issues,
    warnings,
  }
}

export function summarizeSmokeRun(results: RouteEvalResult[]) {
  const failed = results.filter((r) => !r.ok)
  const warned = results.filter((r) => r.warnings.length > 0)
  return {
    routes: results.length,
    failed: failed.length,
    warned: warned.length,
    ok: failed.length === 0,
    results,
  }
}

export function parsePerfConsoleLine(text: string): Record<string, unknown> | null {
  if (!text.includes('[perf]')) return null
  const jsonStart = text.indexOf('{')
  if (jsonStart === -1) return null
  try {
    return JSON.parse(text.slice(jsonStart)) as Record<string, unknown>
  } catch {
    return null
  }
}
