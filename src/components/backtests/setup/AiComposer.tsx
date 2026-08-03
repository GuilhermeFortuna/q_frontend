import { type RefObject, useState } from 'react'
import { ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { Panel } from '@/components/ui/Panel'
import type { AiStrategySession } from '@/lib/strategies/useAiStrategySession'

type AiComposerProps = {
  session: AiStrategySession
  composerRef: RefObject<HTMLTextAreaElement | null>
  variant?: 'compact' | 'pill'
  docked?: boolean
  onFocusChange?: (focused: boolean) => void
}

export function AiComposer({
  session,
  composerRef,
  variant = 'compact',
  docked = false,
  onFocusChange,
}: AiComposerProps) {
  const {
    message,
    setMessage,
    selectedModel,
    setSelectedModel,
    availableModels,
    modelProviders,
    interpretMutation,
    modelsLoading,
    submitInterpret,
  } = session

  const [focused, setFocused] = useState(false)

  const handleFocusChange = (next: boolean) => {
    setFocused(next)
    onFocusChange?.(next)
  }

  const selectedModelInfo = availableModels.find(
    (m) => m.provider === selectedModel?.provider && m.id === selectedModel?.model,
  )
  const selectedModelLabel = selectedModelInfo ? selectedModelInfo.label : 'Select Model'

  const lines = message.split('\n').length
  const rows = Math.min(6, Math.max(1, lines))

  if (variant === 'compact') {
    return (
      <>
        <label htmlFor="ai-strategy-message" className="sr-only">
          Strategy prompt
        </label>
        <textarea
          ref={composerRef}
          id="ai-strategy-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          placeholder="A full spec or a rough idea — e.g. 'buy pullbacks in an uptrend'"
          className="bg-carbon-950/40 border-carbon-700/50 text-silver-100 focus:border-brass-500/80 min-h-[4.5rem] w-full resize-y rounded-lg border p-2 text-sm transition-all outline-none focus:shadow-[0_0_8px_rgba(217,158,34,0.3)]"
          disabled={interpretMutation.isPending}
          data-testid="ai-strategy-message"
          onFocus={() => handleFocusChange(true)}
          onBlur={() => handleFocusChange(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              void submitInterpret(message)
            }
          }}
        />
      </>
    )
  }

  // Pill variant (for Workspace hero + docked states)
  const borderRadiusClass = rows === 1 ? 'rounded-full' : 'rounded-[24px]'
  const canSend = !interpretMutation.isPending && message.trim().length > 0

  return (
    <Panel
      className={cn(
        'relative z-20 p-2 transition-all duration-300',
        borderRadiusClass,
        focused
          ? 'border-brass-500/80 shadow-[0_0_8px_rgba(217,158,34,0.3)]'
          : 'shadow-md',
        docked ? 'w-full' : 'w-full max-w-2xl',
      )}
    >
      <div className="flex items-end gap-2">
      {/* Model chip inside pill's left edge */}
      <div className="relative mb-1 ml-1 shrink-0 self-center">
        <div className="surface-suede text-silver-300 border-carbon-700/30 hover:border-carbon-600/50 hover:text-silver-100 flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all select-none active:scale-95">
          <span className="max-w-[10rem] truncate">{selectedModelLabel}</span>
          <ChevronDown className="text-silver-500 h-3 w-3 shrink-0" aria-hidden />
        </div>
        <select
          id="ai-strategy-model"
          value={selectedModel ? `${selectedModel.provider}::${selectedModel.model}` : ''}
          onChange={(event) => {
            const separator = event.target.value.indexOf('::')
            setSelectedModel(
              separator === -1
                ? null
                : {
                    provider: event.target.value.slice(0, separator),
                    model: event.target.value.slice(separator + 2),
                  },
            )
          }}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          disabled={interpretMutation.isPending || modelsLoading || availableModels.length === 0}
          data-testid="ai-strategy-model"
        >
          {availableModels.length === 0 ? (
            <option value="">No models</option>
          ) : (
            modelProviders.map((modelProvider) => {
              const providerModels = availableModels.filter(
                (model) => model.provider === modelProvider.id,
              )
              if (providerModels.length === 0) return null
              return (
                <optgroup key={modelProvider.id} label={modelProvider.label}>
                  {providerModels.map((model) => (
                    <option
                      key={`${model.provider}::${model.id}`}
                      value={`${model.provider}::${model.id}`}
                    >
                      {model.label}
                    </option>
                  ))}
                </optgroup>
              )
            })
          )}
        </select>
      </div>

      {/* Input Textarea */}
      <div className="min-w-0 flex-1">
        <label htmlFor="ai-strategy-message" className="sr-only">
          Strategy prompt
        </label>
        <textarea
          ref={composerRef}
          id="ai-strategy-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={rows}
          placeholder="A full spec or a rough idea — e.g. 'buy pullbacks in an uptrend'"
          className="text-silver-100 placeholder-silver-500 w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none focus:ring-0 focus:outline-none"
          disabled={interpretMutation.isPending}
          data-testid="ai-strategy-message"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (message.trim().length > 0) {
                void submitInterpret(message)
              }
            }
          }}
          onFocus={() => handleFocusChange(true)}
          onBlur={() => handleFocusChange(false)}
        />
      </div>

      {/* Send: suede at rest, machined brass once there is something to send */}
      <div className="mr-0.5 mb-0.5 shrink-0 self-center">
        <Button
          type="button"
          variant="ghost"
          onClick={() => void submitInterpret(message)}
          disabled={interpretMutation.isPending || message.trim().length === 0}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full p-0 transition-all active:scale-95',
            canSend
              ? 'button-machined-brass'
              : 'surface-suede text-silver-500 disabled:opacity-100',
          )}
          data-testid="ai-strategy-submit"
          title="Send"
          aria-label="Send"
        >
          {interpretMutation.isPending ? (
            <Loader2 className="text-silver-400 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className={cn('h-4 w-4', canSend ? 'text-carbon-950' : '')} aria-hidden />
          )}
        </Button>
      </div>
      </div>
    </Panel>
  )
}
