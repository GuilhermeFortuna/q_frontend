/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AiInferenceSignal } from '@/components/backtests/setup/AiInferenceSignal'
import {
  deriveAiVisualState,
  visualStateLabel,
  visualStateToSignalProps,
} from '@/components/backtests/setup/aiVisualState'
import { AI_VISUAL_DONE_HOLD_MS } from '@/lib/strategies/useAiStrategySession'
import { resetAnimationLoopRegistry } from '@/lib/performance/animationLoopRegistry'

const mockRender = vi.fn()
const mockSetSize = vi.fn()
const mockLoseContext = vi.fn()

const { MockRenderer } = vi.hoisted(() => {
  const MockRenderer = vi.fn(function MockRenderer(this: any) {
    this.gl = {
      clearColor: vi.fn(),
      enable: vi.fn(),
      blendFunc: vi.fn(),
      BLEND: 1,
      ONE: 1,
      ONE_MINUS_SRC_ALPHA: 2,
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
    constructor(hex: string) {
      void hex
    }
  }

  return {
    Color: MockColor,
    Triangle: vi.fn(function Triangle() {
      return { attributes: {} }
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

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: '/strategy-builder' }),
}))

vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn((selector) =>
    selector({
      activeWorkspace: 'strategy-builder',
    }),
  ),
}))

vi.mock('@/lib/motion/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}))

import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { Renderer } from 'ogl'

describe('aiVisualState', () => {
  it('applies precedence: error beats all other states', () => {
    expect(
      deriveAiVisualState({
        serviceError: 'Unavailable',
        interpretFailed: false,
        isPending: true,
        hasIncrementalOutput: true,
        isDoneHold: true,
        composerFocused: true,
        message: 'draft',
      }),
    ).toBe('error')
  })

  it('never emits streaming without incremental output', () => {
    expect(
      deriveAiVisualState({
        serviceError: null,
        interpretFailed: false,
        isPending: true,
        hasIncrementalOutput: false,
        isDoneHold: false,
        composerFocused: false,
        message: '',
      }),
    ).toBe('thinking')
  })

  it('emits streaming only with real incremental output', () => {
    expect(
      deriveAiVisualState({
        serviceError: null,
        interpretFailed: false,
        isPending: true,
        hasIncrementalOutput: true,
        isDoneHold: false,
        composerFocused: false,
        message: '',
      }),
    ).toBe('streaming')
  })

  it('holds done state during the 900ms window', () => {
    expect(
      deriveAiVisualState({
        serviceError: null,
        interpretFailed: false,
        isPending: false,
        hasIncrementalOutput: false,
        isDoneHold: true,
        composerFocused: true,
        message: 'still typing',
      }),
    ).toBe('done')
  })

  it('falls through to composing when focused with non-whitespace input', () => {
    expect(
      deriveAiVisualState({
        serviceError: null,
        interpretFailed: false,
        isPending: false,
        hasIncrementalOutput: false,
        isDoneHold: false,
        composerFocused: true,
        message: '  momentum idea  ',
      }),
    ).toBe('composing')
  })

  it('treats whitespace-only input as idle when focused', () => {
    expect(
      deriveAiVisualState({
        serviceError: null,
        interpretFailed: false,
        isPending: false,
        hasIncrementalOutput: false,
        isDoneHold: false,
        composerFocused: true,
        message: '   \n  ',
      }),
    ).toBe('idle')
  })

  it('maps operational labels for each state', () => {
    expect(visualStateLabel('idle')).toBe('AI idle')
    expect(visualStateLabel('composing')).toBe('Drafting prompt')
    expect(visualStateLabel('thinking')).toBe('Interpreting strategy')
    expect(visualStateLabel('streaming')).toBe('Presenting response')
    expect(visualStateLabel('done')).toBe('Strategy ready')
    expect(visualStateLabel('error')).toBe('AI unavailable')
  })

  it('maps deterministic uniform props per state', () => {
    const idle = visualStateToSignalProps('idle')
    const thinking = visualStateToSignalProps('thinking')
    const error = visualStateToSignalProps('error')

    expect(idle.count).toBeLessThanOrEqual(thinking.count)
    expect(thinking.speed).toBeGreaterThan(idle.speed)
    expect(error.colors).toContain('#f87171')
    expect(idle.scale).toBe(5.0)
    expect(thinking.scale).toBeLessThan(idle.scale)
  })

  it('documents the done hold duration constant', () => {
    expect(AI_VISUAL_DONE_HOLD_MS).toBe(900)
  })
})

describe('AiInferenceSignal', () => {
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
  })

  afterEach(() => {
    resetAnimationLoopRegistry()
  })

  it('renders status label and visual state attributes', () => {
    render(<AiInferenceSignal state="thinking" variant="hero" />)

    const signal = screen.getByTestId('ai-inference-signal')
    expect(signal).toHaveAttribute('data-visual-state', 'thinking')
    expect(screen.getByRole('status')).toHaveTextContent('Interpreting strategy')
  })

  it('initializes the WebGL renderer on strategy-builder route', () => {
    render(<AiInferenceSignal state="idle" variant="hero" />)
    expect(MockRenderer).toHaveBeenCalled()
    expect(screen.getByTestId('ai-inference-signal')).toHaveAttribute('data-webgl-failed', 'false')
  })

  it('stops the loop under reduced motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    render(<AiInferenceSignal state="idle" variant="hero" />)
    expect(screen.getByTestId('ai-inference-signal')).toHaveAttribute('data-loop-active', 'false')
  })

  it('pauses the loop when the document is hidden', async () => {
    render(<AiInferenceSignal state="thinking" variant="hero" />)
    expect(MockRenderer).toHaveBeenCalled()

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => {
      expect(screen.getByTestId('ai-inference-signal')).toHaveAttribute('data-loop-active', 'false')
    })
  })

  it('survives WebGL initialization failure', () => {
    vi.mocked(Renderer).mockImplementationOnce(() => {
      throw new Error('WebGL unavailable')
    })

    render(<AiInferenceSignal state="error" variant="compact" />)

    const signal = screen.getByTestId('ai-inference-signal')
    expect(signal).toHaveAttribute('data-webgl-failed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('AI unavailable')
    expect(signal.querySelector('canvas')).not.toBeInTheDocument()
  })

  it('disposes renderer resources on unmount', () => {
    const disconnect = vi.fn()
    global.ResizeObserver = class {
      observe = vi.fn()
      disconnect = disconnect
    } as unknown as typeof ResizeObserver

    const { unmount } = render(<AiInferenceSignal state="idle" variant="compact" />)
    expect(MockRenderer).toHaveBeenCalled()
    unmount()
    expect(disconnect).toHaveBeenCalled()
    expect(mockLoseContext).toHaveBeenCalled()
  })
})
