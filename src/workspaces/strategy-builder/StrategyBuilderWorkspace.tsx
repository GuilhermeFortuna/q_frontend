import { useNavigate } from '@tanstack/react-router'
import { Sparkles, Save, Plus, Trash2 } from 'lucide-react'

import { useBacktestJob } from '@/api/queries/backtests'
import { AiStrategyPanel } from '@/components/backtests/setup/AiStrategyPanel'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { useAiStrategySession } from '@/lib/strategies/useAiStrategySession'
import { useAppStore } from '@/store/useAppStore'
import { Panel } from '@/components/ui/Panel'
import { Callout } from '@/components/ui'
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
    <div className="animate-fade-in-up mx-auto flex max-w-5xl flex-col gap-6 pb-28">
      <div className="flex items-center gap-3">
        <div className="border-carbon-700/60 bg-carbon-900/50 text-silver-300 flex h-10 w-10 items-center justify-center rounded-lg border">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-silver-100 tracking-display text-xl font-semibold">
            AI Strategy Builder
          </h1>
          <p className="text-silver-400 mt-0.5 text-sm">
            Describe, validate, apply, save, and iterate on trading strategies using natural
            language AI.
          </p>
        </div>
      </div>

      {/* Custom Strategy Authoring Header */}
      <Panel living className="space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label
              htmlFor="studio-strategy-name"
              className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase"
            >
              Name
            </label>
            <input
              id="studio-strategy-name"
              type="text"
              value={config.authoring.customName}
              onChange={(event) => config.authoring.setCustomName(event.target.value)}
              className={inputClass}
              placeholder="e.g. MyRSIReversion"
              disabled={Boolean(config.authoring.loadedCustomName)}
            />
          </div>

          <div className="min-w-[16rem] flex-[2] space-y-1">
            <label
              htmlFor="studio-strategy-desc"
              className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase"
            >
              Description
            </label>
            <input
              id="studio-strategy-desc"
              type="text"
              value={config.authoring.description}
              onChange={(event) => config.authoring.setDescription(event.target.value)}
              className={inputClass}
              placeholder="Optional thesis summary..."
            />
          </div>

          <div className="flex shrink-0 items-center gap-2 pb-0.5">
            <button
              type="button"
              onClick={config.authoring.newDraft}
              className="border-brass-600/30 bg-brass-600/10 text-brass-400 hover:bg-brass-600/20 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold tracking-wider uppercase transition-colors"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New
            </button>
            <button
              type="button"
              onClick={config.authoring.saveCustom}
              disabled={
                config.authoring.isSaving || config.authoring.customName.trim().length === 0
              }
              className="border-brass-600/30 bg-brass-600/10 text-brass-400 hover:bg-brass-600/20 disabled:text-silver-500 disabled:border-carbon-700/40 disabled:bg-carbon-900/40 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold tracking-wider uppercase transition-colors"
            >
              <Save className="h-3.5 w-3.5" aria-hidden />
              {config.authoring.isSaving ? 'Saving…' : 'Save'}
            </button>
            {config.authoring.loadedCustomName ? (
              <button
                type="button"
                onClick={() => config.authoring.deleteCustom(config.authoring.loadedCustomName!)}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold tracking-wider text-rose-300 uppercase transition-colors hover:bg-rose-500/20"
                title="Delete loaded custom strategy"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Delete loaded custom strategy</span>
              </button>
            ) : null}
          </div>
        </div>

        {config.authoring.authoringError ? (
          <Callout type="error" title="Strategy Code Error" className="mb-2">
            {config.authoring.authoringError}
          </Callout>
        ) : null}
      </Panel>

      <Panel living className="p-4">
        <AiStrategyPanel session={session} />
      </Panel>
    </div>
  )
}
