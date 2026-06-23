import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PerformanceHud } from '@/components/performance/PerformanceHud'
import { usePerformanceStore } from '@/lib/performance/usePerformanceStore'

vi.mock('@/lib/env', () => ({
  env: {
    perfHud: false,
    isDev: true,
    apiBaseUrl: 'http://127.0.0.1:8000',
    enableMsw: false,
  },
}))

describe('PerformanceHud', () => {
  afterEach(() => {
    usePerformanceStore.setState({
      enabled: false,
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
    })
  })

  it('is absent when the perf flag is disabled', () => {
    usePerformanceStore.setState({ enabled: false })
    render(<PerformanceHud />)
    expect(screen.queryByTestId('performance-hud')).not.toBeInTheDocument()
  })

  it('renders metrics when the perf flag is enabled', () => {
    usePerformanceStore.setState({
      enabled: true,
      fps: 58,
      droppedFrames: 2,
      longTaskCount: 1,
      canvasCount: 1,
      animationLoopCount: 1,
      currentRoute: '/backtests',
      routeSettleMs: 42,
      routeMountQueryCount: 5,
      inactiveRouteRefetchCount: 0,
    })

    render(<PerformanceHud />)

    expect(screen.getByTestId('performance-hud')).toBeInTheDocument()
    expect(screen.getByText(/FPS 58/)).toBeInTheDocument()
    expect(screen.getByText(/canvas 1/)).toBeInTheDocument()
    expect(screen.getByText(/\/backtests/)).toBeInTheDocument()
    expect(screen.getByText(/settle 42ms/)).toBeInTheDocument()
    expect(screen.getByText(/mount queries 5/)).toBeInTheDocument()
  })
})
