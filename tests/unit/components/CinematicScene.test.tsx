import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CinematicScene } from '@/components/cinematic/CinematicScene'
import { resetPerformanceMonitorForTests } from '@/lib/performance/performanceMonitor'
import { useAppStore } from '@/store/useAppStore'

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('CinematicScene', () => {
  beforeEach(() => {
    resetPerformanceMonitorForTests()
    setReducedMotion(false)
    useAppStore.setState({ activeWorkspace: 'launcher' })
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  afterEach(() => {
    resetPerformanceMonitorForTests()
    vi.restoreAllMocks()
  })

  it('renders for the launcher workspace', () => {
    render(<CinematicScene />)

    expect(screen.getByTestId('cinematic-scene')).toBeInTheDocument()
    expect(screen.getByTestId('cinematic-scene')).toHaveAttribute('data-quality-mode', 'launcher')
  })

  it('uses the reduced-motion profile when reduced motion is preferred', () => {
    setReducedMotion(true)
    useAppStore.setState({ motionMode: 'system' })

    render(<CinematicScene />)

    expect(screen.getByTestId('cinematic-scene')).toHaveAttribute(
      'data-quality-mode',
      'reduced-motion',
    )
  })

  it('uses analysis quality on operational workspaces', () => {
    useAppStore.setState({ activeWorkspace: 'backtests' })

    render(<CinematicScene />)

    expect(screen.getByTestId('cinematic-scene')).toHaveAttribute('data-quality-mode', 'analysis')
  })
})
