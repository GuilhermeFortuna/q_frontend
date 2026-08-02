/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AiStrategyPanel } from '@/components/backtests/setup/AiStrategyPanel'
import type { AiStrategySession } from '@/lib/strategies/useAiStrategySession'

vi.mock('@/components/backtests/setup/AiInferenceSignal', () => ({
  AiInferenceSignal: ({ state, variant }: { state: string; variant: string }) => (
    <div data-testid="ai-inference-signal" data-visual-state={state} data-variant={variant} />
  ),
}))

vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn((selector) =>
    selector({
      motionMode: 'full',
    } as any),
  ),
}))

function buildSession(overrides: Partial<AiStrategySession> = {}): AiStrategySession {
  return {
    message: '',
    setMessage: vi.fn(),
    conversation: [],
    transcript: [],
    draftSpec: null,
    previewSpec: null,
    response: null,
    serviceError: null,
    interpretFailed: false,
    doneHoldActive: false,
    clearDoneHold: vi.fn(),
    hasIncrementalOutput: false,
    saveError: null,
    validationErrors: [],
    unsupportedRequests: [],
    assumptions: [],
    unsupportedAcknowledged: false,
    setUnsupportedAcknowledged: vi.fn(),
    appliedToSetup: false,
    activeAiDraft: false,
    workflowBlocker: null,
    canSave: false,
    revisionDiff: [],
    revisions: [],
    interpretMutation: { isPending: false } as AiStrategySession['interpretMutation'],
    selectedModel: { provider: 'openai_compatible', model: 'test-model-a' },
    setSelectedModel: vi.fn(),
    availableModels: [
      {
        id: 'test-model-a',
        label: 'Model A',
        available: true,
        provider: 'openai_compatible',
      },
    ],
    modelProviders: [{ id: 'openai_compatible', label: 'Local (Ollama)' }],
    hasProviderContract: true,
    provider: 'openai_compatible',
    modelsLoading: false,
    modelsError: null,
    submitInterpret: vi.fn(),
    handleApplyToSetup: vi.fn(),
    handleSaveAiStrategy: vi.fn(),
    handleDuplicate: vi.fn(),
    handleExport: vi.fn(),
    handleRunBacktest: vi.fn(),
    handleOptimize: vi.fn(),
    resetDraft: vi.fn(),
    hydrateFromMetadata: vi.fn(),
    updateDraft: vi.fn(),
    answeringQuestion: null,
    setAnsweringQuestion: vi.fn(),
    ...overrides,
  } as unknown as AiStrategySession
}

describe('AiStrategyPanel inference signal', () => {
  it('mounts exactly one signal outside AnimatePresence in workspace mode', () => {
    render(<AiStrategyPanel session={buildSession()} hideHeader />)
    expect(screen.getAllByTestId('ai-inference-signal')).toHaveLength(1)
    expect(screen.getByTestId('ai-inference-signal-slot')).toBeInTheDocument()
  })

  it('uses hero variant in empty state', () => {
    render(<AiStrategyPanel session={buildSession()} hideHeader />)
    expect(screen.getByTestId('ai-inference-signal')).toHaveAttribute('data-variant', 'hero')
  })

  it('keeps the same signal mounted and switches to compact when conversation starts', () => {
    const { rerender } = render(<AiStrategyPanel session={buildSession()} hideHeader />)

    rerender(
      <AiStrategyPanel
        session={buildSession({
          transcript: [
            {
              id: 'u1',
              kind: 'user',
              content: 'Buy pullbacks',
            },
          ],
        })}
        hideHeader
      />,
    )

    expect(screen.getAllByTestId('ai-inference-signal')).toHaveLength(1)
    expect(screen.getByTestId('ai-inference-signal')).toHaveAttribute('data-variant', 'compact')
  })

  it('derives thinking state from pending interpret mutation', () => {
    render(
      <AiStrategyPanel
        session={buildSession({
          interpretMutation: { isPending: true } as AiStrategySession['interpretMutation'],
        })}
        hideHeader
      />,
    )
    expect(screen.getByTestId('ai-inference-signal')).toHaveAttribute('data-visual-state', 'thinking')
  })

  it('does not mount the signal in compact backtests panel mode', () => {
    render(<AiStrategyPanel session={buildSession()} hideHeader={false} />)
    expect(screen.queryByTestId('ai-inference-signal')).not.toBeInTheDocument()
  })
})
