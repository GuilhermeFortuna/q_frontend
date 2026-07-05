import { Copy, Download, Loader2, Play, RotateCcw, Save, Sparkles, Wand2, Zap } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { Button, Callout } from '@/components/ui'
import { LabeledField } from '@/components/ui/LabeledField'

import { AiChatTranscript } from '@/components/backtests/setup/AiChatTranscript'
import { inputClass } from '@/components/shared/InstrumentConfigFields'
import {
  updateExitConditionValue,
  updateStrategySpecField,
  updateStrategySpecRisk,
} from '@/lib/strategies/applyCompiledStrategy'
import {
  findEditableExitPolicies,
  formatStrategySpecConditionGroup,
  formatStrategySpecExecution,
  formatStrategySpecIndicators,
  formatStrategySpecRisk,
} from '@/lib/strategies/strategySpecPreview'
import type { AiStrategySession } from '@/lib/strategies/useAiStrategySession'
import type { StrategySpec } from '@/types/strategyBuilder'
import { cn } from '@/lib/utils'

type AiStrategyPanelProps = {
  session: AiStrategySession
  hideHeader?: boolean
  draftHeader?: ReactNode
  fillHeight?: boolean
}

function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-carbon-900/25 border-carbon-800/50 rounded-lg border px-3 py-2">
      <h4 className="accent-wayfinding text-2xs mb-1.5 font-[560] tracking-[0.08em] uppercase">
        {title}
      </h4>
      <div className="text-silver-300 space-y-1 text-xs leading-relaxed">{children}</div>
    </section>
  )
}

function BulletList({ items, testId }: { items: string[]; testId?: string }) {
  if (items.length === 0) return null
  return (
    <ul className="space-y-1" data-testid={testId}>
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-brass-500/80 shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function AiStrategyPanel({
  session,
  hideHeader = false,
  draftHeader,
  fillHeight = false,
}: AiStrategyPanelProps) {
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const {
    message,
    setMessage,
    transcript,
    previewSpec,
    response,
    serviceError,
    saveError,
    validationErrors,
    unsupportedRequests,
    assumptions,
    unsupportedAcknowledged,
    setUnsupportedAcknowledged,
    workflowBlocker,
    canSave,
    revisions,
    interpretMutation,
    selectedModel,
    setSelectedModel,
    availableModels,
    modelProviders,
    provider,
    modelsLoading,
    modelsError,
    submitInterpret,
    handleApplyToSetup,
    handleSaveAiStrategy,
    handleDuplicate,
    handleExport,
    handleRunBacktest,
    handleOptimize,
    resetDraft,
    updateDraft,
    conversation,
  } = session

  const hasConversation = conversation.length > 0 || transcript.length > 0
  const activeProviderLabel =
    modelProviders.find((modelProvider) => modelProvider.id === selectedModel?.provider)?.label ??
    provider

  const handleAskAiToFix = () => {
    if (validationErrors.length === 0) return
    void submitInterpret('Please fix the validation errors in the current draft.', validationErrors)
  }

  return (
    <section
      className={cn(
        'border-carbon-700/50 bg-carbon-950/40 rounded-xl border p-3',
        fillHeight ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-3',
      )}
      data-testid="ai-strategy-panel"
    >
      {draftHeader}

      {!hideHeader ? (
        <div className="flex items-center gap-2">
          <Sparkles className="text-brass-400 h-4 w-4" aria-hidden />
          <h3 className="text-silver-200 text-sm font-semibold">AI Strategy Builder</h3>
          <span className="text-silver-500 text-[11px]">
            Describe, validate, apply, save, and iterate.
          </span>
        </div>
      ) : null}

      <div className={cn('flex flex-col gap-2', fillHeight && 'min-h-0 flex-1')}>
        <LabeledField
          label="Model"
          htmlFor="ai-strategy-model"
          labelEnd={
            activeProviderLabel ? (
              <span className="text-silver-500 font-normal normal-case">
                · {activeProviderLabel}
              </span>
            ) : null
          }
        >
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
            className={inputClass}
            disabled={interpretMutation.isPending || modelsLoading || availableModels.length === 0}
            data-testid="ai-strategy-model"
          >
            {availableModels.length === 0 ? (
              <option value="">No models configured</option>
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
                        {model.provider === 'openai_compatible' && !model.available
                          ? ' (not loaded)'
                          : ''}
                      </option>
                    ))}
                  </optgroup>
                )
              })
            )}
          </select>
          {modelsError ? (
            <p className="text-[11px] text-rose-400" data-testid="ai-strategy-models-error">
              {modelsError}
            </p>
          ) : availableModels.length === 0 && !modelsLoading ? (
            <p className="text-silver-500 text-[11px]" data-testid="ai-strategy-models-hint">
              {provider === 'gemini'
                ? 'Check your Gemini API key.'
                : 'Start the Ollama server (and pull a model) to enable models.'}
            </p>
          ) : null}
        </LabeledField>

        <AiChatTranscript
          transcript={transcript}
          revisions={revisions}
          isPending={interpretMutation.isPending}
          onQuestionSelect={setMessage}
          composerRef={composerRef}
          fillHeight={fillHeight}
        />

        <label htmlFor="ai-strategy-message" className="sr-only">
          Strategy prompt
        </label>
        <textarea
          ref={composerRef}
          id="ai-strategy-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          placeholder="e.g. Create a trend strategy using EMA 20 and EMA 50 with a 3% stop."
          className={`${inputClass} min-h-[4.5rem] resize-y`}
          disabled={interpretMutation.isPending}
          data-testid="ai-strategy-message"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              void submitInterpret(message)
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="brass"
            size="sm"
            onClick={() => void submitInterpret(message)}
            disabled={interpretMutation.isPending || message.trim().length === 0}
            className="tracking-wider uppercase"
            data-testid="ai-strategy-submit"
          >
            {interpretMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            )}
            {interpretMutation.isPending ? 'Interpreting…' : hasConversation ? 'Send' : 'Interpret'}
          </Button>

          {validationErrors.length > 0 ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleAskAiToFix}
              disabled={interpretMutation.isPending}
              className="tracking-wider uppercase"
              data-testid="ai-strategy-ask-fix"
            >
              <Wand2 className="h-3.5 w-3.5" aria-hidden />
              Ask AI to fix
            </Button>
          ) : null}

          {response?.compiled_strategy ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleApplyToSetup}
              className="tracking-wider uppercase"
              data-testid="ai-strategy-apply"
            >
              Apply to setup
            </Button>
          ) : null}

          {hasConversation || response ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetDraft}
              className="tracking-wider uppercase"
              data-testid="ai-strategy-reset"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              New conversation
            </Button>
          ) : null}
        </div>
      </div>

      {response ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="ai-strategy-actions">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSaveAiStrategy}
            disabled={!canSave}
            className="tracking-wider uppercase"
            data-testid="ai-strategy-save"
          >
            <Save className="h-3.5 w-3.5" aria-hidden />
            Save AI strategy
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRunBacktest}
            disabled={Boolean(workflowBlocker)}
            className="tracking-wider uppercase"
            data-testid="ai-strategy-run"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            Run backtest
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOptimize}
            disabled={Boolean(workflowBlocker)}
            className="tracking-wider uppercase"
            data-testid="ai-strategy-optimize"
          >
            <Zap className="h-3.5 w-3.5" aria-hidden />
            Optimize
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDuplicate}
            disabled={!previewSpec}
            className="tracking-wider uppercase"
            data-testid="ai-strategy-duplicate"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Duplicate
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleExport}
            disabled={!previewSpec}
            className="tracking-wider uppercase"
            data-testid="ai-strategy-export"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export spec
          </Button>
        </div>
      ) : null}

      {unsupportedRequests.length > 0 && response?.strategy_spec ? (
        <label
          className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
          data-testid="ai-strategy-unsupported-ack"
        >
          <input
            type="checkbox"
            checked={unsupportedAcknowledged}
            onChange={(event) => setUnsupportedAcknowledged(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            I understand these unsupported parts were excluded from the draft:{' '}
            {unsupportedRequests.join(', ')}
          </span>
        </label>
      ) : null}

      {serviceError ? (
        <Callout type="error" title="AI Service Error" data-testid="ai-strategy-service-error">
          {serviceError}
        </Callout>
      ) : null}

      {saveError ? (
        <Callout type="error" title="Save Failed" data-testid="ai-strategy-save-error">
          {saveError}
        </Callout>
      ) : null}

      {workflowBlocker ? (
        <Callout type="warning" title="Workflow Blocked" data-testid="ai-strategy-workflow-blocker">
          {workflowBlocker}
        </Callout>
      ) : null}

      {response ? (
        <div className="space-y-3" data-testid="ai-strategy-results">
          {assumptions.length > 0 ? (
            <PreviewSection title="Assumptions">
              <BulletList items={assumptions} testId="ai-strategy-assumptions" />
            </PreviewSection>
          ) : null}

          {unsupportedRequests.length > 0 ? (
            <PreviewSection title="Unsupported requests">
              <BulletList items={unsupportedRequests} testId="ai-strategy-unsupported" />
            </PreviewSection>
          ) : null}

          {validationErrors.length > 0 ? (
            <PreviewSection title="Validation errors">
              <ul className="space-y-2" data-testid="ai-strategy-validation-errors">
                {validationErrors.map((error) => (
                  <li
                    key={`${error.path}-${error.code}-${error.message}`}
                    className="rounded border border-rose-500/20 bg-rose-500/5 px-2 py-1.5"
                  >
                    <div className="font-medium text-rose-200">
                      {error.path || '(root)'} · {error.code}
                    </div>
                    <div className="text-rose-100/90">{error.message}</div>
                  </li>
                ))}
              </ul>
            </PreviewSection>
          ) : null}

          {previewSpec ? <StrategySpecPreview spec={previewSpec} onChange={updateDraft} /> : null}
        </div>
      ) : null}
    </section>
  )
}

function StrategySpecPreview({
  spec,
  onChange,
}: {
  spec: StrategySpec
  onChange: (next: StrategySpec) => void
}) {
  const editableExitPolicies = findEditableExitPolicies(spec)

  return (
    <div className="grid gap-2 md:grid-cols-2" data-testid="ai-strategy-preview">
      <PreviewSection title="Name">
        <input
          type="text"
          value={spec.name}
          onChange={(event) => onChange(updateStrategySpecField(spec, 'name', event.target.value))}
          className={inputClass}
          data-testid="ai-preview-name"
        />
      </PreviewSection>

      <PreviewSection title="Universe">
        <input
          type="text"
          value={spec.universe.join(', ')}
          onChange={(event) =>
            onChange(
              updateStrategySpecField(
                spec,
                'universe',
                event.target.value
                  .split(',')
                  .map((symbol) => symbol.trim())
                  .filter(Boolean),
              ),
            )
          }
          className={inputClass}
          data-testid="ai-preview-universe"
        />
      </PreviewSection>

      <PreviewSection title="Timeframe">
        <input
          type="text"
          value={spec.timeframe}
          onChange={(event) =>
            onChange(updateStrategySpecField(spec, 'timeframe', event.target.value))
          }
          className={inputClass}
          data-testid="ai-preview-timeframe"
        />
      </PreviewSection>

      <PreviewSection title="Market">
        <p>{spec.market}</p>
      </PreviewSection>

      <PreviewSection title="Indicators">
        <BulletList items={formatStrategySpecIndicators(spec)} />
      </PreviewSection>

      <PreviewSection title="Entry">
        <BulletList items={formatStrategySpecConditionGroup(spec.entry)} />
      </PreviewSection>

      <PreviewSection title="Exit">
        <BulletList items={formatStrategySpecConditionGroup(spec.exit)} />
      </PreviewSection>

      <PreviewSection title="Risk">
        {spec.risk.position_sizing === 'fixed_quantity' ? (
          <label className="flex flex-col gap-1">
            <span>Quantity</span>
            <input
              type="number"
              min={0}
              step={1}
              value={spec.risk.quantity ?? 1}
              onChange={(event) =>
                onChange(
                  updateStrategySpecRisk(spec, {
                    quantity: Number(event.target.value),
                  }),
                )
              }
              className={inputClass}
              data-testid="ai-preview-risk-quantity"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span>Safety margin / contract</span>
            <input
              type="number"
              min={0}
              step={100}
              value={spec.risk.safety_margin_per_contract ?? 0}
              onChange={(event) =>
                onChange(
                  updateStrategySpecRisk(spec, {
                    safety_margin_per_contract: Number(event.target.value),
                  }),
                )
              }
              className={inputClass}
              data-testid="ai-preview-risk-margin"
            />
          </label>
        )}
        <p className="text-silver-500 mt-2">{formatStrategySpecRisk(spec)}</p>
      </PreviewSection>

      <PreviewSection title="Execution assumptions">
        <BulletList items={formatStrategySpecExecution(spec)} />
      </PreviewSection>

      {editableExitPolicies.map((policy) => (
        <PreviewSection
          key={`${policy.group}-${policy.index}-${policy.type}`}
          title={`${policy.type === 'stop_loss' ? 'Stop loss' : 'Take profit'} (${policy.group})`}
        >
          <label className="flex flex-col gap-1">
            <span>Percent</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={Number((policy.value * 100).toFixed(2))}
              onChange={(event) =>
                onChange(
                  updateExitConditionValue(
                    spec,
                    policy.group,
                    policy.index,
                    Number(event.target.value) / 100,
                  ),
                )
              }
              className={inputClass}
              data-testid={`ai-preview-${policy.type}-${policy.group}`}
            />
          </label>
        </PreviewSection>
      ))}
    </div>
  )
}
