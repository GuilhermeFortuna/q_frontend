import { Sparkles } from 'lucide-react'

type AiStrategyTeaserProps = {
  onOpen: () => void
  hasActiveDraft?: boolean
}

export function AiStrategyTeaser({ onOpen, hasActiveDraft = false }: AiStrategyTeaserProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="border-carbon-700/50 bg-carbon-950/40 hover:border-brass-500/30 hover:bg-carbon-900/50 flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
      data-testid="ai-strategy-teaser"
    >
      <div className="flex items-center gap-2.5">
        <Sparkles className="text-brass-400 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p className="text-silver-200 text-sm font-semibold">AI Strategy Builder</p>
          <p className="text-silver-500 text-[11px]">
            {hasActiveDraft
              ? 'Draft in progress — open to continue'
              : 'Describe, validate, apply, save, and iterate'}
          </p>
        </div>
      </div>
      <span className="text-brass-400 text-[11px] font-semibold tracking-wider uppercase">
        Open
      </span>
    </button>
  )
}
