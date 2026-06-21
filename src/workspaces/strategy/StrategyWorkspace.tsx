import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useStrategies } from '@/api/queries/strategies'
import {
  useCustomStrategies,
  useSaveCustomStrategy,
  useDeleteCustomStrategy,
} from '@/api/queries/customStrategies'
import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import { inputClass, presetButtonActiveClass } from '@/components/shared/InstrumentConfigFields'
import { cn } from '@/lib/utils'
import type { CustomStrategy } from '@/types/strategies'
import type { StrategyParamValue } from '@/lib/strategies/strategyParams'
import { Cpu, Trash2, Plus, Settings2, ShieldCheck, HelpCircle } from 'lucide-react'
import axios from 'axios'

const EXIT_PARAM_NAMES = new Set([
  'stop_loss_pct',
  'take_profit_pct',
  'trailing_stop_pct',
  'stop_loss_atr',
  'take_profit_atr',
  'atr_period',
])

export function StrategyWorkspace() {
  const { data: allStrategies, isLoading: strategiesLoading } = useStrategies()
  const { data: customStrategies, isLoading: customLoading } = useCustomStrategies()
  const saveCustomStrategy = useSaveCustomStrategy()
  const deleteCustomStrategy = useDeleteCustomStrategy()

  // Selection state
  const [selectedCustomName, setSelectedCustomName] = useState<string | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseStrategyName, setBaseStrategyName] = useState('')
  const [paramValues, setParamValues] = useState<Record<string, StrategyParamValue>>({})
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Derived built-in base strategies
  const customNames = useMemo(() => {
    return new Set(customStrategies?.map((s) => s.name) ?? [])
  }, [customStrategies])

  const baseStrategies = useMemo(() => {
    if (!allStrategies?.strategies) return []
    return allStrategies.strategies.filter(
      (s) => !customNames.has(s.name) && s.name !== 'CompositeStrategy',
    )
  }, [allStrategies, customNames])

  // Selected base strategy details
  const selectedBaseStrategy = useMemo(() => {
    return baseStrategies.find((s) => s.name === baseStrategyName) || null
  }, [baseStrategies, baseStrategyName])

  // Filter entry vs exit parameter specs for the selected base strategy
  const entryParamSpecs = useMemo(() => {
    if (!selectedBaseStrategy) return []
    return selectedBaseStrategy.params.filter((p) => !EXIT_PARAM_NAMES.has(p.name))
  }, [selectedBaseStrategy])

  const exitParamSpecs = useMemo(() => {
    if (!selectedBaseStrategy) return []
    return selectedBaseStrategy.params.filter((p) => EXIT_PARAM_NAMES.has(p.name))
  }, [selectedBaseStrategy])

  // Load a custom strategy into the form
  const handleSelectCustom = (strategy: CustomStrategy) => {
    setSelectedCustomName(strategy.name)
    setName(strategy.name)
    setDescription(strategy.description ?? '')
    setBaseStrategyName(strategy.base_strategy)
    setParamValues(strategy.parameters)
    setErrorMsg(null)
  }

  // Clear form to create a new custom strategy
  const handleNewStrategy = () => {
    setSelectedCustomName(null)
    setName('')
    setDescription('')
    setErrorMsg(null)

    // Default to the first base strategy if available
    if (baseStrategies.length > 0) {
      const defaultBase = baseStrategies[0]
      setBaseStrategyName(defaultBase.name)

      // Initialize parameter defaults
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

  // Handle base strategy change
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

  // Handle parameter value change
  const handleParamChange = (pName: string, value: StrategyParamValue) => {
    setParamValues((prev) => ({
      ...prev,
      [pName]: value,
    }))
  }

  // Handle Save
  const handleSave = () => {
    setErrorMsg(null)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMsg('Strategy name is required.')
      return
    }

    // Ensure name doesn't conflict with built-in strategy
    const isBuiltIn = baseStrategies.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase())
    if (isBuiltIn) {
      setErrorMsg(
        `"${trimmedName}" conflicts with a built-in strategy name. Please choose a different name.`,
      )
      return
    }

    // If creating a new strategy, check if name already exists in custom list
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

  // Handle Delete
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

  const isLoading = strategiesLoading || customLoading

  // Initialize form if empty and strategies loaded
  useMemo(() => {
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
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-silver-100 text-xl font-medium">Strategy Workbench</h1>
          <p className="text-silver-400 text-sm">
            Create, customize, and save strategies by blending entry logic with risk management exit
            strategies.
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewStrategy}
          className="border-brass-600/30 bg-brass-600/10 text-brass-400 hover:bg-brass-600/20 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors"
        >
          <Plus className="h-4 w-4" /> New Strategy
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Left Column: Custom Strategies List */}
        <div className="flex flex-col gap-4 md:col-span-4">
          <Card className="flex flex-1 flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-wider uppercase">
                Saved Strategies
              </CardTitle>
              <CardDescription>Select a custom strategy to edit or test</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[500px] flex-1 space-y-2 overflow-y-auto">
              {isLoading ? (
                <div className="text-silver-500 py-6 text-center font-mono text-xs">
                  Loading workbench data...
                </div>
              ) : !customStrategies || customStrategies.length === 0 ? (
                <div className="border-carbon-800/80 text-silver-500 rounded-lg border-2 border-dashed px-4 py-8 text-center text-xs">
                  No custom strategies saved yet. Create your first one!
                </div>
              ) : (
                customStrategies.map((strategy) => {
                  const isActive = selectedCustomName === strategy.name
                  return (
                    <div
                      key={strategy.name}
                      onClick={() => handleSelectCustom(strategy)}
                      className={cn(
                        'group flex cursor-pointer items-start justify-between rounded-lg border p-3 transition-all duration-200',
                        isActive
                          ? 'border-brass-500 bg-brass-500/10 text-brass-200'
                          : 'border-carbon-800/60 bg-carbon-900/35 text-silver-300 hover:border-brass-600/30 hover:bg-carbon-800/30',
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <Cpu className="text-brass-400 mt-0.5 h-4.5 w-4.5 shrink-0" />
                        <div className="min-w-0">
                          <h3 className="truncate font-mono text-xs font-bold">{strategy.name}</h3>
                          <p className="text-silver-500 truncate font-mono text-[10px]">
                            Base: {strategy.base_strategy}
                          </p>
                          {strategy.description && (
                            <p className="text-silver-400 mt-1 line-clamp-1 text-[11px] leading-normal">
                              {strategy.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(strategy.name)
                        }}
                        className="text-silver-500 hover:bg-carbon-800/50 rounded p-1 opacity-0 transition-opacity group-hover:text-rose-400 group-hover:opacity-100"
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
        </div>

        {/* Right Column: Workbench Form */}
        <div className="md:col-span-8">
          <Card>
            <CardHeader className="border-carbon-800/60 border-b pb-4">
              <CardTitle className="text-sm font-semibold tracking-wider uppercase">
                {selectedCustomName ? 'Edit Strategy' : 'Create Custom Strategy'}
              </CardTitle>
              <CardDescription>
                {selectedCustomName
                  ? `Modifying parameters for "${selectedCustomName}"`
                  : 'Specify entry rules and specialized exits to design your custom strategy'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-5">
              {errorMsg && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
                  {errorMsg}
                </div>
              )}

              {/* 1. Identity & Base Selection */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
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
                  {selectedCustomName && (
                    <p className="text-silver-500 text-[10px]">
                      Strategy names cannot be changed once saved.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
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
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="workbench-desc"
                  className="text-silver-300 text-xs font-medium tracking-wider uppercase"
                >
                  Description
                </label>
                <textarea
                  id="workbench-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={cn(inputClass, 'resize-none')}
                  placeholder="Summarize the core thesis, settings, or risk model..."
                />
              </div>

              <hr className="border-carbon-800/80" />

              {/* 2. Strategy Parameters (Entry Rules) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="text-brass-400 h-4 w-4" />
                  <h3 className="text-silver-200 text-sm font-semibold tracking-wide">
                    1. Entry Strategy Parameters
                  </h3>
                </div>
                {selectedBaseStrategy && selectedBaseStrategy.thesis && (
                  <p className="text-silver-400 bg-carbon-900/35 border-carbon-800/60 rounded-lg border p-3 text-xs leading-normal">
                    <span className="text-brass-400 mb-0.5 block font-semibold">Thesis:</span>
                    {selectedBaseStrategy.thesis}
                  </p>
                )}
                {entryParamSpecs.length > 0 ? (
                  <StrategyParamFields
                    params={entryParamSpecs}
                    values={paramValues}
                    onChange={handleParamChange}
                    className="bg-carbon-900/20 border-carbon-800/40 grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
                    showHints={true}
                  />
                ) : (
                  <div className="text-silver-500 py-3 text-xs italic">
                    No entry parameters to configure.
                  </div>
                )}
              </div>

              <hr className="border-carbon-800/80" />

              {/* 3. Exit Strategy & Risk Management */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-brass-400 h-4.5 w-4.5" />
                    <h3 className="text-silver-200 text-sm font-semibold tracking-wide">
                      2. Exit Strategy & Risk Management
                    </h3>
                  </div>
                  <div className="text-silver-500 flex items-center gap-1 font-mono text-[10px] tracking-wider uppercase">
                    <HelpCircle className="h-3.5 w-3.5" /> Set to 0 to disable
                  </div>
                </div>

                {exitParamSpecs.length > 0 ? (
                  <div className="space-y-4">
                    {/* Percentage Exits */}
                    <div className="bg-carbon-900/20 border-carbon-800/40 rounded-lg border p-4">
                      <h4 className="text-silver-300 mb-3 text-xs font-semibold tracking-wider uppercase">
                        Fixed & Trailing Percentage Exits
                      </h4>
                      <div className="grid gap-4 sm:grid-cols-3">
                        {exitParamSpecs
                          .filter((p) => p.name.endsWith('_pct'))
                          .map((spec) => {
                            const value = paramValues[spec.name] ?? spec.default
                            return (
                              <div key={spec.name} className="space-y-1">
                                <label
                                  htmlFor={`exit-param-${spec.name}`}
                                  className="text-silver-400 font-mono text-xs"
                                >
                                  {spec.label}
                                </label>
                                <input
                                  id={`exit-param-${spec.name}`}
                                  type="number"
                                  step={spec.step ?? 0.001}
                                  min={spec.min ?? 0}
                                  max={spec.max ?? undefined}
                                  value={Number(value)}
                                  onChange={(e) =>
                                    handleParamChange(spec.name, parseFloat(e.target.value) || 0)
                                  }
                                  className={inputClass}
                                />
                                <p className="text-silver-500 text-[10px] leading-tight">
                                  {spec.name === 'stop_loss_pct' &&
                                    'Fixed stop loss (e.g. 0.02 = 2%)'}
                                  {spec.name === 'take_profit_pct' &&
                                    'Fixed target (e.g. 0.05 = 5%)'}
                                  {spec.name === 'trailing_stop_pct' &&
                                    'Trailing stop from peak (e.g. 0.02 = 2%)'}
                                </p>
                              </div>
                            )
                          })}
                      </div>
                    </div>

                    {/* Volatility Exits */}
                    <div className="bg-carbon-900/20 border-carbon-800/40 rounded-lg border p-4">
                      <h4 className="text-silver-300 mb-3 text-xs font-semibold tracking-wider uppercase">
                        Volatility-Adjusted Exits (ATR)
                      </h4>
                      <div className="grid gap-4 sm:grid-cols-3">
                        {exitParamSpecs
                          .filter((p) => !p.name.endsWith('_pct'))
                          .map((spec) => {
                            const value = paramValues[spec.name] ?? spec.default
                            return (
                              <div key={spec.name} className="space-y-1">
                                <label
                                  htmlFor={`exit-param-${spec.name}`}
                                  className="text-silver-400 font-mono text-xs"
                                >
                                  {spec.label}
                                </label>
                                <input
                                  id={`exit-param-${spec.name}`}
                                  type="number"
                                  step={spec.step ?? 1}
                                  min={spec.min ?? 0}
                                  max={spec.max ?? undefined}
                                  value={Number(value)}
                                  onChange={(e) =>
                                    handleParamChange(
                                      spec.name,
                                      spec.type === 'int'
                                        ? parseInt(e.target.value) || 0
                                        : parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className={inputClass}
                                />
                                <p className="text-silver-500 text-[10px] leading-tight">
                                  {spec.name === 'stop_loss_atr' && 'Stop Loss (ATR multiplier)'}
                                  {spec.name === 'take_profit_atr' &&
                                    'Take Profit (ATR multiplier)'}
                                  {spec.name === 'atr_period' && "Wilder's smoothing lookback"}
                                </p>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-silver-500 py-3 text-xs italic">
                    Exit parameters not available for this strategy.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveCustomStrategy.isPending}
                  className={cn(
                    presetButtonActiveClass,
                    'px-5 py-2.5 text-xs font-bold tracking-wider uppercase',
                  )}
                >
                  {saveCustomStrategy.isPending ? 'Saving...' : 'Save Strategy'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
