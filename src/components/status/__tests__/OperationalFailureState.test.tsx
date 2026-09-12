/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OperationalFailureState } from '@/components/status/OperationalFailureState'
import {
  getAnimationLoopCount,
  resetAnimationLoopRegistry,
} from '@/lib/performance/animationLoopRegistry'

const mockRender = vi.fn()
const mockSetSize = vi.fn()
const mockLoseContext = vi.fn()

const { MockRenderer } = vi.hoisted(() => {
  const MockRenderer = vi.fn(function MockRenderer(this: any) {
    this.gl = {
      clearColor: vi.fn(),
      canvas: document.createElement('canvas'),
      getExtension: vi.fn(() => ({ loseContext: mockLoseContext })),
    }
    this.setSize = mockSetSize
    this.render = mockRender
    this.dpr = 1
  })
  return { MockRenderer }
})

vi.mock('ogl', () => {
  class MockColor {
    r = 0
    g = 0
    b = 0
    constructor(a?: number, b?: number, c?: number) {
      void a
      void b
      void c
    }
  }

  return {
    Color: MockColor,
    Triangle: vi.fn(function Triangle() {
      return { attributes: { uv: {} } }
    }),
    Program: vi.fn(function Program(_gl: unknown, config: any) {
      return { uniforms: config.uniforms }
    }),
    Mesh: vi.fn(function Mesh() {
      return {}
    }),
    Renderer: MockRenderer,
  }
})

vi.mock('@/lib/motion/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}))

import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { Renderer } from 'ogl'

describe('OperationalFailureState', () => {
  beforeEach(() => {
    resetAnimationLoopRegistry()
    vi.mocked(useReducedMotion).mockReturnValue(false)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    mockRender.mockClear()
    mockSetSize.mockClear()
    mockLoseContext.mockClear()
    MockRenderer.mockClear()
    global.ResizeObserver = class {
      observe = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof ResizeObserver
    global.IntersectionObserver = class {
      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
    } as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    resetAnimationLoopRegistry()
  })

  it('renders title, description, and optional code', () => {
    render(
      <OperationalFailureState
        title="Market data unavailable"
        description="Historical data for PETR4 is unavailable right now."
        code="MD-HISTORY"
      />,
    )

    expect(screen.getByRole('alert')).toHaveAttribute('data-testid', 'operational-failure-state')
    expect(screen.getByText('Market data unavailable')).toBeInTheDocument()
    expect(
      screen.getByText('Historical data for PETR4 is unavailable right now.'),
    ).toBeInTheDocument()
    expect(screen.getByText('MD-HISTORY')).toBeInTheDocument()
  })

  it('calls onRetry when Retry is activated', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <OperationalFailureState
        title="View unavailable"
        description="Couldn’t load charts."
        onRetry={onRetry}
      />,
    )

    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('omits Retry when onRetry is not provided', () => {
    render(<OperationalFailureState title="Unavailable" description="No retry path." />)
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })

  it('marks the terminal field aria-hidden and mounts under the failure surface', () => {
    render(<OperationalFailureState title="Unavailable" description="System offline." />)
    const field = screen.getByTestId('faulty-terminal-field')
    expect(field).toHaveAttribute('aria-hidden', 'true')
    expect(MockRenderer).toHaveBeenCalled()
  })

  it('renders a static field under reduced motion with no animation loop', async () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    render(<OperationalFailureState title="Unavailable" description="Static grid." />)

    const field = screen.getByTestId('faulty-terminal-field')
    expect(field).toHaveAttribute('data-reduced-motion', 'true')
    expect(field).toHaveAttribute('data-loop-active', 'false')
    await waitFor(() => {
      expect(getAnimationLoopCount()).toBe(0)
    })
  })

  it('survives WebGL init failure and keeps HTML content usable', () => {
    vi.mocked(Renderer).mockImplementationOnce(() => {
      throw new Error('WebGL unavailable')
    })

    render(
      <OperationalFailureState
        title="Unavailable"
        description="Still readable."
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByTestId('faulty-terminal-field')).toHaveAttribute('data-webgl-failed', 'true')
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('disposes WebGL on unmount', () => {
    const disconnect = vi.fn()
    global.ResizeObserver = class {
      observe = vi.fn()
      disconnect = disconnect
    } as unknown as typeof ResizeObserver

    const { unmount } = render(
      <OperationalFailureState title="Unavailable" description="Dispose me." />,
    )
    expect(MockRenderer).toHaveBeenCalled()
    unmount()
    expect(disconnect).toHaveBeenCalled()
    expect(mockLoseContext).toHaveBeenCalled()
    expect(getAnimationLoopCount()).toBe(0)
  })

  it('applies compact layout attributes', () => {
    render(
      <OperationalFailureState
        compact
        title="View unavailable"
        description="Couldn’t load this view."
        testId="feature-island-error"
      />,
    )
    expect(screen.getByTestId('feature-island-error')).toHaveAttribute('data-compact', 'true')
  })
})
