import type { Query, QueryCacheNotifyEvent, QueryClient } from '@tanstack/react-query'

import { getPerformanceMonitor } from '@/lib/performance/performanceMonitor'

const queryHomeRoute = new WeakMap<Query, string>()
const queryLastFetchGeneration = new WeakMap<Query, number>()

let activeRoute = '/'
let routeGeneration = 0
let routeMountQueryCount = 0
let inactiveRouteRefetchCount = 0
let unsubscribeCache: (() => void) | null = null

function syncCountsToMonitor() {
  const monitor = getPerformanceMonitor()
  monitor.setRouteMountQueryCount(routeMountQueryCount)
  monitor.setInactiveRouteRefetchCount(inactiveRouteRefetchCount)
}

function handleCacheEvent(event: QueryCacheNotifyEvent) {
  if (event.type !== 'updated') return

  const action = event.action
  if (!action || action.type !== 'fetch') return

  const query = event.query
  const homeRoute = queryHomeRoute.get(query)

  if (homeRoute !== undefined && homeRoute !== activeRoute) {
    inactiveRouteRefetchCount++
    syncCountsToMonitor()
    return
  }

  if (queryLastFetchGeneration.get(query) !== routeGeneration) {
    queryLastFetchGeneration.set(query, routeGeneration)
    queryHomeRoute.set(query, activeRoute)
    routeMountQueryCount++
    syncCountsToMonitor()
  }
}

export function setQueryInstrumentationRoute(pathname: string): void {
  activeRoute = pathname
  routeGeneration++
  routeMountQueryCount = 0
  syncCountsToMonitor()
}

export function attachQueryInstrumentation(queryClient: QueryClient): () => void {
  if (unsubscribeCache) {
    return unsubscribeCache
  }

  unsubscribeCache = queryClient.getQueryCache().subscribe(handleCacheEvent)
  syncCountsToMonitor()

  return () => {
    unsubscribeCache?.()
    unsubscribeCache = null
    activeRoute = '/'
    routeGeneration = 0
    routeMountQueryCount = 0
    inactiveRouteRefetchCount = 0
  }
}

export function getQueryInstrumentationCounts(): {
  routeMountQueryCount: number
  inactiveRouteRefetchCount: number
} {
  return { routeMountQueryCount, inactiveRouteRefetchCount }
}

/** Test helper */
export function resetQueryInstrumentationForTests(): void {
  unsubscribeCache?.()
  unsubscribeCache = null
  activeRoute = '/'
  routeGeneration = 0
  routeMountQueryCount = 0
  inactiveRouteRefetchCount = 0
}
