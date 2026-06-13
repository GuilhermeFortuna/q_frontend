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
import { isMaxWorkersInputInvalid, withMaxWorkers } from '@/lib/optimize/studyConfig'
import {
  buildCostsPayload,
  defaultTransactionCostFields,
  validateTransactionCosts,
} from '@/lib/backtesting/transactionCosts'
import {
  defaultSearchSpaceFromSpecs,
  searchSpaceToPayload,
  validateSearchSpace,
  type SearchSpaceFieldState,
} from '@/lib/strategies/strategyParams'
import { useAppStore } from '@/store/useAppStore'
import type { ObjectiveMode, OptimizationConfig, Sampler, SearchParam } from '@/types/optimization'
import type { StrategyInfo } from '@/types/strategies'

import type { RiskMode } from '@/components/optimize/optimizeFormShared'

type OptimizeEngine = 'candle' | 'tick'

const DISPLAY_TIMEFRAME_OPTIONS = ['M1', 'M5', 'M15', 'H1'] as const

function strategyEngine(info: StrategyInfo): OptimizeEngine {
  return info.engine ?? 'candle'
}

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
  const [dayTrade, setDayTrade] = useState(false)
  const [dayTradeStartTime, setDayTradeStartTime] = useState('09:00')
  const [dayTradeEndTime, setDayTradeEndTime] = useState('16:00')
  const [dayTradeCloseTime, setDayTradeCloseTime] = useState('17:00')
  const [engine, setEngine] = useState<OptimizeEngine>('candle')
  const [displayTimeframe, setDisplayTimeframe] = useState('M1')
  const [tickFlags, setTickFlags] = useState<'all' | 'trade'>('all')

  const [objective, setObjective] = useState<ObjectiveMode>('maximize_return_drawdown')
  const [sampler, setSampler] = useState<Sampler>('tpe')
  const [nTrials, setNTrials] = useState(30)
  const [seed, setSeed] = useState(42)
  const [pruner, setPruner] = useState<'none' | 'median' | 'hyperband'>('none')
  const [continueOnTrialError, setContinueOnTrialError] = useState(false)
  const [maxWorkersInput, setMaxWorkersInput] = useState('')

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
  const [targetVolLow, setTargetVolLow] = useState(5)
  const [targetVolHigh, setTargetVolHigh] = useState(15)
  const [inverseMinContractsLow, setInverseMinContractsLow] = useState(0)
  const [inverseMinContractsHigh, setInverseMinContractsHigh] = useState(2)
  const [inverseMaxContractsInput, setInverseMaxContractsInput] = useState('')
  const [costFields, setCostFields] = useState(defaultTransactionCostFields)

  const [strategyOpen, setStrategyOpen] = useState(true)
  const [riskOpen, setRiskOpen] = useState(true)
  const [studyOpen, setStudyOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const { data: strategiesData, isLoading: strategiesLoading } = useStrategies()
  const strategies = useMemo(() => strategiesData?.strategies ?? [], [strategiesData?.strategies])
  const filteredStrategies = useMemo(
    () => strategies.filter((entry) => strategyEngine(entry) === engine),
    [strategies, engine],
  )
  const selectedStrategy = filteredStrategies.find((entry) => entry.name === strategy)
  const searchSpaceInitialized = useRef(false)

  const pendingOptimizationConfig = useAppStore((s) => s.pendingOptimizationConfig)
  const setPendingOptimizationConfig = useAppStore((s) => s.setPendingOptimizationConfig)

  useEffect(() => {
    if (strategies.length === 0 || searchSpaceInitialized.current) return
    const pool = strategies.filter((entry) => strategyEngine(entry) === engine)
    const info = pool.find((entry) => entry.name === strategy) ?? pool[0]
    if (!info) return
    if (!pool.some((entry) => entry.name === strategy)) {
      setStrategy(info.name)
    }
    setStrategySearchSpace(defaultSearchSpaceFromSpecs(info.params))
    searchSpaceInitialized.current = true
  }, [strategies, strategy, engine])

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
    setMaxWorkersInput(hydrated.maxWorkersInput)
    setStrategy(hydrated.strategy)
    setStrategySearchSpace(hydrated.strategySearchSpace)
    setRiskMode(hydrated.riskMode)
    setQtyLow(hydrated.qtyLow)
    setQtyHigh(hydrated.qtyHigh)
    setMarginLow(hydrated.marginLow)
    setMarginHigh(hydrated.marginHigh)
    setMinContractsLow(hydrated.minContractsLow)
    setMinContractsHigh(hydrated.minContractsHigh)
    setTargetVolLow(hydrated.targetVolLow)
    setTargetVolHigh(hydrated.targetVolHigh)
    setInverseMinContractsLow(hydrated.inverseMinContractsLow)
    setInverseMinContractsHigh(hydrated.inverseMinContractsHigh)
    setInverseMaxContractsInput(hydrated.inverseMaxContractsInput)
    setCostFields(hydrated.costFields)
    setDayTrade(hydrated.dayTrade)
    setDayTradeStartTime(hydrated.dayTradeStartTime)
    setDayTradeEndTime(hydrated.dayTradeEndTime)
    setDayTradeCloseTime(hydrated.dayTradeCloseTime)
    setEngine(hydrated.engine)
    setDisplayTimeframe(hydrated.displayTimeframe)
    setTickFlags(hydrated.tickFlags)
    searchSpaceInitialized.current = true

    setPendingOptimizationConfig(null)
  }, [pendingOptimizationConfig, setPendingOptimizationConfig, strategies])

  const handleEngineChange = (nextEngine: OptimizeEngine) => {
    setEngine(nextEngine)
    const pool = strategies.filter((entry) => strategyEngine(entry) === nextEngine)
    if (pool.length === 0) return
    const currentValid = pool.some((entry) => entry.name === strategy)
    if (!currentValid) {
      const next = pool[0]
      setStrategy(next.name)
      setStrategySearchSpace(defaultSearchSpaceFromSpecs(next.params))
    }
  }

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
  const costValidation = useMemo(() => validateTransactionCosts(costFields), [costFields])

  const rangesInvalid =
    (riskMode === 'fixed_quantity'
      ? qtyLow > qtyHigh
      : riskMode === 'fixed_safety_margin'
        ? marginLow > marginHigh || minContractsLow > minContractsHigh
        : targetVolLow > targetVolHigh || inverseMinContractsLow > inverseMinContractsHigh) ||
    !validateSearchSpace(strategySearchSpace)
  const formInvalid =
    dateRangeInvalid ||
    rangesInvalid ||
    nTrials < 1 ||
    !costValidation.valid ||
    isMaxWorkersInputInvalid(maxWorkersInput)

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
        : riskMode === 'fixed_safety_margin'
          ? {
              type: { type: 'categorical', choices: ['fixed_safety_margin'] },
              safety_margin_per_contract: { type: 'log-float', low: marginLow, high: marginHigh },
              min_contracts: { type: 'int', low: minContractsLow, high: minContractsHigh },
            }
          : {
              type: { type: 'categorical', choices: ['inverse_volatility'] },
              target_volatility_pct: { type: 'float', low: targetVolLow, high: targetVolHigh },
              min_contracts: {
                type: 'int',
                low: inverseMinContractsLow,
                high: inverseMinContractsHigh,
              },
              ...(inverseMaxContractsInput.trim() !== ''
                ? {
                    max_contracts: {
                      type: 'int',
                      low: Number(inverseMaxContractsInput),
                      high: Number(inverseMaxContractsInput),
                    },
                  }
                : {}),
            }

    const costs = buildCostsPayload(costFields)

    onSubmit({
      study: withMaxWorkers(
        {
          name: `${symbol}_${objective}_${Date.now()}`,
          n_trials: nTrials,
          seed,
          pruner,
          continue_on_trial_error: continueOnTrialError,
          sampler: isMultiObjective ? 'nsgaii' : sampler,
        },
        maxWorkersInput,
      ),
      objective: { mode: objective },
      backtest: {
        symbol,
        ...(engine === 'candle' ? { timeframe } : {}),
        start: startOfDay(startDate).toISOString(),
        end: endOfDay(endDate).toISOString(),
        initial_capital: capital,
        point_value: pointValue,
        strategy,
        ...(costs ? { costs } : {}),
        day_trade: dayTrade,
        day_trade_start_time: dayTradeStartTime,
        day_trade_end_time: dayTradeEndTime,
        day_trade_close_time: dayTradeCloseTime,
        ...(engine === 'tick'
          ? {
              engine: 'tick' as const,
              display_timeframe: displayTimeframe,
              tick_flags: tickFlags,
            }
          : {}),
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
            strategies={filteredStrategies}
            strategiesLoading={strategiesLoading}
            strategy={strategy}
            onStrategyChange={handleStrategyChange}
            engine={engine}
            onEngineChange={handleEngineChange}
            displayTimeframe={displayTimeframe}
            onDisplayTimeframeChange={setDisplayTimeframe}
            tickFlags={tickFlags}
            onTickFlagsChange={setTickFlags}
            displayTimeframeOptions={DISPLAY_TIMEFRAME_OPTIONS}
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
            dayTrade={dayTrade}
            setDayTrade={setDayTrade}
            dayTradeStartTime={dayTradeStartTime}
            setDayTradeStartTime={setDayTradeStartTime}
            dayTradeEndTime={dayTradeEndTime}
            setDayTradeEndTime={setDayTradeEndTime}
            dayTradeCloseTime={dayTradeCloseTime}
            setDayTradeCloseTime={setDayTradeCloseTime}
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
            targetVolLow={targetVolLow}
            targetVolHigh={targetVolHigh}
            setTargetVolLow={setTargetVolLow}
            setTargetVolHigh={setTargetVolHigh}
            inverseMinContractsLow={inverseMinContractsLow}
            inverseMinContractsHigh={inverseMinContractsHigh}
            setInverseMinContractsLow={setInverseMinContractsLow}
            setInverseMinContractsHigh={setInverseMinContractsHigh}
            inverseMaxContractsInput={inverseMaxContractsInput}
            setInverseMaxContractsInput={setInverseMaxContractsInput}
            costPerContract={costFields.costPerContract}
            setCostPerContract={(value) =>
              setCostFields((current) => ({ ...current, costPerContract: value }))
            }
            costBps={costFields.costBps}
            setCostBps={(value) => setCostFields((current) => ({ ...current, costBps: value }))}
            costErrors={costValidation.errors}
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
            maxWorkersInput={maxWorkersInput}
            onMaxWorkersInputChange={setMaxWorkersInput}
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
