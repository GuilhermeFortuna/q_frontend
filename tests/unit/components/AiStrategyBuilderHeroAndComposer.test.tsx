/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AiStrategyPanel } from '@/components/backtests/setup/AiStrategyPanel'
import { AiComposer } from '@/components/backtests/setup/AiComposer'
import { AiBuilderHero } from '@/components/backtests/setup/AiBuilderHero'
import { AiChatTranscript } from '@/components/backtests/setup/AiChatTranscript'
import type { AiStrategySession } from '@/lib/strategies/useAiStrategySession'
import { useAppStore } from '@/store/useAppStore'

vi.mock('@/components/backtests/setup/AiInferenceSignal', () => ({
  AiInferenceSignal: ({ state, variant }: { state: string; variant: string }) => (
    <div data-testid="ai-inference-signal" data-visual-state={state} data-variant={variant} />
  ),
}))

// Mock useAppStore for motion Mode
vi.mock('@/store/useAppStore', () => {
  return {
    useAppStore: vi.fn((selector) =>
      selector({
        motionMode: 'full',
      } as any),
    ),
  }
})

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
    ...overrides,
  } as unknown as AiStrategySession
}

describe('AiBuilderHero', () => {
  it('renders greeting without the retired spark emblem', () => {
    render(<AiBuilderHero />)

    expect(screen.getByText(/What are we/i)).toBeInTheDocument()
    expect(screen.getByText('building')).toBeInTheDocument()
    const hero = screen.getByTestId('ai-builder-hero')
    expect(hero.querySelector('svg path')).not.toBeInTheDocument()
  })

  it('reduced-motion → aurora disables animation via CSS media/classes', () => {
    // Set motionMode to system and mock prefers-reduced-motion
    vi.mocked(useAppStore).mockImplementation((selector) =>
      selector({
        motionMode: 'system',
      } as any),
    )
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    render(<AiBuilderHero />)
    expect(screen.getByTestId('ai-builder-hero')).toBeInTheDocument()
  })
})

describe('AiComposer', () => {
  it('Shift+Enter does not submit and inserts newline, Enter submits', async () => {
    const user = userEvent.setup()
    const submitInterpret = vi.fn()
    const setMessage = vi.fn()
    const session = buildSession({ submitInterpret, setMessage, message: 'Test message' })

    render(<AiComposer session={session} composerRef={{ current: null }} variant="pill" />)

    const textarea = screen.getByTestId('ai-strategy-message')
    await user.type(textarea, '{Shift>}{Enter}{/Shift}')
    expect(submitInterpret).not.toHaveBeenCalled()

    await user.type(textarea, '{Enter}')
    expect(submitInterpret).toHaveBeenCalledWith('Test message')
  })

  it('model selection changes session provider and model via native select overlay', async () => {
    const user = userEvent.setup()
    const setSelectedModel = vi.fn()
    const session = buildSession({ setSelectedModel })

    render(<AiComposer session={session} composerRef={{ current: null }} variant="pill" />)

    const modelSelect = screen.getByTestId('ai-strategy-model')
    await user.selectOptions(modelSelect, 'openai_compatible::test-model-b')
    expect(setSelectedModel).toHaveBeenCalledWith({
      provider: 'openai_compatible',
      model: 'test-model-b',
    })
  })

  it('send button shows Loader2 or Sparkles correctly mirroring isPending status', () => {
    const sessionPending = buildSession({
      interpretMutation: { isPending: true } as AiStrategySession['interpretMutation'],
      message: 'Hello',
    })
    const { rerender } = render(
      <AiComposer session={sessionPending} composerRef={{ current: null }} variant="pill" />,
    )

    expect(
      screen.getByTestId('ai-strategy-submit').querySelector('.animate-spin'),
    ).toBeInTheDocument()

    const sessionReady = buildSession({
      interpretMutation: { isPending: false } as AiStrategySession['interpretMutation'],
      message: 'Hello',
    })
    rerender(<AiComposer session={sessionReady} composerRef={{ current: null }} variant="pill" />)
    expect(screen.getByTestId('ai-strategy-submit').querySelector('.animate-spin')).toBeNull()
  })
})

describe('AiStrategyPanel Choreography and Hosting', () => {
  it('renders compact mode snapshot-like when hideHeader is false', () => {
    const session = buildSession()
    render(<AiStrategyPanel session={session} hideHeader={false} />)

    // No hero or pill mode
    expect(screen.queryByTestId('ai-builder-hero')).toBeNull()
    expect(screen.getByText('AI Strategy Builder')).toBeInTheDocument()
    expect(screen.getByTestId('ai-strategy-submit')).toHaveTextContent('Interpret')
  })

  it('renders hero, inference signal, and centered composer when hideHeader is true and transcript is empty', () => {
    const session = buildSession({ transcript: [] })
    render(<AiStrategyPanel session={session} hideHeader={true} />)

    expect(screen.getByTestId('ai-inference-signal')).toHaveAttribute('data-variant', 'hero')
    expect(screen.getByTestId('ai-builder-hero')).toBeInTheDocument()
    expect(screen.getAllByTestId('ai-chat-example-chip')[0]).toBeInTheDocument()
  })

  it('keeps inference signal mounted and compacts when hasConversation is true', () => {
    const session = buildSession({
      transcript: [{ id: '1', kind: 'user', content: 'test' }],
    })
    render(<AiStrategyPanel session={session} hideHeader={true} />)

    expect(screen.getByTestId('ai-inference-signal')).toHaveAttribute('data-variant', 'compact')
    expect(screen.queryByTestId('ai-builder-hero')).toBeNull()
    expect(screen.getByTestId('ai-chat-transcript')).toBeInTheDocument()
  })
})

describe('AiChatTranscript Editorial Layout & Conversational continuity (WO208)', () => {
  it('assistant turn: headline is the first sentence, remainder is body text', () => {
    const onQuestionSelect = vi.fn()
    const transcript: any[] = [
      {
        id: 'a1',
        kind: 'assistant',
        summary: 'This is the headline. This is the body sentence.',
        change_notes: [],
        questions: [],
        confidence: 0.8,
        revisionIndex: 0,
      },
    ]

    render(
      <AiChatTranscript
        transcript={transcript}
        revisions={[]}
        isPending={false}
        onQuestionSelect={onQuestionSelect}
        composerRef={{ current: null }}
      />,
    )

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('This is the headline.')
    expect(screen.getByText('This is the body sentence.')).toBeInTheDocument()
  })

  it('questions render as suede cards, max 3 with "+ N more questions" overflow', async () => {
    const onQuestionSelect = vi.fn()
    const user = userEvent.setup()
    const transcript: any[] = [
      {
        id: 'a1',
        kind: 'assistant',
        summary: 'Test summary.',
        change_notes: [],
        questions: ['Q1', 'Q2', 'Q3', 'Q4'],
        confidence: 0.8,
        revisionIndex: 0,
      },
    ]

    render(
      <AiChatTranscript
        transcript={transcript}
        revisions={[]}
        isPending={false}
        onQuestionSelect={onQuestionSelect}
        composerRef={{ current: null }}
      />,
    )

    const cards = screen.getAllByTestId('ai-chat-question-chip')
    expect(cards).toHaveLength(3)
    expect(screen.getByText('+ 1 more questions')).toBeInTheDocument()

    // Click card prefills with question context
    await user.click(cards[0])
    expect(onQuestionSelect).toHaveBeenCalledWith('> Q1 — ', 'Q1')
  })

  it('details section is expanded on turn 1 (revisionIndex = 0) and collapsed on turn >= 2', () => {
    const transcript: any[] = [
      {
        id: 'a1',
        kind: 'assistant',
        summary: 'Test summary.',
        change_notes: ['Change 1'],
        questions: [],
        confidence: 0.8,
        revisionIndex: 0,
      },
      {
        id: 'a2',
        kind: 'assistant',
        summary: 'Test summary 2.',
        change_notes: ['Change 2'],
        questions: [],
        confidence: 0.8,
        revisionIndex: 1,
      },
    ]

    const { rerender } = render(
      <AiChatTranscript
        transcript={[transcript[0]]}
        revisions={[]}
        isPending={false}
        onQuestionSelect={vi.fn()}
        composerRef={{ current: null }}
      />,
    )

    // First turn (revisionIndex 0) -> expanded
    expect(screen.getByTestId('ai-chat-details-content')).toBeInTheDocument()

    // Second turn (revisionIndex 1) -> collapsed by default
    rerender(
      <AiChatTranscript
        transcript={[transcript[1]]}
        revisions={[]}
        isPending={false}
        onQuestionSelect={vi.fn()}
        composerRef={{ current: null }}
      />,
    )
    expect(screen.queryByTestId('ai-chat-details-content')).toBeNull()
  })

  it('pending turn shows shimmer animated or static dots under reduced motion', () => {
    const userTurn: any[] = [{ id: 'u1', kind: 'user', content: 'Hello' }]
    // Normal motion: animated shimmer
    vi.mocked(useAppStore).mockImplementation((selector) =>
      selector({
        motionMode: 'full',
      } as any),
    )
    render(
      <AiChatTranscript
        transcript={userTurn}
        revisions={[]}
        isPending={true}
        onQuestionSelect={vi.fn()}
        composerRef={{ current: null }}
      />,
    )
    expect(screen.getByTestId('shimmer-animated')).toBeInTheDocument()

    // Reduced motion: static dots
    vi.mocked(useAppStore).mockImplementation((selector) =>
      selector({
        motionMode: 'system',
      } as any),
    )
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    render(
      <AiChatTranscript
        transcript={userTurn}
        revisions={[]}
        isPending={true}
        onQuestionSelect={vi.fn()}
        composerRef={{ current: null }}
      />,
    )
    expect(screen.getByTestId('shimmer-static')).toBeInTheDocument()
  })

  it('user turn renders answering question reference line and leaves wire payload untouched', () => {
    const transcript: any[] = [
      {
        id: 'u1',
        kind: 'user',
        content: 'I want a tighter stop',
        answeringQuestion: 'Do you want a tight stop?',
      },
    ]

    render(
      <AiChatTranscript
        transcript={transcript}
        revisions={[]}
        isPending={false}
        onQuestionSelect={vi.fn()}
        composerRef={{ current: null }}
      />,
    )

    expect(screen.getByText('answering: "Do you want a tight stop?"')).toBeInTheDocument()
  })
})
