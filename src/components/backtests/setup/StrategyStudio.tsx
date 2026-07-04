import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { EntryManagerSelector } from '@/components/backtests/setup/EntryManagerSelector'
import { ExitStrategyCards } from '@/components/backtests/setup/ExitStrategyCards'
import { StrategyLibrary } from '@/components/backtests/setup/StrategyLibrary'
import { StrategyFlowChart } from '@/components/backtests/setup/StrategyFlowChart'
import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import { useActiveJobs } from '@/hooks/useActiveJobs'
import { useSignalManagers } from '@/api/queries/strategies'
import type { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { instanceCountByStrategy } from '@/lib/backtesting/entryInstances'
import { filterApplicableExitRules } from '@/lib/optimize/exitSearchSpace'
import type { ExitRuleInfo } from '@/types/strategies'
import {
  getEnabledExitRules,
  getVisibleSharedParamNames,
  isExitRuleEnabled,
  resolveRuleParamSpecs,
  toggleExitRuleParam,
} from '@/workspaces/strategy/exitRuleSemantics'
import {
  EXIT_GROUP_LABELS,
  partitionStrategyParamSpecs,
} from '@/workspaces/strategy/exitWorkbenchGroups'

type BacktestConfig = ReturnType<typeof useBacktestConfig>

type StrategyStudioProps = {
  config: BacktestConfig
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

export function StrategyStudio({ config }: StrategyStudioProps) {
  const [thesisOpen, setThesisOpen] = useState(true)

  const activeJobs = useActiveJobs()
  const hasActiveJobs = Object.keys(activeJobs).length > 0

  const {
    fields,
    setters,
    builtInStrategies,
    selectedStrategy,
    strategiesLoading,
    exitParamSpecs,
    exitCatalog,
    exitCatalogLoading,
    customStrategies,
    customLoading,
    authoring,
    entries,
    entryManager,
    strategies,
  } = config

  const { data: signalManagersData } = useSignalManagers()
  const signalManagers = signalManagersData?.managers ?? []
  const instanceCounts = useMemo(() => instanceCountByStrategy(entries), [entries])
  const isComposite = fields.strategy === 'CompositeStrategy'

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
  }, [selectedStrategy?.thesis, fields.strategy, selectedStrategy])

  const handleSelectBuiltIn = (name: string) => {
    setters.handleStrategyChange(name)
    authoring.newDraft()
  }

  const handleAddEntry = (name: string) => {
    setters.addEntry(name)
    authoring.newDraft()
  }

  const handleSelectCustom = (custom: Parameters<BacktestConfig['authoring']['loadCustom']>[0]) => {
    authoring.loadCustom(custom)
  }

  const handleToggleExitRule = (rule: ExitRuleInfo) => {
    toggleExitRuleParam(rule, fields.strategyParams, setters.handleParamChange, exitParamSpecs)
  }

  return (
    <div
      className="border-carbon-600/50 bg-carbon-950/30 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-xl border p-4"
      data-testid="strategy-studio"
    >
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
            loading={strategiesLoading}
            loadingSaved={customLoading}
            multiSelect={!isComposite}
            instanceCounts={instanceCounts}
            onAddEntry={handleAddEntry}
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
          {selectedStrategy?.thesis && entries.length <= 1 ? (
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

          {!isComposite && entries.length > 0 ? (
            <EntryManagerSelector
              managers={signalManagers}
              value={entryManager}
              onChange={setters.setEntryManager}
              instanceCount={entries.length}
            />
          ) : null}

          {isComposite ? (
            <div className="text-silver-500 text-xs italic">
              Composite genome parameters are managed outside multi-entry instances.
            </div>
          ) : (
            entries.map((entry, index) => {
              const strategyInfo = strategies.find((item) => item.name === entry.strategy)
              const { entryParamSpecs: instanceEntrySpecs } = partitionStrategyParamSpecs(
                strategyInfo?.params ?? [],
              )
              const label = strategyInfo?.label ?? entry.strategy

              return (
                <section
                  key={entry.slotId}
                  className="bg-carbon-900/20 border-carbon-800/40 rounded-lg border p-3"
                  data-testid={`entry-instance-${index}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h5 className="text-silver-400 text-xs font-semibold tracking-wide uppercase">
                      e{index} · {label}
                    </h5>
                    {entries.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setters.removeEntry(entry.slotId)}
                        className="text-silver-500 rounded p-1 transition-colors hover:text-rose-300"
                        title={`Remove ${label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        <span className="sr-only">Remove {label}</span>
                      </button>
                    ) : null}
                  </div>
                  {instanceEntrySpecs.length > 0 ? (
                    <StrategyParamFields
                      params={instanceEntrySpecs}
                      values={entry.params}
                      onChange={(name, value) =>
                        setters.handleEntryParamChange(entry.slotId, name, value)
                      }
                      className="grid gap-3 sm:grid-cols-2"
                      showHints
                      hintMode="compact"
                    />
                  ) : (
                    <p className="text-silver-500 text-xs italic">No entry parameters.</p>
                  )}
                </section>
              )
            })
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

      <StrategyFlowChart
        entries={entries}
        entryManager={entryManager.kind}
        enabledExitRules={enabledExitRules}
        isComposite={isComposite}
        strategies={strategies}
        hasActiveJobs={hasActiveJobs}
      />
    </div>
  )
}
