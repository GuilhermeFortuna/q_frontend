import { Loader2 } from 'lucide-react'
import { memo, useEffect, useRef, useState, type RefObject } from 'react'

import { chipClass } from '@/components/ui/chipStyles'
import { cn } from '@/lib/utils'
import {
  compareRevisionSections,
  type AiRevisionSnapshot,
  type AiRevisionSectionDiff,
} from '@/lib/strategies/aiStrategyMetadata'
import type {
  TranscriptAssistantEntry,
  TranscriptEntry,
  TranscriptNoticeEntry,
  TranscriptUserEntry,
} from '@/lib/strategies/useAiStrategySession'

type AiChatTranscriptProps = {
  transcript: TranscriptEntry[]
  revisions: AiRevisionSnapshot[]
  isPending: boolean
  onQuestionSelect: (question: string) => void
  composerRef: RefObject<HTMLTextAreaElement | null>
  fillHeight?: boolean
}

const EXAMPLE_PROMPTS = [
  'Create a trend-following strategy using a fast and slow moving-average crossover.',
  'Create a mean-reversion strategy that buys oversold RSI conditions and exits at the mean.',
  'Create a breakout strategy that enters above recent resistance with a protective stop.',
] as const

function formatQuestionPrefill(question: string): string {
  return `> ${question} — `
}

const UserTurn = memo(function UserTurn({ entry }: { entry: TranscriptUserEntry }) {
  return (
    <div className="flex justify-end" data-testid="ai-chat-user-turn">
      <div className="border-brass-600/25 bg-brass-600/10 text-silver-100 max-w-[92%] rounded-lg border px-3 py-2 text-sm leading-relaxed">
        {entry.content}
      </div>
    </div>
  )
})

const NoticeTurn = memo(function NoticeTurn({ entry }: { entry: TranscriptNoticeEntry }) {
  return (
    <div
      className="border-carbon-700/50 bg-carbon-900/40 text-silver-400 rounded-lg border px-3 py-2 text-xs italic"
      data-testid="ai-chat-notice-turn"
    >
      {entry.content}
    </div>
  )
})

const RevisionDiffDetail = memo(function RevisionDiffDetail({
  diff,
}: {
  diff: AiRevisionSectionDiff
}) {
  return (
    <div className="text-silver-400 mt-1 space-y-0.5 text-[11px]">
      <div>was: {diff.previous}</div>
      <div className="text-silver-200">now: {diff.current}</div>
    </div>
  )
})

const AssistantTurn = memo(function AssistantTurn({
  entry,
  revisions,
  onQuestionSelect,
  composerRef,
}: {
  entry: TranscriptAssistantEntry
  revisions: AiRevisionSnapshot[]
  onQuestionSelect: (question: string) => void
  composerRef: RefObject<HTMLTextAreaElement | null>
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const sectionDiff = compareRevisionSections(
    entry.revisionIndex > 0 ? (revisions[entry.revisionIndex - 1] ?? null) : null,
    revisions[entry.revisionIndex] ?? null,
  )
  const changedSections = sectionDiff.filter((diff) => diff.changed)

  return (
    <div className="space-y-2" data-testid="ai-chat-assistant-turn">
      <div className="border-carbon-700/50 bg-carbon-900/50 text-silver-100 max-w-[92%] rounded-lg border px-3 py-2 text-sm leading-relaxed">
        {entry.summary}
      </div>

      {entry.change_notes.length > 0 ? (
        <div className="space-y-1" data-testid="ai-chat-change-notes">
          <p className="text-silver-500 text-[11px] font-semibold tracking-wide uppercase">
            Changed this turn
          </p>
          <ul className="text-silver-300 space-y-0.5 text-xs">
            {entry.change_notes.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="text-brass-500/80 shrink-0">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {changedSections.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" data-testid="ai-chat-revision-chips">
          {changedSections.map((diff) => (
            <div key={diff.section} className="min-w-0">
              <button
                type="button"
                className={chipClass(expandedSection === diff.section)}
                onClick={() =>
                  setExpandedSection((current) => (current === diff.section ? null : diff.section))
                }
                data-testid={`ai-chat-revision-chip-${diff.section}`}
              >
                {diff.section}
              </button>
              {expandedSection === diff.section ? <RevisionDiffDetail diff={diff} /> : null}
            </div>
          ))}
        </div>
      ) : null}

      {entry.questions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" data-testid="ai-chat-question-chips">
          {entry.questions.map((question) => (
            <button
              key={question}
              type="button"
              className={chipClass(false)}
              onClick={() => {
                onQuestionSelect(formatQuestionPrefill(question))
                composerRef.current?.focus()
              }}
              data-testid="ai-chat-question-chip"
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
})

const PendingAssistantTurn = memo(function PendingAssistantTurn() {
  return (
    <div
      className="border-carbon-700/50 bg-carbon-900/50 text-silver-400 inline-flex max-w-[92%] items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      data-testid="ai-chat-pending-assistant"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      Thinking…
    </div>
  )
})

const TranscriptTurn = memo(function TranscriptTurn({
  entry,
  revisions,
  onQuestionSelect,
  composerRef,
}: {
  entry: TranscriptEntry
  revisions: AiRevisionSnapshot[]
  onQuestionSelect: (question: string) => void
  composerRef: RefObject<HTMLTextAreaElement | null>
}) {
  if (entry.kind === 'user') {
    return <UserTurn entry={entry} />
  }
  if (entry.kind === 'notice') {
    return <NoticeTurn entry={entry} />
  }
  return (
    <AssistantTurn
      entry={entry}
      revisions={revisions}
      onQuestionSelect={onQuestionSelect}
      composerRef={composerRef}
    />
  )
})

export function AiChatTranscript({
  transcript,
  revisions,
  isPending,
  onQuestionSelect,
  composerRef,
  fillHeight = false,
}: AiChatTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [transcript, isPending])

  const showPending =
    isPending && transcript.length > 0 && transcript[transcript.length - 1]?.kind === 'user'

  return (
    <div
      className={cn(
        'border-carbon-800/50 bg-carbon-950/30 min-h-[6rem] space-y-3 overflow-y-auto rounded-lg border p-3',
        fillHeight ? 'min-h-0 flex-1' : 'max-h-64',
      )}
      data-testid="ai-chat-transcript"
    >
      {transcript.length === 0 && !showPending ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-3 px-3 py-6 text-center">
          <p className="text-silver-400 max-w-xl text-sm leading-relaxed">
            Describe a strategy to start — validate, apply, save, and iterate from here.
          </p>
          <div className="flex max-w-3xl flex-wrap justify-center gap-2">
            {EXAMPLE_PROMPTS.map((prompt, index) => (
              <button
                key={prompt}
                type="button"
                className={chipClass(false)}
                onClick={() => {
                  onQuestionSelect(prompt)
                  composerRef.current?.focus()
                }}
                data-testid="ai-chat-example-chip"
              >
                {index === 0
                  ? 'Trend-following crossover'
                  : index === 1
                    ? 'Mean-reversion entry'
                    : 'Breakout with stop'}
              </button>
            ))}
          </div>
        </div>
      ) : (
        transcript.map((entry) => (
          <TranscriptTurn
            key={entry.id}
            entry={entry}
            revisions={revisions}
            onQuestionSelect={onQuestionSelect}
            composerRef={composerRef}
          />
        ))
      )}

      {showPending ? <PendingAssistantTurn /> : null}
      <div ref={bottomRef} />
    </div>
  )
}
