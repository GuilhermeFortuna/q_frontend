import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AiChatTranscript } from '@/components/backtests/setup/AiChatTranscript'
import type { AiRevisionSnapshot } from '@/lib/strategies/aiStrategyMetadata'
import type { TranscriptEntry } from '@/lib/strategies/useAiStrategySession'

const BASE_REVISION: AiRevisionSnapshot = {
  prompt: 'first',
  summary: 'Draft ready.',
  strategy_spec: {
    schema_version: 'strategy_spec.v1',
    name: 'EMA Trend Cross',
    universe: ['PETR4'],
    market: 'B3',
    timeframe: 'D1',
    indicators: [],
    entry: { all: [] },
    exit: { any: [] },
    risk: { position_sizing: 'fixed_quantity', quantity: 1 },
    execution_assumptions: {
      signal_timing: 'closed_bar',
      entry_timing: 'next_bar_open',
      allow_short: false,
    },
  },
  validation: { valid: true, errors: [] },
  captured_at: '2026-01-01T00:00:00.000Z',
}

describe('AiChatTranscript', () => {
  it('renders empty-state teaser copy', () => {
    render(
      <AiChatTranscript
        transcript={[]}
        revisions={[]}
        isPending={false}
        onQuestionSelect={vi.fn()}
        composerRef={createRef()}
      />,
    )

    expect(screen.getByTestId('ai-chat-transcript')).toHaveTextContent(
      /describe a strategy to start/i,
    )
  })

  it('renders change_notes on assistant turns', () => {
    const transcript: TranscriptEntry[] = [
      { id: 'u1', kind: 'user', content: 'Tighten the stop.' },
      {
        id: 'a1',
        kind: 'assistant',
        summary: 'Updated the stop.',
        change_notes: ['tightened stop_loss_points 200 -> 150'],
        questions: [],
        confidence: 0.9,
        revisionIndex: 0,
      },
    ]

    render(
      <AiChatTranscript
        transcript={transcript}
        revisions={[BASE_REVISION]}
        isPending={false}
        onQuestionSelect={vi.fn()}
        composerRef={createRef()}
      />,
    )

    expect(screen.getByTestId('ai-chat-change-notes')).toHaveTextContent(
      'tightened stop_loss_points 200 -> 150',
    )
  })

  it('omits change_notes block when absent', () => {
    const transcript: TranscriptEntry[] = [
      {
        id: 'a1',
        kind: 'assistant',
        summary: 'First draft ready.',
        change_notes: [],
        questions: [],
        confidence: 0.8,
        revisionIndex: 0,
      },
    ]

    render(
      <AiChatTranscript
        transcript={transcript}
        revisions={[BASE_REVISION]}
        isPending={false}
        onQuestionSelect={vi.fn()}
        composerRef={createRef()}
      />,
    )

    expect(screen.queryByTestId('ai-chat-change-notes')).not.toBeInTheDocument()
  })

  it('prefills the composer when a question chip is clicked', async () => {
    const user = userEvent.setup()
    const onQuestionSelect = vi.fn()
    const composerRef = createRef<HTMLTextAreaElement>()
    const transcript: TranscriptEntry[] = [
      {
        id: 'a1',
        kind: 'assistant',
        summary: 'Need one detail.',
        change_notes: [],
        questions: ['Which timeframe?'],
        confidence: 0.5,
        revisionIndex: 0,
      },
    ]

    render(
      <>
        <textarea ref={composerRef} data-testid="composer" />
        <AiChatTranscript
          transcript={transcript}
          revisions={[BASE_REVISION]}
          isPending={false}
          onQuestionSelect={onQuestionSelect}
          composerRef={composerRef}
        />
      </>,
    )

    await user.click(screen.getByTestId('ai-chat-question-chip'))

    expect(onQuestionSelect).toHaveBeenCalledWith('> Which timeframe? — ')
    expect(document.activeElement).toBe(composerRef.current)
  })

  it('shows a pending assistant placeholder after the latest user turn', () => {
    const transcript: TranscriptEntry[] = [{ id: 'u1', kind: 'user', content: 'Second turn' }]

    render(
      <AiChatTranscript
        transcript={transcript}
        revisions={[]}
        isPending
        onQuestionSelect={vi.fn()}
        composerRef={createRef()}
      />,
    )

    expect(screen.getByTestId('ai-chat-pending-assistant')).toBeInTheDocument()
  })
})
