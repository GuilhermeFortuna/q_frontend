import { endOfDay, startOfDay } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Loader2, Play, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

import { useStartDiscoveryAb, useDiscoveryAbRun } from '@/api/queries/experiments'
import { DateRangePresetsFields, inputClass } from '@/components/shared/InstrumentConfigFields'
import { Button } from '@/components/ui/button'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatTile } from '@/components/ui/StatTile'
import { CHART_COLORS } from '@/components/backtests/chartUtils'
import { defaultBacktestStart, defaultBacktestEnd } from '@/lib/backtesting/dateRange'
import {
  DEFAULT_GATE_CONFIG,
  DEFAULT_GENETIC_CONFIG,
  DEFAULT_LOCKBOX_CONFIG,
  type StrategySearchConfig,
} from '@/types/strategySearch'

type VerdictType = 'helps' | 'no_effect' | 'hurts'

const verdictBadgeClass: Record<VerdictType, string> = {
  helps:
    'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_-3px_rgba(52,211,153,0.2)]',
  no_effect: 'border-silver-500/30 text-silver-400 bg-silver-500/10',
  hurts:
    'border-rose-500/30 text-rose-400 bg-rose-500/10 shadow-[0_0_12px_-3px_rgba(244,63,94,0.2)]',
}

const verdictLabel: Record<VerdictType, string> = {
  helps: 'PROVEN PAYOFF (HELPS)',
  no_effect: 'NO SIGNIFICANT EFFECT',
  hurts: 'NEGATIVE EFFECT (HURTS)',
}

function progressPercent(progress: number | undefined): number {
  if (progress == null) return 0
  return progress <= 1 ? Math.round(progress * 100) : Math.round(progress)
}

export function DiscoveryAbPanel() {
  const [symbol, setSymbol] = useState('CCM$')
  const [timeframe, setTimeframe] = useState('H1')
  const [startDate, setStartDate] = useState(defaultBacktestStart)
  const [endDate, setEndDate] = useState(defaultBacktestEnd)
  const [seedCount, setSeedCount] = useState(5)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const startMutation = useStartDiscoveryAb()
  const runQuery = useDiscoveryAbRun(activeJobId)

  const jobStatus = runQuery.data?.status
  const isRunning = startMutation.isPending || jobStatus === 'queued' || jobStatus === 'running'

  useEffect(() => {
    if (jobStatus === 'failed' && runQuery.data?.error) {
      setErrorMsg(runQuery.data.error)
    }
  }, [jobStatus, runQuery.data?.error])

  const handleLaunch = async () => {
    setErrorMsg(null)
    const seeds = Array.from({ length: Math.min(32, Math.max(1, seedCount)) }, (_, i) => 42 + i)

    const config: StrategySearchConfig = {
      backtest: {
        symbol,
        timeframe,
        start: startOfDay(startDate).toISOString(),
        end: endOfDay(endDate).toISOString(),
        initial_capital: 100_000,
        point_value: 1.0,
        strategy: 'CompositeStrategy',
        day_trade: false,
        day_trade_start_time: '09:00',
        day_trade_end_time: '16:00',
        day_trade_close_time: '17:00',
      },
      objective: {
        mode: 'maximize_return_drawdown',
      },
      walkforward: {
        mode: 'rolling',
        train_days: 180,
        test_days: 30,
        min_windows: 2,
      },
      study: {
        name: `${symbol}_discovery_ab_${Date.now()}`,
        n_trials: 30,
        sampler: 'tpe',
        seed: 42,
        pruner: 'none',
        continue_on_trial_error: false,
      },
      provider: 'genetic',
      genetic: DEFAULT_GENETIC_CONFIG,
      lockbox: DEFAULT_LOCKBOX_CONFIG,
      gates: DEFAULT_GATE_CONFIG,
      include_risk_search: false,
    }

    try {
      const res = await startMutation.mutateAsync({
        config,
        seeds,
      })
      setActiveJobId(res.job_id)
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? ((err.response?.data as { detail?: string })?.detail ?? err.message)
        : err instanceof Error
          ? err.message
          : 'Failed to start A/B Discovery Job'
      setErrorMsg(message)
    }
  }

  const handleReset = () => {
    setActiveJobId(null)
    setErrorMsg(null)
    startMutation.reset()
  }

  // Prepare chart data from completed results
  const chartData = useMemo(() => {
    if (!runQuery.data?.result) return []
    const result = runQuery.data.result
    return Array.from({ length: result.n_seeds }, (_, i) => {
      const controlVal = result.control.values[i] ?? 0
      const treatmentVal = result.treatment.values[i] ?? 0
      return {
        name: `Seed ${42 + i}`,
        Control: Number(controlVal.toFixed(4)),
        Treatment: Number(treatmentVal.toFixed(4)),
      }
    })
  }, [runQuery.data])

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row"
      data-testid="discovery-ab-panel"
    >
      {/* Configuration Column */}
      <Panel className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto p-4 lg:w-80">
        <SectionHeader title="Discovery A/B Harness" />
        <p className="text-silver-400 text-sm">
          Run head-to-head backtests with latents turned OFF (control) and ON (treatment) across
          multiple random seeds to evaluate latent features payoff.
        </p>

        <div className="mt-2 flex flex-col gap-4">
          <LabeledField label="Symbol" htmlFor="ab-symbol">
            <input
              id="ab-symbol"
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className={inputClass}
              disabled={isRunning}
            />
          </LabeledField>

          <LabeledField label="Timeframe" htmlFor="ab-timeframe">
            <select
              id="ab-timeframe"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className={inputClass}
              disabled={isRunning}
            >
              <option value="M1">1 Minute</option>
              <option value="M5">5 Minutes</option>
              <option value="M15">15 Minutes</option>
              <option value="H1">1 Hour</option>
              <option value="D1">1 Day</option>
            </select>
          </LabeledField>

          <DateRangePresetsFields
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            symbol={symbol}
            timeframe={timeframe}
          />

          <LabeledField label="Seeds to test (n_seeds)" htmlFor="ab-seeds">
            <NumberInput
              id="ab-seeds"
              value={seedCount}
              onChange={setSeedCount}
              min="1"
              max="32"
              disabled={isRunning}
            />
          </LabeledField>
          <p className="text-silver-500 -mt-2 text-xs">Evaluates 2 × N parallel runs (max 32).</p>

          <div className="border-carbon-700/60 mt-4 flex flex-col gap-2 border-t pt-4">
            {!activeJobId ? (
              <Button
                variant="brass"
                onClick={handleLaunch}
                disabled={isRunning || !symbol}
                className="flex w-full items-center justify-center gap-2"
                data-testid="ab-submit-btn"
              >
                {startMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
                Launch Harness
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isRunning}
                className="flex w-full items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                New Harness Run
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {/* Main Results Column */}
      <Panel living className="flex flex-1 flex-col overflow-hidden rounded-xl p-4 md:p-6">
        {/* Status / Output Display */}
        {!activeJobId && !errorMsg && (
          <div
            className="flex flex-1 flex-col items-center justify-center p-8 text-center"
            data-testid="ab-empty-state"
          >
            <div className="border-carbon-600/40 bg-carbon-900/20 max-w-md rounded-2xl border border-dashed p-10 backdrop-blur-sm">
              <CheckCircle2 className="text-silver-400 mx-auto h-12 w-12 stroke-[1.25]" />
              <h3 className="text-silver-200 mt-4 text-base font-semibold">
                No active harness run
              </h3>
              <p className="text-silver-400 mt-2 text-sm leading-relaxed">
                Configure your backtest parameters on the left pane and launch the harness. The A/B
                system will evaluate strategy search quality with and without neural latents.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            className="mb-4 flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 text-rose-300"
            data-testid="ab-error-state"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold">Execution Error</h4>
              <p className="mt-1 text-xs leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {activeJobId && isRunning && (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-4 p-8"
            data-testid="ab-running-state"
          >
            <Loader2 className="text-brass-500 h-8 w-8 animate-spin" />
            <div className="max-w-sm text-center">
              <h4 className="text-silver-200 text-sm font-semibold tracking-wider uppercase">
                Harness Job Running ({progressPercent(runQuery.data?.progress)}%)
              </h4>
              <p className="text-silver-400 mt-1 text-xs leading-relaxed">
                {runQuery.data?.detail ?? 'Dispatched child backtests to worker pool...'}
              </p>
              <div className="bg-carbon-700 mt-4 h-1 w-full overflow-hidden rounded-full">
                <div
                  className="bg-brass-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent(runQuery.data?.progress)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {runQuery.data?.result && (
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto pr-1" data-testid="ab-results">
            {/* Header & Verdict */}
            <div className="border-carbon-700/60 flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-cream-100 font-mono text-base font-semibold tracking-wide">
                  Experiment Verdict
                </h3>
                <p className="text-silver-400 mt-0.5 text-xs">
                  Metric evaluated:{' '}
                  <span className="text-silver-300 font-mono">{runQuery.data.result.metric}</span>
                </p>
              </div>

              <div
                className={`rounded-lg border px-4 py-2 text-xs font-bold tracking-wider ${verdictBadgeClass[runQuery.data.result.verdict]}`}
                data-testid="ab-verdict-badge"
              >
                {verdictLabel[runQuery.data.result.verdict]}
              </div>
            </div>

            {/* Stat tiles grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatTile label="Control Mean" value={runQuery.data.result.control.mean.toFixed(4)} />
              <StatTile
                label="Treatment Mean"
                value={runQuery.data.result.treatment.mean.toFixed(4)}
                highlight={runQuery.data.result.verdict === 'helps'}
              />
              <StatTile
                label="Paired Delta"
                value={`${runQuery.data.result.paired_delta.mean > 0 ? '+' : ''}${runQuery.data.result.paired_delta.mean.toFixed(4)}`}
                valueTone={
                  runQuery.data.result.paired_delta.mean > 0
                    ? 'up'
                    : runQuery.data.result.paired_delta.mean < 0
                      ? 'down'
                      : 'neutral'
                }
              />
              <StatTile
                label="Cohen's d"
                value={runQuery.data.result.paired_delta.cohens_d.toFixed(2)}
              />
              <StatTile
                label="p-value"
                value={runQuery.data.result.paired_delta.p_value.toFixed(4)}
                valueTone={runQuery.data.result.paired_delta.p_value < 0.05 ? 'up' : 'neutral'}
              />
            </div>

            {/* Chart zone */}
            <div className="border-carbon-600/40 bg-carbon-950/20 flex min-h-[320px] flex-1 flex-col rounded-xl border p-4 backdrop-blur-sm">
              <h4 className="text-silver-200 mb-4 text-xs font-semibold tracking-wider uppercase">
                Paired Performance comparison per Seed
              </h4>
              <div className="min-h-0 w-full flex-1 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: CHART_COLORS.grid }}
                    />
                    <YAxis
                      tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: CHART_COLORS.tooltipBg,
                        border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: CHART_COLORS.axis }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      wrapperStyle={{ fontSize: 11, color: CHART_COLORS.axis }}
                    />
                    <Bar dataKey="Control" fill={CHART_COLORS.reference} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Treatment" fill={CHART_COLORS.equity} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
