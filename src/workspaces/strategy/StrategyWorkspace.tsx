import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useStrategies, useExitRuleCatalog } from '@/api/queries/strategies'
import {
  useCustomStrategies,
  useSaveCustomStrategy,
  useDeleteCustomStrategy,
} from '@/api/queries/customStrategies'
import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import { inputClass } from '@/components/shared/InstrumentConfigFields'
import { cn } from '@/lib/utils'
import type { CustomStrategy } from '@/types/strategies'
import type { StrategyParamValue } from '@/lib/strategies/strategyParams'
import { partitionStrategyParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'
import { ExitConfigurator } from '@/workspaces/strategy/ExitConfigurator'
import { getEnabledExitRules } from '@/workspaces/strategy/exitRuleSemantics'
import {
  buildWorkbenchSummary,
  StrategyWorkbenchActionBar,
} from '@/workspaces/strategy/StrategyWorkbenchActionBar'
import { Cpu, Trash2, Plus, Settings2, ShieldCheck } from 'lucide-react'
import axios from 'axios'

const THESIS_COLLAPSE_THRESHOLD = 160

export function StrategyWorkspace() {
  const { data: allStrategies, isLoading: strategiesLoading } = useStrategies()
  const { data: exitCatalog, isLoading: exitCatalogLoading } = useExitRuleCatalog()
  const { data: customStrategies, isLoading: customLoading } = useCustomStrategies()
  const saveCustomStrategy = useSaveCustomStrategy()
  const deleteCustomStrategy = useDeleteCustomStrategy()

  const [selectedCustomName, setSelectedCustomName] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseStrategyName, setBaseStrategyName] = useState('')
  const [paramValues, setParamValues] = useState<Record<string, StrategyParamValue>>({})
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [thesisOpen, setThesisOpen] = useState(true)

  const customNames = useMemo(() => {
    return new Set(customStrategies?.map((s) => s.name) ?? [])
  }, [customStrategies])

  const baseStrategies = useMemo(() => {
    if (!allStrategies?.strategies) return []
    return allStrategies.strategies.filter(
      (s) => !customNames.has(s.name) && s.name !== 'CompositeStrategy',
    )
  }, [allStrategies, customNames])

  const selectedBaseStrategy = useMemo(() => {
    return baseStrategies.find((s) => s.name === baseStrategyName) || null
  }, [baseStrategies, baseStrategyName])

  const { entryParamSpecs, exitParamSpecs } = useMemo(() => {
    if (!selectedBaseStrategy) {
      return { entryParamSpecs: [], exitParamSpecs: [] }
    }
    return partitionStrategyParamSpecs(selectedBaseStrategy.params)
  }, [selectedBaseStrategy])

  const enabledExitCount = useMemo(() => {
    if (!exitCatalog) return 0
    return getEnabledExitRules(exitCatalog.exit_rules, paramValues).length
  }, [exitCatalog, paramValues])

  const workbenchSummary = buildWorkbenchSummary(enabledExitCount, name)
  const canSave = name.trim().length > 0 && !saveCustomStrategy.isPending
  const canBacktest = Boolean(baseStrategyName)

  useEffect(() => {
    const thesis = selectedBaseStrategy?.thesis ?? ''
    setThesisOpen(thesis.length <= THESIS_COLLAPSE_THRESHOLD)
  }, [selectedBaseStrategy?.thesis, baseStrategyName])

  const handleParamsMerge = (updates: Record<string, StrategyParamValue>) => {
    setParamValues((prev) => ({
      ...prev,
      ...updates,
    }))
  }

  const handleSelectCustom = (strategy: CustomStrategy) => {
    setSelectedCustomName(strategy.name)
    setName(strategy.name)
    setDescription(strategy.description ?? '')
    setBaseStrategyName(strategy.base_strategy)
    setParamValues(strategy.parameters)
    setErrorMsg(null)
  }

  const handleNewStrategy = () => {
    setSelectedCustomName(null)
    setName('')
    setDescription('')
    setErrorMsg(null)

    if (baseStrategies.length > 0) {
      const defaultBase = baseStrategies[0]
      setBaseStrategyName(defaultBase.name)

      const defaults: Record<string, StrategyParamValue> = {}
      defaultBase.params.forEach((p) => {
        defaults[p.name] = p.default
      })
      setParamValues(defaults)
    } else {
      setBaseStrategyName('')
      setParamValues({})
    }
  }

  const handleBaseStrategyChange = (newBaseName: string) => {
    setBaseStrategyName(newBaseName)
    const base = baseStrategies.find((s) => s.name === newBaseName)
    if (base) {
      const defaults: Record<string, StrategyParamValue> = {}
      base.params.forEach((p) => {
        defaults[p.name] = p.default
      })
      setParamValues(defaults)
    } else {
      setParamValues({})
    }
  }

  const handleParamChange = (pName: string, value: StrategyParamValue) => {
    setParamValues((prev) => ({
      ...prev,
      [pName]: value,
    }))
  }

  const handleSave = () => {
    setErrorMsg(null)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMsg('Strategy name is required.')
      return
    }

    const isBuiltIn = baseStrategies.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase())
    if (isBuiltIn) {
      setErrorMsg(
        `"${trimmedName}" conflicts with a built-in strategy name. Please choose a different name.`,
      )
      return
    }

    if (!selectedCustomName && customNames.has(trimmedName)) {
      setErrorMsg(`A custom strategy named "${trimmedName}" already exists.`)
      return
    }

    const payload: CustomStrategy = {
      name: trimmedName,
      base_strategy: baseStrategyName,
      description: description.trim(),
      parameters: paramValues,
    }

    saveCustomStrategy.mutate(payload, {
      onSuccess: () => {
        setSelectedCustomName(trimmedName)
      },
      onError: (err: unknown) => {
        const message = axios.isAxiosError(err)
          ? ((err.response?.data as { detail?: string })?.detail ?? err.message)
          : err instanceof Error
            ? err.message
            : 'Failed to save strategy.'
        setErrorMsg(message)
      },
    })
  }

  const handleDelete = (cName: string) => {
    if (window.confirm(`Are you sure you want to delete the custom strategy "${cName}"?`)) {
      deleteCustomStrategy.mutate(cName, {
        onSuccess: () => {
          if (selectedCustomName === cName) {
            handleNewStrategy()
          }
        },
      })
    }
  }

  const isLoading = strategiesLoading || customLoading || exitCatalogLoading
  const hasSavedStrategies = Boolean(customStrategies && customStrategies.length > 0)

  useEffect(() => {
    if (!isLoading && baseStrategies.length > 0 && !baseStrategyName && !selectedCustomName) {
      const defaultBase = baseStrategies[0]
      setBaseStrategyName(defaultBase.name)
      const defaults: Record<string, StrategyParamValue> = {}
      defaultBase.params.forEach((p) => {
        defaults[p.name] = p.default
      })
      setParamValues(defaults)
    }
  }, [isLoading, baseStrategies, baseStrategyName, selectedCustomName])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-1">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-silver-100 text-xl font-medium">Strategy Workbench</h1>
          <p className="text-silver-400 text-sm">
            Blend entry logic with composable exits, then save or send to Backtests.
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewStrategy}
          className="border-brass-600/30 bg-brass-600/10 text-brass-400 hover:bg-brass-600/20 flex items-center gap-1.5 self-start rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors"
        >
          <Plus className="h-4 w-4" /> New Strategy
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <aside className="lg:col-span-3" data-testid="workbench-saved-rail">
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold tracking-wider uppercase">
                Saved Strategies
              </CardTitle>
              {hasSavedStrategies ? (
                <CardDescription className="text-[11px]">
                  Select a custom strategy to edit
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent
              className={cn(
                'flex-1',
                hasSavedStrategies
                  ? 'max-h-[min(70vh,520px)] space-y-1.5 overflow-y-auto pb-3'
                  : 'pb-3',
              )}
            >
              {isLoading ? (
                <div className="text-silver-500 py-3 text-center font-mono text-xs">Loading...</div>
              ) : !hasSavedStrategies ? (
                <div
                  className="flex flex-col items-start gap-2 py-1"
                  data-testid="workbench-saved-empty"
                >
                  <p className="text-silver-500 text-xs">No saved strategies yet.</p>
                  <button
                    type="button"
                    onClick={handleNewStrategy}
                    className="border-brass-600/30 bg-brass-600/10 text-brass-400 hover:bg-brass-600/20 rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase"
                  >
                    New Strategy
                  </button>
                </div>
              ) : (
                customStrategies!.map((strategy) => {
                  const isActive = selectedCustomName === strategy.name
                  return (
                    <div
                      key={strategy.name}
                      onClick={() => handleSelectCustom(strategy)}
                      className={cn(
                        'group flex cursor-pointer items-start justify-between rounded-md border px-2.5 py-2 transition-colors',
                        isActive
                          ? 'border-brass-500 bg-brass-500/10 text-brass-200'
                          : 'border-carbon-800/60 bg-carbon-900/35 text-silver-300 hover:border-brass-600/30 hover:bg-carbon-800/30',
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <Cpu className="text-brass-400 mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <h3 className="truncate font-mono text-[11px] font-bold">
                            {strategy.name}
                          </h3>
                          <p className="text-silver-500 truncate font-mono text-[10px]">
                            {strategy.base_strategy}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(strategy.name)
                        }}
                        className="text-silver-500 hover:bg-carbon-800/50 rounded p-0.5 opacity-0 transition-opacity group-hover:text-rose-400 group-hover:opacity-100"
                        title="Delete custom strategy"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-9" data-testid="workbench-form-panel">
          <Card className="overflow-hidden">
            <CardHeader className="border-carbon-800/60 border-b px-4 py-3">
              <CardTitle className="text-xs font-semibold tracking-wider uppercase">
                {selectedCustomName ? 'Edit Strategy' : 'Create Custom Strategy'}
              </CardTitle>
              <CardDescription className="text-[11px]">
                {selectedCustomName
                  ? `Editing "${selectedCustomName}"`
                  : 'Setup → entry parameters → exit rules'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 px-4 pt-4 pb-2">
              {errorMsg && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {errorMsg}
                </div>
              )}

              <section id="workbench-setup" className="space-y-3">
                <h3 className="text-silver-400 text-[11px] font-semibold tracking-wider uppercase">
                  Setup
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="workbench-name"
                      className="text-silver-300 text-xs font-medium tracking-wider uppercase"
                    >
                      Strategy Name
                    </label>
                    <input
                      id="workbench-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. MyRSIReversion"
                      disabled={!!selectedCustomName}
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="workbench-base"
                      className="text-silver-300 text-xs font-medium tracking-wider uppercase"
                    >
                      Base Entry Strategy
                    </label>
                    <select
                      id="workbench-base"
                      value={baseStrategyName}
                      onChange={(e) => handleBaseStrategyChange(e.target.value)}
                      className={inputClass}
                      disabled={!!selectedCustomName}
                    >
                      {baseStrategies.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 sm:col-span-2 xl:col-span-1">
                    <label
                      htmlFor="workbench-desc"
                      className="text-silver-300 text-xs font-medium tracking-wider uppercase"
                    >
                      Description
                    </label>
                    <input
                      id="workbench-desc"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={inputClass}
                      placeholder="Optional thesis summary..."
                    />
                  </div>
                </div>
              </section>

              <section id="workbench-entry" className="space-y-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="text-brass-400 h-4 w-4" aria-hidden />
                  <h3 className="text-silver-200 text-sm font-semibold tracking-wide">
                    1. Entry Strategy Parameters
                  </h3>
                </div>

                {selectedBaseStrategy?.thesis ? (
                  <div className="bg-carbon-900/35 border-carbon-800/60 rounded-lg border px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setThesisOpen((open) => !open)}
                      className="text-brass-400 flex w-full items-center justify-between text-left text-xs font-semibold"
                      aria-expanded={thesisOpen}
                      data-testid="workbench-thesis-toggle"
                    >
                      <span>Thesis</span>
                      <span className="text-silver-500 font-normal">
                        {thesisOpen ? 'Hide' : 'Show'}
                      </span>
                    </button>
                    {thesisOpen ? (
                      <p className="text-silver-400 mt-2 text-xs leading-relaxed">
                        {selectedBaseStrategy.thesis}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {entryParamSpecs.length > 0 ? (
                  <StrategyParamFields
                    params={entryParamSpecs}
                    values={paramValues}
                    onChange={handleParamChange}
                    className="bg-carbon-900/20 border-carbon-800/40 grid gap-3 rounded-lg border p-3 sm:grid-cols-2 xl:grid-cols-3"
                    showHints
                    hintMode="compact"
                  />
                ) : (
                  <div className="text-silver-500 text-xs italic">
                    No entry parameters to configure.
                  </div>
                )}
              </section>

              <section id="workbench-exits" className="space-y-3 pb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-brass-400 h-4 w-4" aria-hidden />
                  <h3 className="text-silver-200 text-sm font-semibold tracking-wide">
                    2. Exit Strategy & Risk Management
                  </h3>
                </div>

                {exitCatalog && exitCatalog.exit_rules.length > 0 ? (
                  <ExitConfigurator
                    exitRules={exitCatalog.exit_rules}
                    sharedExitParams={exitCatalog.shared_exit_params}
                    exitPresets={exitCatalog.exit_presets}
                    exitParamSpecs={exitParamSpecs}
                    paramValues={paramValues}
                    onChange={handleParamChange}
                    onParamsMerge={handleParamsMerge}
                  />
                ) : (
                  <div className="text-silver-500 text-xs italic">
                    {isLoading
                      ? 'Loading exit catalog...'
                      : 'Exit parameters not available for this strategy.'}
                  </div>
                )}
              </section>
            </CardContent>

            <StrategyWorkbenchActionBar
              summary={workbenchSummary}
              canSave={canSave}
              isSaving={saveCustomStrategy.isPending}
              onSave={handleSave}
              canBacktest={canBacktest}
              baseStrategyName={baseStrategyName}
              paramValues={paramValues}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
