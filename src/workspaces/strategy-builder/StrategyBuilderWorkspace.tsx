import { useNavigate } from '@tanstack/react-router'
import { Sparkles, Save, Plus, Trash2 } from 'lucide-react'

import { useBacktestJob } from '@/api/queries/backtests'
import { AiStrategyPanel } from '@/components/backtests/setup/AiStrategyPanel'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { useAiStrategySession } from '@/lib/strategies/useAiStrategySession'
import { useAppStore } from '@/store/useAppStore'
import { Panel } from '@/components/ui/Panel'
import { Button, Callout } from '@/components/ui'
import { LabeledField } from '@/components/ui/LabeledField'
import { inputClass } from '@/components/shared/InstrumentConfigFields'
import type { BacktestRequest } from '@/types/backtesting'

export function StrategyBuilderWorkspace() {
  const config = useBacktestConfig()
  const runBacktest = useBacktestJob()
  const patchBacktestSession = useAppStore((s) => s.patchBacktestSession)
  const navigate = useNavigate()

  const handleRunBacktest = (request: BacktestRequest) => {
    patchBacktestSession({
      lastCapital: request.initial_capital ?? 100000,
      lastRequest: request,
      focus: 'results',
      rightPanelTab: 'results',
      workflowMode: 'backtest',
    })
    runBacktest.mutate(request)
    void navigate({ to: '/backtests', search: { mode: undefined } })
  }

  const handleOptimize = () => {
    void navigate({ to: '/backtests', search: { mode: 'optimize' } })
  }

  const session = useAiStrategySession({
    config,
    onRunBacktest: handleRunBacktest,
    onOptimize: handleOptimize,
  })

  return (
    <div
      className="animate-fade-in-up mx-auto flex h-[calc(100dvh-4.5rem-7rem)] min-h-[36rem] w-full max-w-6xl flex-col gap-4 overflow-hidden"
      data-workspace-transition-root="strategy-builder"
    >
      <div className="flex items-center gap-3">
        <div className="border-carbon-700/60 bg-carbon-900/50 text-silver-300 flex h-10 w-10 items-center justify-center rounded-lg border">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1
            className="font-display text-silver-100 tracking-display text-xl font-semibold"
            data-workspace-transition-anchor="strategy-builder"
          >
            AI Strategy Builder
          </h1>
          <p className="text-silver-400 mt-0.5 text-sm">
            Describe, validate, apply, save, and iterate on trading strategies using natural
            language AI.
          </p>
        </div>
      </div>

      <Panel
        living
        className="flex min-h-0 flex-1 flex-col p-4"
        data-workspace-transition-surface="primary"
      >
        <AiStrategyPanel
          session={session}
          hideHeader
          fillHeight
          draftHeader={
            <div
              className="space-y-3"
              data-testid="ai-strategy-draft-header"
              data-workspace-transition-surface="secondary"
            >
              <div className="flex flex-wrap items-end gap-3">
                <LabeledField
                  label="Name"
                  htmlFor="studio-strategy-name"
                  className="min-w-[14rem] flex-1"
                >
                  <input
                    id="studio-strategy-name"
                    type="text"
                    value={config.authoring.customName}
                    onChange={(event) => config.authoring.setCustomName(event.target.value)}
                    className={`${inputClass} font-display text-base font-[560]`}
                    placeholder="e.g. MyRSIReversion"
                    disabled={Boolean(config.authoring.loadedCustomName)}
                  />
                </LabeledField>

                <LabeledField
                  label="Description"
                  htmlFor="studio-strategy-desc"
                  className="min-w-[18rem] flex-[2]"
                >
                  <input
                    id="studio-strategy-desc"
                    type="text"
                    value={config.authoring.description}
                    onChange={(event) => config.authoring.setDescription(event.target.value)}
                    className={inputClass}
                    placeholder="Optional thesis summary..."
                  />
                </LabeledField>

                <div className="flex shrink-0 items-center gap-2 pb-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={config.authoring.newDraft}
                    className="tracking-wider uppercase"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    New
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={config.authoring.saveCustom}
                    disabled={
                      config.authoring.isSaving || config.authoring.customName.trim().length === 0
                    }
                    className="tracking-wider uppercase"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden />
                    {config.authoring.isSaving ? 'Saving…' : 'Save'}
                  </Button>
                  {config.authoring.loadedCustomName ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        config.authoring.deleteCustom(config.authoring.loadedCustomName!)
                      }
                      className="text-rose-300"
                      title="Delete loaded custom strategy"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">Delete loaded custom strategy</span>
                    </Button>
                  ) : null}
                </div>
              </div>

              {config.authoring.authoringError ? (
                <Callout type="error" title="Strategy Code Error">
                  {config.authoring.authoringError}
                </Callout>
              ) : null}
            </div>
          }
        />
      </Panel>
    </div>
  )
}
