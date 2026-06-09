import { endOfDay, startOfDay } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useStrategies } from '@/api/queries/strategies'
import { OptimizeAdvancedSection } from '@/components/optimize/OptimizeAdvancedSection'
import { OptimizeRiskSection } from '@/components/optimize/OptimizeRiskSection'
import { OptimizeStrategySection } from '@/components/optimize/OptimizeStrategySection'
import { OptimizeStudySection } from '@/components/optimize/OptimizeStudySection'
import { Button } from '@/components/ui/button'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import { hydrateOptimizeFormFromConfig } from '@/lib/optimize/hydrateConfigForm'
import {
  defaultSearchSpaceFromSpecs,
  searchSpaceToPayload,
  validateSearchSpace,
  type SearchSpaceFieldState,
} from '@/lib/strategies/strategyParams'
import { useAppStore } from '@/store/useAppStore'
import type { ObjectiveMode, OptimizationConfig, Sampler, SearchParam } from '@/types/optimization'

import type { RiskMode } from '@/components/optimize/optimizeFormShared'

type OptimizeConfigFormProps = {
  loading: boolean
  error: string | null
  disabled?: boolean
  onSubmit: (config: OptimizationConfig) => void
}

export function OptimizeConfigForm({
  loading,
  error,
  disabled = false,
  onSubmit,
}: OptimizeConfigFormProps) {
  const [symbol, setSymbol] = useState('PETR4')
  const [timeframe, setTimeframe] = useState('D1')
  const [startDate, setStartDate] = useState(defaultBacktestStart)
  const [endDate, setEndDate] = useState(defaultBacktestEnd)
  const [capital, setCapital] = useState(100000)
  const [pointValue, setPointValue] = useState(1.0)

  const [objective, setObjective] = useState<ObjectiveMode>('maximize_return_drawdown')
  const [sampler, setSampler] = useState<Sampler>('tpe')
  const [nTrials, setNTrials] = useState(30)
  const [seed, setSeed] = useState(42)
  const [pruner, setPruner] = useState<'none' | 'median' | 'hyperband'>('none')
  const [continueOnTrialError, setContinueOnTrialError] = useState(false)

  const [strategy, setStrategy] = useState('MACrossover')
  const [strategySearchSpace, setStrategySearchSpace] = useState<
    Record<string, SearchSpaceFieldState>
  >({})

  const [riskMode, setRiskMode] = useState<RiskMode>('fixed_quantity')
  const [qtyLow, setQtyLow] = useState(1)
  const [qtyHigh, setQtyHigh] = useState(3)
  const [marginLow, setMarginLow] = useState(1000)
  const [marginHigh, setMarginHigh] = useState(10000)
  const [minContractsLow, setMinContractsLow] = useState(1)
  const [minContractsHigh, setMinContractsHigh] = useState(3)

  const [strategyOpen, setStrategyOpen] = useState(true)
  const [riskOpen, setRiskOpen] = useState(true)
  const [studyOpen, setStudyOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const { data: strategiesData, isLoading: strategiesLoading } = useStrategies()
  const strategies = useMemo(() => strategiesData?.strategies ?? [], [strategiesData?.strategies])
  const selectedStrategy = strategies.find((entry) => entry.name === strategy)
  const searchSpaceInitialized = useRef(false)

  const pendingOptimizationConfig = useAppStore((s) => s.pendingOptimizationConfig)
  const setPendingOptimizationConfig = useAppStore((s) => s.setPendingOptimizationConfig)

  useEffect(() => {
    if (strategies.length === 0 || searchSpaceInitialized.current) return
    const info = strategies.find((entry) => entry.name === strategy) ?? strategies[0]
    if (!strategies.some((entry) => entry.name === strategy)) {
      setStrategy(info.name)
    }
    setStrategySearchSpace(defaultSearchSpaceFromSpecs(info.params))
    searchSpaceInitialized.current = true
  }, [strategies, strategy])

  useEffect(() => {
    if (!pendingOptimizationConfig) return
    const hydrated = hydrateOptimizeFormFromConfig(pendingOptimizationConfig, strategies)

    setSymbol(hydrated.symbol)
    setTimeframe(hydrated.timeframe)
    setStartDate(hydrated.startDate)
    setEndDate(hydrated.endDate)
    setCapital(hydrated.capital)
    setPointValue(hydrated.pointValue)
    setObjective(hydrated.objective)
    setSampler(hydrated.sampler)
    setNTrials(hydrated.nTrials)
    setSeed(hydrated.seed)
    setPruner(hydrated.pruner)
    setContinueOnTrialError(hydrated.continueOnTrialError)
    setStrategy(hydrated.strategy)
    setStrategySearchSpace(hydrated.strategySearchSpace)
    setRiskMode(hydrated.riskMode)
    setQtyLow(hydrated.qtyLow)
    setQtyHigh(hydrated.qtyHigh)
    setMarginLow(hydrated.marginLow)
    setMarginHigh(hydrated.marginHigh)
    setMinContractsLow(hydrated.minContractsLow)
    setMinContractsHigh(hydrated.minContractsHigh)
    searchSpaceInitialized.current = true

    setPendingOptimizationConfig(null)
  }, [pendingOptimizationConfig, setPendingOptimizationConfig, strategies])

  const handleStrategyChange = (nextStrategy: string) => {
    setStrategy(nextStrategy)
    const info = strategies.find((entry) => entry.name === nextStrategy)
    if (info) {
      setStrategySearchSpace(defaultSearchSpaceFromSpecs(info.params))
    }
  }

  const handleSearchSpaceChange = (name: string, field: SearchSpaceFieldState) => {
    setStrategySearchSpace((current) => ({ ...current, [name]: field }))
  }

  const dateRangeInvalid = startDate >= endDate
  const rangesInvalid =
    (riskMode === 'fixed_quantity'
      ? qtyLow > qtyHigh
      : marginLow > marginHigh || minContractsLow > minContractsHigh) ||
    !validateSearchSpace(strategySearchSpace)
  const formInvalid = dateRangeInvalid || rangesInvalid || nTrials < 1

  const isMultiObjective = objective === 'multi_objective_return_drawdown'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formInvalid || disabled || !selectedStrategy) return

    const strategyParams = searchSpaceToPayload(strategySearchSpace, selectedStrategy.params)

    const riskParams: Record<string, SearchParam> =
      riskMode === 'fixed_quantity'
        ? {
            type: { type: 'categorical', choices: ['fixed_quantity'] },
            quantity: { type: 'float', low: qtyLow, high: qtyHigh },
          }
        : {
            type: { type: 'categorical', choices: ['fixed_safety_margin'] },
            safety_margin_per_contract: { type: 'log-float', low: marginLow, high: marginHigh },
            min_contracts: { type: 'int', low: minContractsLow, high: minContractsHigh },
          }

    onSubmit({
      study: {
        name: `${symbol}_${objective}_${Date.now()}`,
        n_trials: nTrials,
        seed,
        pruner,
        continue_on_trial_error: continueOnTrialError,
        sampler: isMultiObjective ? 'nsgaii' : sampler,
      },
      objective: { mode: objective },
      backtest: {
        symbol,
        timeframe,
        start: startOfDay(startDate).toISOString(),
        end: endOfDay(endDate).toISOString(),
        initial_capital: capital,
        point_value: pointValue,
        strategy,
      },
      search_space: {
        strategy_params: strategyParams,
        risk_params: riskParams,
      },
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 shrink-0">
        <h2 className="text-brass-400 text-xl font-bold">Optimizer</h2>
        <p className="text-silver-400 mt-1 text-xs">
          Search strategy &amp; risk parameters with Optuna.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-3" noValidate>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          <OptimizeStrategySection
            open={strategyOpen}
            onToggle={() => setStrategyOpen((v) => !v)}
            strategies={strategies}
            strategiesLoading={strategiesLoading}
            strategy={strategy}
            onStrategyChange={handleStrategyChange}
            searchSpace={strategySearchSpace}
            onSearchSpaceChange={handleSearchSpaceChange}
            symbol={symbol}
            setSymbol={setSymbol}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            capital={capital}
            setCapital={setCapital}
            pointValue={pointValue}
            setPointValue={setPointValue}
          />

          <OptimizeRiskSection
            open={riskOpen}
            onToggle={() => setRiskOpen((v) => !v)}
            riskMode={riskMode}
            setRiskMode={setRiskMode}
            qtyLow={qtyLow}
            qtyHigh={qtyHigh}
            setQtyLow={setQtyLow}
            setQtyHigh={setQtyHigh}
            marginLow={marginLow}
            marginHigh={marginHigh}
            setMarginLow={setMarginLow}
            setMarginHigh={setMarginHigh}
            minContractsLow={minContractsLow}
            minContractsHigh={minContractsHigh}
            setMinContractsLow={setMinContractsLow}
            setMinContractsHigh={setMinContractsHigh}
          />

          <OptimizeStudySection
            open={studyOpen}
            onToggle={() => setStudyOpen((v) => !v)}
            objective={objective}
            setObjective={setObjective}
            sampler={sampler}
            setSampler={setSampler}
            nTrials={nTrials}
            setNTrials={setNTrials}
            isMultiObjective={isMultiObjective}
          />

          <OptimizeAdvancedSection
            open={advancedOpen}
            onToggle={() => setAdvancedOpen((v) => !v)}
            seed={seed}
            setSeed={setSeed}
            pruner={pruner}
            setPruner={setPruner}
            continueOnTrialError={continueOnTrialError}
            setContinueOnTrialError={setContinueOnTrialError}
          />
        </div>

        <div className="shrink-0 pt-2">
          <Button
            type="submit"
            disabled={loading || formInvalid || disabled || strategiesLoading}
            variant="brass"
            className="w-full"
          >
            {loading ? 'Starting...' : disabled ? 'Study in progress...' : 'Run Optimization'}
          </Button>

          {disabled && !loading && (
            <p className="text-silver-400 mt-2 text-center text-xs">
              Wait for the current study to finish before starting another.
            </p>
          )}

          {error && (
            <div className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs break-words text-rose-400">
              {error}
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
