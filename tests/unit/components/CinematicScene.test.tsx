/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CinematicScene } from '@/components/cinematic/CinematicScene'
import { resetAnimationLoopRegistry } from '@/lib/performance/animationLoopRegistry'
import { resetPerformanceMonitorForTests } from '@/lib/performance/performanceMonitor'
import { useAppStore } from '@/store/useAppStore'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, frameloop }: any) => (
    <div data-testid="cinematic-canvas" data-frameloop={frameloop}>
      {children}
    </div>
  ),
  useFrame: () => undefined,
}))

vi.mock('@/components/cinematic/CinematicParticles', () => ({
  CinematicParticles: () => <div data-testid="cinematic-particles" />,
}))

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
    resetAnimationLoopRegistry()
    resetPerformanceMonitorForTests()
    setReducedMotion(false)
    useAppStore.setState({ activeWorkspace: 'launcher' })
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  afterEach(() => {
    resetAnimationLoopRegistry()
    resetPerformanceMonitorForTests()
    vi.restoreAllMocks()
  })

  it('renders for the launcher workspace', () => {
    render(<CinematicScene />)

    expect(screen.getByTestId('cinematic-scene')).toBeInTheDocument()
    expect(screen.getByTestId('cinematic-scene')).toHaveAttribute('data-quality-mode', 'launcher')
    expect(screen.getByTestId('cinematic-canvas')).toBeInTheDocument()
  })

  it('disables the animation loop when reduced motion is preferred', () => {
    setReducedMotion(true)

    render(<CinematicScene />)

    expect(screen.getByTestId('cinematic-scene')).toHaveAttribute(
      'data-quality-mode',
      'reduced-motion',
    )
    expect(screen.getByTestId('cinematic-scene')).toHaveAttribute('data-loop-active', 'false')
    expect(screen.queryByTestId('cinematic-canvas')).not.toBeInTheDocument()
  })

  it('pauses the canvas frameloop when the document is hidden', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })

    render(<CinematicScene />)

    expect(screen.getByTestId('cinematic-canvas')).toHaveAttribute('data-frameloop', 'never')
    expect(screen.getByTestId('cinematic-scene')).toHaveAttribute('data-loop-active', 'false')
  })

  it('uses analysis quality on operational workspaces', () => {
    useAppStore.setState({ activeWorkspace: 'backtests' })

    render(<CinematicScene />)

    expect(screen.getByTestId('cinematic-scene')).toHaveAttribute('data-quality-mode', 'analysis')
    expect(screen.queryByTestId('cinematic-canvas')).not.toBeInTheDocument()
  })
})
