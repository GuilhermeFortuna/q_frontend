import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'

import { env } from '@/lib/env'
import { routeMountQueryBudget } from '@/lib/performance/budgets'
import { getPerformanceMonitor } from '@/lib/performance/performanceMonitor'
import {
  attachQueryInstrumentation,
  setQueryInstrumentationRoute,
} from '@/lib/performance/queryInstrumentation'
import { startPerformanceCollection } from '@/lib/performance/usePerformanceStore'
import { PerformanceHud } from '@/components/performance/PerformanceHud'

function logRoutePerf(pathname: string) {
  const monitor = getPerformanceMonitor()
  const snapshot = monitor.getSnapshot()
  const budget = routeMountQueryBudget(pathname)

  console.info('[perf]', {
    route: pathname,
    fps: snapshot.fps,
    canvases: snapshot.canvasCount,
    animationLoops: snapshot.animationLoopCount,
    cinematicQuality: snapshot.cinematicQualityMode,
    cinematicLoop: snapshot.cinematicLoopActive,
    routeMountQueries: snapshot.routeMountQueryCount,
    queryBudget: budget,
    inactiveRefetches: snapshot.inactiveRouteRefetchCount,
    longTasks: snapshot.longTaskCount,
    routeSettleMs: snapshot.routeSettleMs,
  })
}

export function PerformanceInstrumentation() {
  const location = useLocation()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!env.perfHud) return
    return startPerformanceCollection()
  }, [])

  useEffect(() => {
    if (!env.perfHud) return
    window.__Q_PERF_SNAPSHOT__ = () => getPerformanceMonitor().getSnapshot()
    return () => {
      delete window.__Q_PERF_SNAPSHOT__
    }
  }, [])

  useEffect(() => {
    if (!env.perfHud || !queryClient) return
    return attachQueryInstrumentation(queryClient)
  }, [queryClient])

  useEffect(() => {
    if (!env.perfHud) return

    const pathname = location.pathname
    setQueryInstrumentationRoute(pathname)
    getPerformanceMonitor().onRouteChange(pathname)

    const logTimer = window.setTimeout(() => logRoutePerf(pathname), 1500)
    return () => window.clearTimeout(logTimer)
  }, [location.pathname])

  if (!env.perfHud) {
    return null
  }

  return <PerformanceHud />
}
