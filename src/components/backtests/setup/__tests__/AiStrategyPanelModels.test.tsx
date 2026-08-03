import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AiStrategyPanel } from '@/components/backtests/setup/AiStrategyPanel'
import type { AiStrategySession } from '@/lib/strategies/useAiStrategySession'

vi.mock('@/components/backtests/setup/AiChatTranscript', () => ({
  AiChatTranscript: () => null,
}))

vi.mock('@/components/backtests/setup/AiInferenceSignal', () => ({
  AiInferenceSignal: ({ state, variant }: { state: string; variant: string }) => (
    <div data-testid="ai-inference-signal" data-visual-state={state} data-variant={variant} />
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
      {
        id: 'test-model-b',
        label: 'Model B',
        available: false,
        provider: 'openai_compatible',
      },
      {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        available: false,
        provider: 'gemini',
      },
    ],
    modelProviders: [
      { id: 'openai_compatible', label: 'Local (Ollama)' },
      { id: 'gemini', label: 'Gemini' },
    ],
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
    ...overrides,
  } as AiStrategySession
}

describe('AiStrategyPanel model picker', () => {
  it('shows its header by default and hides it in workspace mode', () => {
    const { rerender } = render(<AiStrategyPanel session={buildSession()} />)
    expect(screen.getByRole('heading', { name: 'AI Strategy Builder' })).toBeInTheDocument()

    rerender(<AiStrategyPanel session={buildSession()} hideHeader />)
    expect(screen.queryByRole('heading', { name: 'AI Strategy Builder' })).not.toBeInTheDocument()
  })

  it('groups models by provider and decodes the composite DOM value', async () => {
    const user = userEvent.setup()
    const setSelectedModel = vi.fn()
    render(<AiStrategyPanel session={buildSession({ setSelectedModel })} />)

    const groups = screen.getByTestId('ai-strategy-model').querySelectorAll('optgroup')
    expect([...groups].map((group) => group.label)).toEqual(['Local (Ollama)', 'Gemini'])
    expect(screen.getByRole('option', { name: 'Model B (not loaded)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Gemini 2.5 Flash' })).toBeInTheDocument()

    await user.selectOptions(screen.getByTestId('ai-strategy-model'), 'gemini::gemini-2.5-flash')

    expect(setSelectedModel).toHaveBeenCalledWith({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    })
  })
})
