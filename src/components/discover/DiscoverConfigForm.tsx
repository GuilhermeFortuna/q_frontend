import { endOfDay, startOfDay } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'

import { useStrategies } from '@/api/queries/strategies'
import { DiscoverGatesSection } from '@/components/discover/DiscoverGatesSection'
import {
  DiscoverGeneticSection,
  SearchModeToggle,
  type SearchMode,
} from '@/components/discover/DiscoverGeneticSection'
import { OptimizeAdvancedSection } from '@/components/optimize/OptimizeAdvancedSection'
import { OptimizeStudySection } from '@/components/optimize/OptimizeStudySection'
import { FormSection } from '@/components/optimize/optimizeFormShared'
import { InstrumentConfigFields } from '@/components/shared/InstrumentConfigFields'
import { WalkForwardWindowsSection } from '@/components/walkforward/WalkForwardWindowsSection'
import { Button } from '@/components/ui/button'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import { estimateWalkForwardWindowCount } from '@/lib/walkforward/windowCount'
import { validateGeneticConfig, validateLockboxConfig } from '@/lib/discover/geneticConfigSchema'
import type { ObjectiveMode, Sampler } from '@/types/optimization'
import type { StrategyInfo } from '@/types/strategies'
import {
  DEFAULT_GATE_CONFIG,
  DEFAULT_GENETIC_CONFIG,
  DEFAULT_LOCKBOX_CONFIG,
  type GateConfig,
  type GeneticSearchConfig,
  type LockboxConfig,
  type StrategySearchConfig,
} from '@/types/strategySearch'
import type { WalkForwardMode } from '@/types/walkforward'

type DiscoverConfigFormProps = {
  loading: boolean
  error: string | null
  disabled?: boolean
  onSubmit: (body: StrategySearchConfig) => void
}

function allStrategies(strategies: StrategyInfo[]) {
  return strategies
}

export function DiscoverConfigForm({
  loading,
  error,
  disabled = false,
  onSubmit,
}: DiscoverConfigFormProps) {
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

  const [trainDays, setTrainDays] = useState(180)
  const [testDays, setTestDays] = useState(30)
  const [mode, setMode] = useState<WalkForwardMode>('rolling')
  const [minWindows, setMinWindows] = useState(2)

  const [objective, setObjective] = useState<ObjectiveMode>('maximize_return_drawdown')
  const [sampler, setSampler] = useState<Sampler>('tpe')
  const [nTrials, setNTrials] = useState(30)
  const [seed, setSeed] = useState(42)
  const [pruner, setPruner] = useState<'none' | 'median' | 'hyperband'>('none')
  const [continueOnTrialError, setContinueOnTrialError] = useState(false)

  const [selectedStrategies, setSelectedStrategies] = useState<Set<string>>(new Set())
  const [gates, setGates] = useState<GateConfig>(DEFAULT_GATE_CONFIG)
  const [searchMode, setSearchMode] = useState<SearchMode>('registry')
  const [genetic, setGenetic] = useState<GeneticSearchConfig>(DEFAULT_GENETIC_CONFIG)
  const [lockbox, setLockbox] = useState<LockboxConfig>(DEFAULT_LOCKBOX_CONFIG)

  const [instrumentOpen, setInstrumentOpen] = useState(true)
  const [strategiesOpen, setStrategiesOpen] = useState(true)
  const [geneticOpen, setGeneticOpen] = useState(true)
  const [lockboxOpen, setLockboxOpen] = useState(false)
  const [windowsOpen, setWindowsOpen] = useState(true)
  const [studyOpen, setStudyOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [gatesOpen, setGatesOpen] = useState(false)

  const { data: strategiesData, isLoading: strategiesLoading } = useStrategies()
  const strategies = useMemo(
    () => allStrategies(strategiesData?.strategies ?? []),
    [strategiesData?.strategies],
  )
  const candleStrategies = useMemo(
    () => strategies.filter((entry) => (entry.engine ?? 'candle') === 'candle'),
    [strategies],
  )

  useEffect(() => {
    if (candleStrategies.length === 0) return
    setSelectedStrategies((current) => {
      if (current.size > 0) return current
      return new Set(candleStrategies.map((entry) => entry.name))
    })
  }, [candleStrategies])

  const toggleStrategy = (name: string) => {
    setSelectedStrategies((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const selectAllCandle = () => {
    setSelectedStrategies(new Set(candleStrategies.map((entry) => entry.name)))
  }

  const dateRangeInvalid = startDate >= endDate
  const impliedWindows = estimateWalkForwardWindowCount(startDate, endDate, trainDays, testDays)
  const windowsTooFew = impliedWindows < minWindows
  const selectedCandleCount = candleStrategies.filter((entry) =>
    selectedStrategies.has(entry.name),
  ).length

  const isMultiObjective = objective === 'multi_objective_return_drawdown'
  const isGenetic = searchMode === 'genetic'
  const geneticError = isGenetic ? validateGeneticConfig(genetic) : null
  const lockboxError = isGenetic && lockbox.enabled ? validateLockboxConfig(lockbox) : null

  const formInvalid =
    dateRangeInvalid ||
    nTrials < 1 ||
    trainDays < 1 ||
    testDays < 1 ||
    minWindows < 1 ||
    windowsTooFew ||
    (!isGenetic && selectedCandleCount < 1) ||
    isMultiObjective ||
    geneticError != null ||
    lockboxError != null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formInvalid || disabled) return

    const allCandleSelected = selectedCandleCount === candleStrategies.length
    const strategyList = allCandleSelected
      ? null
      : candleStrategies
          .filter((entry) => selectedStrategies.has(entry.name))
          .map((entry) => entry.name)

    const body: StrategySearchConfig = {
      backtest: {
        symbol,
        timeframe,
        start: startOfDay(startDate).toISOString(),
        end: endOfDay(endDate).toISOString(),
        initial_capital: capital,
        point_value: pointValue,
        strategy: isGenetic ? 'CompositeStrategy' : (candleStrategies[0]?.name ?? 'MACrossover'),
        day_trade: dayTrade,
        day_trade_start_time: dayTradeStartTime,
        day_trade_end_time: dayTradeEndTime,
        day_trade_close_time: dayTradeCloseTime,
      },
      objective: { mode: objective },
      walkforward: {
        train_days: trainDays,
        test_days: testDays,
        mode,
        min_windows: minWindows,
      },
      study: {
        name: `${symbol}_discover_${Date.now()}`,
        n_trials: nTrials,
        seed,
        pruner,
        continue_on_trial_error: continueOnTrialError,
        sampler: isMultiObjective ? 'nsgaii' : sampler,
      },
      strategies: isGenetic ? null : strategyList,
      include_risk_search: true,
      gates,
    }

    if (isGenetic) {
      body.genetic = genetic
      if (lockbox.enabled) {
        body.lockbox = lockbox
      }
    }

    onSubmit(body)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 shrink-0">
        <h2 className="text-brass-400 text-xl font-bold">Discover</h2>
        <p className="text-silver-400 mt-1 text-xs">
          Automatic strategy search — sweep registered strategies or evolve novel genomes, ranked on
          out-of-sample performance.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-3" noValidate>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          <SearchModeToggle mode={searchMode} onChange={setSearchMode} />

          <FormSection
            title="Instrument & Range"
            open={instrumentOpen}
            onToggle={() => setInstrumentOpen((v) => !v)}
          >
            <InstrumentConfigFields
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
          </FormSection>

          {isGenetic ? (
            <DiscoverGeneticSection
              geneticOpen={geneticOpen}
              onToggleGenetic={() => setGeneticOpen((value) => !value)}
              lockboxOpen={lockboxOpen}
              onToggleLockbox={() => setLockboxOpen((value) => !value)}
              genetic={genetic}
              setGenetic={setGenetic}
              lockbox={lockbox}
              setLockbox={setLockbox}
              geneticError={geneticError}
              lockboxError={lockboxError}
            />
          ) : (
            <FormSection
              title="Strategies"
              open={strategiesOpen}
              onToggle={() => setStrategiesOpen((v) => !v)}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-silver-400 text-xs">
                  {selectedCandleCount} candle strateg{selectedCandleCount === 1 ? 'y' : 'ies'}{' '}
                  selected
                </p>
                <button
                  type="button"
                  className="text-brass-400 text-xs font-semibold hover:underline"
                  onClick={selectAllCandle}
                >
                  Select all candle
                </button>
              </div>
              <div className="border-carbon-600/40 max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {strategiesLoading ? (
                  <p className="text-silver-400 px-2 py-3 text-xs">Loading strategies…</p>
                ) : (
                  strategies.map((entry) => {
                    const isTick = (entry.engine ?? 'candle') === 'tick'
                    const checked = selectedStrategies.has(entry.name)
                    return (
                      <label
                        key={entry.name}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                          isTick
                            ? 'text-silver-500 cursor-not-allowed opacity-60'
                            : 'text-silver-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isTick}
                          onChange={() => toggleStrategy(entry.name)}
                          className="accent-brass-500 h-4 w-4 rounded"
                        />
                        <span className="min-w-0 flex-1 truncate">{entry.label || entry.name}</span>
                        {isTick ? (
                          <span className="text-silver-500 shrink-0 text-[10px] uppercase">
                            candle only
                          </span>
                        ) : null}
                      </label>
                    )
                  })
                )}
              </div>
              <p className="text-silver-400 mt-2 text-[11px] leading-normal">
                Will run{' '}
                <span className="text-brass-400 font-mono font-bold">{selectedCandleCount}</span>{' '}
                strateg{selectedCandleCount === 1 ? 'y' : 'ies'} ×{' '}
                <span className="text-brass-400 font-mono font-bold">{impliedWindows}</span> windows
                each.
              </p>
            </FormSection>
          )}

          {isGenetic ? (
            <p className="text-silver-400 px-1 text-[11px] leading-normal">
              Genetic mode evolves{' '}
              <span className="text-brass-400 font-mono">{genetic.population_size}</span> genomes ×{' '}
              <span className="text-brass-400 font-mono">{genetic.generations}</span> generations
              over <span className="text-brass-400 font-mono font-bold">{impliedWindows}</span>{' '}
              walk-forward windows each.
            </p>
          ) : null}

          <WalkForwardWindowsSection
            open={windowsOpen}
            onToggle={() => setWindowsOpen((v) => !v)}
            trainDays={trainDays}
            setTrainDays={setTrainDays}
            testDays={testDays}
            setTestDays={setTestDays}
            mode={mode}
            setMode={setMode}
            minWindows={minWindows}
            setMinWindows={setMinWindows}
            startDate={startDate}
            endDate={endDate}
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

          <DiscoverGatesSection
            open={gatesOpen}
            onToggle={() => setGatesOpen((v) => !v)}
            gates={gates}
            setGates={setGates}
          />
        </div>

        <div className="shrink-0 pt-2">
          <Button
            type="submit"
            disabled={loading || formInvalid || disabled || strategiesLoading}
            variant="brass"
            className="w-full"
          >
            {loading ? 'Starting...' : disabled ? 'Search in progress...' : 'Run Strategy Search'}
          </Button>

          {isMultiObjective ? (
            <p className="text-silver-400 mt-2 text-center text-xs">
              Strategy search requires a single-objective mode.
            </p>
          ) : null}

          {disabled && !loading ? (
            <p className="text-silver-400 mt-2 text-center text-xs">
              Wait for the current search to finish before starting another.
            </p>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs break-words text-rose-400">
              {error}
            </div>
          ) : null}
        </div>
      </form>
    </div>
  )
}
