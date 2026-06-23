import { Plus, Save, Trash2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

import { ExitStrategyCards } from '@/components/backtests/setup/ExitStrategyCards'
import { AiStrategyTeaser } from '@/components/backtests/setup/AiStrategyTeaser'
import { StrategyLibrary } from '@/components/backtests/setup/StrategyLibrary'
import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import { inputClass } from '@/components/shared/InstrumentConfigFields'
import { FeatureIslandFallback } from '@/components/islands/FeatureIslandFallback'
import type { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import type { AiStrategySession } from '@/lib/strategies/useAiStrategySession'
import { filterApplicableExitRules } from '@/lib/optimize/exitSearchSpace'
import type { BacktestRequest } from '@/types/backtesting'
import type { ExitRuleInfo } from '@/types/strategies'
import {
  getEnabledExitRules,
  getVisibleSharedParamNames,
  isExitRuleEnabled,
  resolveRuleParamSpecs,
  toggleExitRuleParam,
} from '@/workspaces/strategy/exitRuleSemantics'
import { EXIT_GROUP_LABELS } from '@/workspaces/strategy/exitWorkbenchGroups'

const LazyAiStrategyIsland = lazy(() =>
  import('@/components/backtests/setup/AiStrategyIsland').then((module) => ({
    default: module.AiStrategyIsland,
  })),
)

const LazyAiStrategyPanel = lazy(() =>
  import('@/components/backtests/setup/AiStrategyPanel').then((module) => ({
    default: module.AiStrategyPanel,
  })),
)

type BacktestConfig = ReturnType<typeof useBacktestConfig>

type StrategyStudioProps = {
  config: BacktestConfig
  /** When provided (tests), renders the AI panel eagerly without lazy loading. */
  aiSession?: AiStrategySession
  onRunBacktest?: (request: BacktestRequest) => void
  onAiWorkflowBlockerChange?: (blocker: string | null) => void
}

const THESIS_COLLAPSE_THRESHOLD = 160

function tunableRuleParamSpecs(
  rule: ExitRuleInfo,
  exitParamSpecs: BacktestConfig['exitParamSpecs'],
) {
  return resolveRuleParamSpecs(rule, exitParamSpecs).filter(
    (spec) => spec.name !== rule.enable_param,
  )
}

export function StrategyStudio({
  config,
  aiSession,
  onRunBacktest,
  onAiWorkflowBlockerChange,
}: StrategyStudioProps) {
  const [thesisOpen, setThesisOpen] = useState(true)
  const [aiPanelOpen, setAiPanelOpen] = useState(Boolean(aiSession))

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

  const applicableExitRules = useMemo(
    () => filterApplicableExitRules(exitCatalog?.exit_rules ?? [], exitParamSpecs),
    [exitCatalog?.exit_rules, exitParamSpecs],
  )

  const enabledExitRules = useMemo(
    () => getEnabledExitRules(applicableExitRules, fields.strategyParams),
    [applicableExitRules, fields.strategyParams],
  )

  const visibleSharedParamNames = useMemo(
    () =>
      getVisibleSharedParamNames(
        applicableExitRules,
        fields.strategyParams,
        exitCatalog?.shared_exit_params ?? [],
      ),
    [applicableExitRules, fields.strategyParams, exitCatalog?.shared_exit_params],
  )

  const sharedParamSpecs = useMemo(
    () => exitParamSpecs.filter((spec) => visibleSharedParamNames.includes(spec.name)),
    [exitParamSpecs, visibleSharedParamNames],
  )

  useEffect(() => {
    const thesis = selectedStrategy?.thesis ?? ''
    setThesisOpen(thesis.length <= THESIS_COLLAPSE_THRESHOLD)
  }, [selectedStrategy?.thesis, fields.strategy])

  useEffect(() => {
    if (!aiSession) return
    onAiWorkflowBlockerChange?.(aiSession.workflowBlocker)
  }, [aiSession, aiSession?.workflowBlocker, onAiWorkflowBlockerChange])

  const handleSelectBuiltIn = (name: string) => {
    setters.handleStrategyChange(name)
    authoring.newDraft()
    aiSession?.resetDraft()
  }

  const handleSelectCustom = (custom: Parameters<BacktestConfig['authoring']['loadCustom']>[0]) => {
    authoring.loadCustom(custom)
    if (aiSession) {
      aiSession.hydrateFromMetadata(custom.ai_metadata)
    } else {
      setAiPanelOpen(Boolean(custom.ai_metadata))
    }
  }

  const handleToggleExitRule = (rule: ExitRuleInfo) => {
    toggleExitRuleParam(rule, fields.strategyParams, setters.handleParamChange, exitParamSpecs)
  }

  const libraryLoading = strategiesLoading || customLoading

  const renderAiSection = () => {
    if (aiSession) {
      return (
        <Suspense
          fallback={<FeatureIslandFallback variant="inline" label="Loading AI strategy builder" />}
        >
          <LazyAiStrategyPanel session={aiSession} />
        </Suspense>
      )
    }

    if (!aiPanelOpen) {
      return (
        <AiStrategyTeaser
          onOpen={() => setAiPanelOpen(true)}
          hasActiveDraft={Boolean(authoring.loadedCustomName)}
        />
      )
    }

    if (!onRunBacktest) return null

    return (
      <Suspense
        fallback={<FeatureIslandFallback variant="inline" label="Loading AI strategy builder" />}
      >
        <LazyAiStrategyIsland
          config={config}
          onRunBacktest={onRunBacktest}
          onWorkflowBlockerChange={onAiWorkflowBlockerChange}
        />
      </Suspense>
    )
  }

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

        {renderAiSection()}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
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
            loading={libraryLoading}
          />
          {exitCatalogLoading ? (
            <p className="text-silver-500 text-xs italic">Loading exits…</p>
          ) : (
            <ExitStrategyCards
              rules={applicableExitRules}
              exitParamSpecs={exitParamSpecs}
              isEnabled={(rule) => isExitRuleEnabled(rule, fields.strategyParams)}
              onToggle={handleToggleExitRule}
            />
          )}
        </div>

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
                <span className="text-silver-500 font-normal">{thesisOpen ? 'Hide' : 'Show'}</span>
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
            <div className="text-silver-500 text-xs italic">No entry parameters to configure.</div>
          )}

          {enabledExitRules.map((rule) => {
            const tunableSpecs = tunableRuleParamSpecs(rule, exitParamSpecs)
            if (tunableSpecs.length === 0) return null

            const groupLabel =
              rule.exit_group in EXIT_GROUP_LABELS
                ? EXIT_GROUP_LABELS[rule.exit_group as keyof typeof EXIT_GROUP_LABELS]
                : rule.label

            return (
              <section
                key={rule.id}
                className="bg-carbon-900/20 border-carbon-800/40 rounded-lg border p-3"
              >
                <h5 className="text-silver-400 mb-3 text-xs font-semibold tracking-wide uppercase">
                  {groupLabel}
                </h5>
                <StrategyParamFields
                  params={tunableSpecs}
                  values={fields.strategyParams}
                  onChange={setters.handleParamChange}
                  className="grid gap-3 sm:grid-cols-2"
                  showHints
                  hintMode="compact"
                />
              </section>
            )
          })}

          {sharedParamSpecs.length > 0 ? (
            <section className="bg-carbon-900/20 border-carbon-800/40 rounded-lg border p-3">
              <h5 className="text-silver-400 mb-3 text-xs font-semibold tracking-wide uppercase">
                {EXIT_GROUP_LABELS.general}
              </h5>
              <StrategyParamFields
                params={sharedParamSpecs}
                values={fields.strategyParams}
                onChange={setters.handleParamChange}
                className="grid gap-3 sm:grid-cols-2"
                showHints
                hintMode="compact"
              />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
