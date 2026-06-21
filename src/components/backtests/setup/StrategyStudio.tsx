import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { StrategyLibrary } from '@/components/backtests/setup/StrategyLibrary'
import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import { inputClass } from '@/components/shared/InstrumentConfigFields'
import type { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { cn } from '@/lib/utils'
import { ExitConfigurator } from '@/workspaces/strategy/ExitConfigurator'
import { getEnabledExitRules } from '@/workspaces/strategy/exitRuleSemantics'

type BacktestConfig = ReturnType<typeof useBacktestConfig>

type StrategyStudioProps = {
  config: BacktestConfig
}

type StudioTab = 'entry' | 'exit'

const THESIS_COLLAPSE_THRESHOLD = 160

export function StrategyStudio({ config }: StrategyStudioProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>('entry')
  const [thesisOpen, setThesisOpen] = useState(true)

  const {
    fields,
    setters,
    builtInStrategies,
    selectedStrategy,
    strategiesLoading,
    entryParamSpecs,
    exitParamSpecs,
    exitCatalog,
    exitCatalogLoading,
    customStrategies,
    customLoading,
    authoring,
  } = config

  const enabledExitCount = useMemo(() => {
    if (!exitCatalog) return 0
    return getEnabledExitRules(exitCatalog.exit_rules, fields.strategyParams).length
  }, [exitCatalog, fields.strategyParams])

  useEffect(() => {
    const thesis = selectedStrategy?.thesis ?? ''
    setThesisOpen(thesis.length <= THESIS_COLLAPSE_THRESHOLD)
  }, [selectedStrategy?.thesis, fields.strategy])

  const handleSelectBuiltIn = (name: string) => {
    setters.handleStrategyChange(name)
    authoring.newDraft()
    setActiveTab('exit')
  }

  const handleSelectCustom = (custom: Parameters<BacktestConfig['authoring']['loadCustom']>[0]) => {
    authoring.loadCustom(custom)
    setActiveTab('exit')
  }

  const exitLoading = exitCatalogLoading || strategiesLoading || customLoading

  return (
    <div
      className="border-carbon-600/50 bg-carbon-950/30 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-xl border p-4"
      data-testid="strategy-studio"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label
              htmlFor="studio-strategy-name"
              className="text-silver-300 text-xs font-medium tracking-wider uppercase"
            >
              Name
            </label>
            <input
              id="studio-strategy-name"
              type="text"
              value={authoring.customName}
              onChange={(event) => authoring.setCustomName(event.target.value)}
              className={inputClass}
              placeholder="e.g. MyRSIReversion"
              disabled={Boolean(authoring.loadedCustomName)}
            />
          </div>

          <div className="min-w-[16rem] flex-[2] space-y-1">
            <label
              htmlFor="studio-strategy-desc"
              className="text-silver-300 text-xs font-medium tracking-wider uppercase"
            >
              Description
            </label>
            <input
              id="studio-strategy-desc"
              type="text"
              value={authoring.description}
              onChange={(event) => authoring.setDescription(event.target.value)}
              className={inputClass}
              placeholder="Optional thesis summary..."
            />
          </div>

          <div className="flex shrink-0 items-center gap-2 pb-0.5">
            <button
              type="button"
              onClick={authoring.newDraft}
              className="border-brass-600/30 bg-brass-600/10 text-brass-400 hover:bg-brass-600/20 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold tracking-wider uppercase transition-colors"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New
            </button>
            <button
              type="button"
              onClick={authoring.saveCustom}
              disabled={authoring.isSaving || authoring.customName.trim().length === 0}
              className="border-brass-600/30 bg-brass-600/10 text-brass-400 hover:bg-brass-600/20 disabled:text-silver-500 disabled:border-carbon-700/40 disabled:bg-carbon-900/40 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold tracking-wider uppercase transition-colors"
            >
              <Save className="h-3.5 w-3.5" aria-hidden />
              {authoring.isSaving ? 'Saving…' : 'Save'}
            </button>
            {authoring.loadedCustomName ? (
              <button
                type="button"
                onClick={() => authoring.deleteCustom(authoring.loadedCustomName!)}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold tracking-wider text-rose-300 uppercase transition-colors hover:bg-rose-500/20"
                title="Delete loaded custom strategy"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Delete loaded custom strategy</span>
              </button>
            ) : null}
          </div>
        </div>

        {authoring.authoringError ? (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {authoring.authoringError}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div
          className="border-carbon-700/40 flex gap-1 border-b pb-px"
          role="tablist"
          aria-label="Strategy studio"
        >
          <StudioTabButton
            id="studio-tab-entry"
            panelId="studio-panel-entry"
            active={activeTab === 'entry'}
            onClick={() => setActiveTab('entry')}
          >
            Entry
          </StudioTabButton>
          <StudioTabButton
            id="studio-tab-exit"
            panelId="studio-panel-exit"
            active={activeTab === 'exit'}
            onClick={() => setActiveTab('exit')}
          >
            Exit & Targets
            {enabledExitCount > 0 ? ` (${enabledExitCount})` : ''}
          </StudioTabButton>
        </div>

        <div
          id="studio-panel-entry"
          role="tabpanel"
          aria-labelledby="studio-tab-entry"
          className={cn('min-h-0 flex-1', activeTab !== 'entry' && 'hidden')}
        >
          <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <StrategyLibrary
              strategies={builtInStrategies}
              strategyCatalog={config.strategies}
              customStrategies={customStrategies}
              engine={fields.engine}
              selectedStrategyName={authoring.loadedCustomName ? undefined : selectedStrategy?.name}
              selectedCustomName={authoring.loadedCustomName}
              onSelectBuiltIn={handleSelectBuiltIn}
              onSelectCustom={handleSelectCustom}
              onDeleteCustom={authoring.deleteCustom}
              loading={strategiesLoading || customLoading}
            />

            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
              {selectedStrategy?.thesis ? (
                <div className="bg-carbon-900/35 border-carbon-800/60 rounded-lg border px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setThesisOpen((open) => !open)}
                    className="text-brass-400 flex w-full items-center justify-between text-left text-xs font-semibold"
                    aria-expanded={thesisOpen}
                    data-testid="studio-thesis-toggle"
                  >
                    <span>Thesis</span>
                    <span className="text-silver-500 font-normal">
                      {thesisOpen ? 'Hide' : 'Show'}
                    </span>
                  </button>
                  {thesisOpen ? (
                    <p className="text-silver-400 mt-2 text-xs leading-relaxed">
                      {selectedStrategy.thesis}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {entryParamSpecs.length > 0 ? (
                <StrategyParamFields
                  params={entryParamSpecs}
                  values={fields.strategyParams}
                  onChange={setters.handleParamChange}
                  className="bg-carbon-900/20 border-carbon-800/40 grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
                  showHints
                  hintMode="compact"
                />
              ) : (
                <div className="text-silver-500 text-xs italic">
                  No entry parameters to configure.
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          id="studio-panel-exit"
          role="tabpanel"
          aria-labelledby="studio-tab-exit"
          className={cn('min-h-0 flex-1 overflow-y-auto', activeTab !== 'exit' && 'hidden')}
        >
          {exitCatalog && exitCatalog.exit_rules.length > 0 ? (
            <ExitConfigurator
              exitRules={exitCatalog.exit_rules}
              sharedExitParams={exitCatalog.shared_exit_params}
              exitPresets={exitCatalog.exit_presets}
              exitParamSpecs={exitParamSpecs}
              paramValues={fields.strategyParams}
              onChange={setters.handleParamChange}
              onParamsMerge={authoring.handleParamsMerge}
            />
          ) : (
            <div className="text-silver-500 text-xs italic">
              {exitLoading
                ? 'Loading exit catalog...'
                : 'Exit parameters not available for this strategy.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StudioTabButton({
  id,
  panelId,
  active,
  onClick,
  children,
}: {
  id: string
  panelId: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      onClick={onClick}
      className={cn(
        'rounded-t-md border-b-2 px-4 py-2 text-sm font-semibold transition-colors',
        active
          ? 'border-brass-500 text-brass-400'
          : 'text-silver-400 hover:text-silver-200 border-transparent',
      )}
    >
      {children}
    </button>
  )
}
