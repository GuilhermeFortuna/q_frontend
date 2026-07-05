import { Loader2 } from 'lucide-react'
import { memo, useEffect, useRef, useState, type RefObject } from 'react'

import { chipClass } from '@/components/ui/chipStyles'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/motion/useReducedMotion'
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
  onQuestionSelect: (prefill: string, originalQuestion?: string) => void
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
    <div className="flex w-full flex-col items-end gap-1" data-testid="ai-chat-user-turn">
      {entry.answeringQuestion && (
        <div className="text-silver-500 text-2xs border-carbon-700/60 mr-1 max-w-[85%] truncate border-r pr-2 italic select-none">
          answering: "{entry.answeringQuestion}"
        </div>
      )}
      <div className="flex w-full justify-end">
        <div className="border-brass-600/25 bg-brass-600/10 text-silver-100 max-w-[92%] rounded-lg border px-3 py-2 text-sm leading-relaxed">
          {entry.content}
        </div>
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
  onQuestionSelect: (prefill: string, originalQuestion?: string) => void
  composerRef: RefObject<HTMLTextAreaElement | null>
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(entry.revisionIndex === 0)
  const [showAllQuestions, setShowAllQuestions] = useState(false)

  const sectionDiff = compareRevisionSections(
    entry.revisionIndex > 0 ? (revisions[entry.revisionIndex - 1] ?? null) : null,
    revisions[entry.revisionIndex] ?? null,
  )
  const changedSections = sectionDiff.filter((diff) => diff.changed)

  // Split summary into Headline (first sentence) and remaining body sentences
  const sentenceBoundaryMatch = entry.summary.match(/[.!?](\s|$)/)
  let headline = entry.summary
  let body = ''
  if (sentenceBoundaryMatch && sentenceBoundaryMatch.index !== undefined) {
    const splitIndex = sentenceBoundaryMatch.index + 1
    headline = entry.summary.slice(0, splitIndex)
    body = entry.summary.slice(splitIndex).trim()
  }

  const displayedQuestions = showAllQuestions ? entry.questions : entry.questions.slice(0, 3)
  const remainingQuestionsCount = entry.questions.length - 3

  return (
    <div className="w-full space-y-3" data-testid="ai-chat-assistant-turn">
      {/* Editorial Summary Box */}
      <div className="border-carbon-700/50 bg-carbon-900/50 text-silver-100 max-w-[92%] rounded-lg border px-3.5 py-3 text-sm leading-relaxed">
        <h3 className="text-silver-100 text-base leading-snug font-[550]">{headline}</h3>
        {body && <p className="text-silver-400 mt-2 text-sm leading-relaxed font-normal">{body}</p>}
      </div>

      {/* Promoted Suede Question Cards (Forward Edge of Conversation) */}
      {entry.questions.length > 0 && (
        <div className="flex max-w-[92%] flex-col gap-2" data-testid="ai-chat-question-chips">
          {displayedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              className="surface-suede border-carbon-700/50 hover:border-brass-500/50 border-l-brass-500 text-silver-200 hover:text-silver-100 w-full cursor-pointer rounded-r-lg border border-l-2 p-3 text-left text-sm leading-relaxed transition-all active:scale-[0.995]"
              onClick={() => {
                onQuestionSelect(formatQuestionPrefill(question), question)
                composerRef.current?.focus()
              }}
              data-testid="ai-chat-question-chip"
            >
              {question}
            </button>
          ))}

          {entry.questions.length > 3 && !showAllQuestions && (
            <button
              type="button"
              onClick={() => setShowAllQuestions(true)}
              className="text-brass-400 hover:text-brass-300 mt-1 self-start text-xs font-semibold tracking-wider uppercase transition-colors"
            >
              + {remainingQuestionsCount} more questions
            </button>
          )}
        </div>
      )}

      {/* Collapsible Details section containing Change Notes and Revision Chips */}
      {(entry.change_notes.length > 0 || changedSections.length > 0) && (
        <div className="max-w-[92%]">
          <button
            type="button"
            onClick={() => setIsDetailsExpanded((prev) => !prev)}
            className="text-silver-400 hover:text-silver-200 text-2xs mt-1 flex cursor-pointer items-center gap-1 font-bold tracking-widest uppercase transition-colors select-none"
            data-testid="ai-chat-details-toggle"
          >
            {isDetailsExpanded ? 'Hide Details' : 'Show Details'}
          </button>

          {isDetailsExpanded && (
            <div
              className="border-carbon-800/40 mt-2.5 space-y-3.5 border-t pt-2.5"
              data-testid="ai-chat-details-content"
            >
              {entry.change_notes.length > 0 && (
                <div className="space-y-1.5" data-testid="ai-chat-change-notes">
                  <p className="text-silver-500 text-[10px] font-bold tracking-wider uppercase">
                    Changed this turn
                  </p>
                  <ul className="text-silver-300 space-y-1 text-xs">
                    {entry.change_notes.map((note) => (
                      <li key={note} className="flex gap-2">
                        <span className="text-brass-500/80 shrink-0 select-none">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {changedSections.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-silver-500 mb-1 text-[10px] font-bold tracking-wider uppercase">
                    Modified Sections
                  </p>
                  <div className="flex flex-wrap gap-1.5" data-testid="ai-chat-revision-chips">
                    {changedSections.map((diff) => (
                      <div key={diff.section} className="min-w-0">
                        <button
                          type="button"
                          className={chipClass(expandedSection === diff.section)}
                          onClick={() =>
                            setExpandedSection((current) =>
                              current === diff.section ? null : diff.section,
                            )
                          }
                          data-testid={`ai-chat-revision-chip-${diff.section}`}
                        >
                          {diff.section}
                        </button>
                        {expandedSection === diff.section ? (
                          <RevisionDiffDetail diff={diff} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

const PendingAssistantTurn = memo(function PendingAssistantTurn() {
  const isReduced = useReducedMotion()
  return (
    <div
      className="border-carbon-700/50 bg-carbon-900/50 text-silver-400 flex max-w-[92%] flex-col gap-2 rounded-lg border px-3.5 py-3 text-sm"
      data-testid="ai-chat-pending-assistant"
    >
      <div className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Thinking…
      </div>
      {isReduced ? (
        <div className="mt-1 space-y-2" data-testid="shimmer-static">
          <div className="bg-carbon-700/60 h-3.5 w-48 rounded" />
          <div className="bg-carbon-700/40 h-3 w-72 max-w-full rounded" />
        </div>
      ) : (
        <div className="mt-1 space-y-2" data-testid="shimmer-animated">
          <div className="from-carbon-700/60 via-brass-400/20 to-carbon-700/60 h-3.5 w-48 animate-[quant-skeleton-sweep_1.8s_linear_infinite] rounded bg-gradient-to-r bg-[length:200%_100%]" />
          <div className="from-carbon-700/45 via-brass-400/12 to-carbon-700/45 h-3 w-72 max-w-full animate-[quant-skeleton-sweep_1.8s_linear_infinite_0.15s] rounded bg-gradient-to-r bg-[length:200%_100%]" />
        </div>
      )}
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
  onQuestionSelect: (prefill: string, originalQuestion?: string) => void
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
