/**
 * Observability-first performance budgets for Q's cinematic shell.
 *
 * These constants document expected ceilings for later WOs. They are not
 * enforced in CI yet — use the dev HUD (VITE_PERF_HUD=true) to compare live
 * readings against these targets.
 */

/** Target frame rate in browser dev; readings below this warrant investigation. */
export const TARGET_FPS = 55

/** Frame budget at 60 Hz; used for dropped-frame heuristics. */
export const FRAME_BUDGET_MS = 1000 / 60

/** Long-task warning threshold (Performance API longtask entries). */
export const LONG_TASK_WARNING_MS = 50

/**
 * Max always-on `<canvas>` elements outside explicit 3D workspaces.
 * The app shell should not leave stray canvases mounted globally.
 */
export const MAX_ALWAYS_ON_CANVASES_OUTSIDE_3D = 0

/**
 * Max app-shell animation loops (rAF / useFrame) outside the cinematic renderer.
 * Shell chrome should be compositor-driven, not continuously repainting.
 */
export const MAX_APP_SHELL_ANIMATION_LOOPS = 0

/**
 * Soft ceiling for queries that start fetching on initial route mount.
 * Counts are route-specific; tune as features grow.
 */
export const ROUTE_MOUNT_QUERY_BUDGETS = {
  launcher: 12,
  backtests: 20,
  discover: 16,
  'market-data': 18,
  'strategy-builder': 20,
} as const

/** Route-scoped feature renderer budgets (exception to global shell ceilings). */
export const ROUTE_FEATURE_RENDERER_BUDGETS = {
  'strategy-builder': { canvases: 1, animationLoops: 1 },
} as const

export type BudgetedRoute = keyof typeof ROUTE_MOUNT_QUERY_BUDGETS
export type FeatureRendererBudgetedRoute = keyof typeof ROUTE_FEATURE_RENDERER_BUDGETS

export function routeBudgetKey(pathname: string): BudgetedRoute | null {
  if (pathname === '/' || pathname === '') return 'launcher'
  if (pathname.startsWith('/strategy-builder')) return 'strategy-builder'
  if (pathname.startsWith('/backtests')) return 'backtests'
  if (pathname.startsWith('/discover')) return 'discover'
  if (pathname.startsWith('/market-data')) return 'market-data'
  return null
}

export function routeFeatureRendererBudgetKey(pathname: string): FeatureRendererBudgetedRoute | null {
  if (pathname.startsWith('/strategy-builder')) return 'strategy-builder'
  return null
}

export function routeMountQueryBudget(pathname: string): number | null {
  const key = routeBudgetKey(pathname)
  return key ? ROUTE_MOUNT_QUERY_BUDGETS[key] : null
}

export function routeFeatureRendererBudget(pathname: string): {
  canvases: number
  animationLoops: number
} | null {
  const key = routeFeatureRendererBudgetKey(pathname)
  return key ? ROUTE_FEATURE_RENDERER_BUDGETS[key] : null
}
