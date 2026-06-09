import { endOfDay, startOfDay } from 'date-fns'
import { useEffect, useState } from 'react'

import { OptimizeAdvancedSection } from '@/components/optimize/OptimizeAdvancedSection'
import { OptimizeRiskSection } from '@/components/optimize/OptimizeRiskSection'
import { OptimizeStrategySection } from '@/components/optimize/OptimizeStrategySection'
import { OptimizeStudySection } from '@/components/optimize/OptimizeStudySection'
import { Button } from '@/components/ui/button'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import { hydrateOptimizeFormFromConfig } from '@/lib/optimize/hydrateConfigForm'
import { useAppStore } from '@/store/useAppStore'
import type { MaType } from '@/lib/backtesting/maTypes'
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

  const [shortLow, setShortLow] = useState(5)
  const [shortHigh, setShortHigh] = useState(30)
  const [longLow, setLongLow] = useState(31)
  const [longHigh, setLongHigh] = useState(100)
  const [thresholdLow, setThresholdLow] = useState(0.0)
  const [thresholdHigh, setThresholdHigh] = useState(2.0)
  const [shortMaChoices, setShortMaChoices] = useState<MaType[]>(['sma'])
  const [longMaChoices, setLongMaChoices] = useState<MaType[]>(['sma'])

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

  const pendingOptimizationConfig = useAppStore((s) => s.pendingOptimizationConfig)
  const setPendingOptimizationConfig = useAppStore((s) => s.setPendingOptimizationConfig)

  useEffect(() => {
    if (!pendingOptimizationConfig) return
    const hydrated = hydrateOptimizeFormFromConfig(pendingOptimizationConfig)

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
    setShortLow(hydrated.shortLow)
    setShortHigh(hydrated.shortHigh)
    setLongLow(hydrated.longLow)
    setLongHigh(hydrated.longHigh)
    setThresholdLow(hydrated.thresholdLow)
    setThresholdHigh(hydrated.thresholdHigh)
    setShortMaChoices(hydrated.shortMaChoices)
    setLongMaChoices(hydrated.longMaChoices)
    setRiskMode(hydrated.riskMode)
    setQtyLow(hydrated.qtyLow)
    setQtyHigh(hydrated.qtyHigh)
    setMarginLow(hydrated.marginLow)
    setMarginHigh(hydrated.marginHigh)
    setMinContractsLow(hydrated.minContractsLow)
    setMinContractsHigh(hydrated.minContractsHigh)

    setPendingOptimizationConfig(null)
  }, [pendingOptimizationConfig, setPendingOptimizationConfig])

  const dateRangeInvalid = startDate >= endDate
  const rangesInvalid =
    shortLow > shortHigh ||
    longLow > longHigh ||
    thresholdLow > thresholdHigh ||
    (riskMode === 'fixed_quantity'
      ? qtyLow > qtyHigh
      : marginLow > marginHigh || minContractsLow > minContractsHigh)
  const maChoicesInvalid = shortMaChoices.length === 0 || longMaChoices.length === 0
  const formInvalid = dateRangeInvalid || rangesInvalid || maChoicesInvalid || nTrials < 1

  const isMultiObjective = objective === 'multi_objective_return_drawdown'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formInvalid || disabled) return

    const strategyParams: Record<string, SearchParam> = {
      short_period: { type: 'int', low: shortLow, high: shortHigh },
      long_period: { type: 'int', low: longLow, high: longHigh },
      threshold: { type: 'float', low: thresholdLow, high: thresholdHigh },
      short_ma_type: { type: 'categorical', choices: shortMaChoices },
      long_ma_type: { type: 'categorical', choices: longMaChoices },
    }

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
        strategy: 'MACrossover',
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
            shortLow={shortLow}
            shortHigh={shortHigh}
            setShortLow={setShortLow}
            setShortHigh={setShortHigh}
            longLow={longLow}
            longHigh={longHigh}
            setLongLow={setLongLow}
            setLongHigh={setLongHigh}
            thresholdLow={thresholdLow}
            thresholdHigh={thresholdHigh}
            setThresholdLow={setThresholdLow}
            setThresholdHigh={setThresholdHigh}
            shortMaChoices={shortMaChoices}
            setShortMaChoices={setShortMaChoices}
            longMaChoices={longMaChoices}
            setLongMaChoices={setLongMaChoices}
            maChoicesInvalid={maChoicesInvalid}
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
            disabled={loading || formInvalid || disabled}
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
