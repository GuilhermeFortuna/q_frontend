import { endOfDay, startOfDay } from 'date-fns'
import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  Loader2,
  Play,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react'

import { useStartEncoderAblation, useEncoderAblationRun } from '@/api/queries/experiments'
import { DateRangePresetsFields, inputClass } from '@/components/shared/InstrumentConfigFields'
import { Button } from '@/components/ui/button'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type { EncoderConfigSpec } from '@/types/experiments'
import { defaultNeuralTrainStart, defaultNeuralTrainEnd } from '@/lib/backtesting/dateRange'

type FormConfigSpec = {
  id: string
  label: string
  encoder_kind: 'pca' | 'ae'
}

function formatAblationProgress(progress: string | null | undefined): string {
  if (!progress) return 'Preparing encoder configs...'
  if (progress.includes('/')) {
    const [done, total] = progress.split('/')
    return `Configs complete: ${done} / ${total}`
  }
  return progress.replace(/_/g, ' ')
}

export function EncoderAblationPanel() {
  const [symbol, setSymbol] = useState('CCM$')
  const [timeframe, setTimeframe] = useState('H1')
  const [target, setTarget] = useState('fwd_return')
  const [horizon, setHorizon] = useState(5)
  const [startDate, setStartDate] = useState(defaultNeuralTrainStart)
  const [endDate, setEndDate] = useState(defaultNeuralTrainEnd)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [configs, setConfigs] = useState<FormConfigSpec[]>([
    { id: '1', label: 'PCA Linear Baseline', encoder_kind: 'pca' },
    { id: '2', label: 'AE Default Nonlinear', encoder_kind: 'ae' },
  ])

  const startMutation = useStartEncoderAblation()
  const runQuery = useEncoderAblationRun(activeJobId)

  const jobStatus = runQuery.data?.status
  const isRunning = startMutation.isPending || jobStatus === 'queued' || jobStatus === 'running'

  useEffect(() => {
    if (jobStatus === 'failed' && runQuery.data?.error) {
      setErrorMsg(runQuery.data.error)
    }
  }, [jobStatus, runQuery.data?.error])

  const addConfig = () => {
    const id = Math.random().toString(36).slice(2, 9)
    setConfigs((current) => [
      ...current,
      { id, label: `Config ${current.length + 1}`, encoder_kind: 'ae' },
    ])
  }

  const removeConfig = (id: string) => {
    setConfigs((current) => current.filter((c) => c.id !== id))
  }

  const updateConfig = (id: string, patch: Partial<FormConfigSpec>) => {
    setConfigs((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const handleLaunch = async () => {
    setErrorMsg(null)
    const configSpecs: EncoderConfigSpec[] = configs.map((c) => ({
      label: c.label,
      encoder_kind: c.encoder_kind,
      hyperparams: {},
    }))

    try {
      const res = await startMutation.mutateAsync({
        symbol,
        timeframe,
        target,
        horizon,
        train_start: startOfDay(startDate).toISOString(),
        train_end: endOfDay(endDate).toISOString(),
        n_latents: 2,
        input_features: ['rsi', 'ma', 'macd', 'realized_vol'],
        configs: configSpecs,
      })
      setActiveJobId(res.job_id)
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? ((err.response?.data as { detail?: string })?.detail ?? err.message)
        : err instanceof Error
          ? err.message
          : 'Failed to start Encoder Ablation Job'
      setErrorMsg(message)
    }
  }

  const handleReset = () => {
    setActiveJobId(null)
    setErrorMsg(null)
    startMutation.reset()
  }

  const result = runQuery.data?.result

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row"
      data-testid="encoder-ablation-panel"
    >
      {/* Parameters & Configuration Column */}
      <Panel className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto p-4 lg:w-80">
        <SectionHeader title="Encoder Ablation" />
        <p className="text-silver-400 text-sm">
          Run head-to-head encoder ablation trials. Compare linear PCA baselines against nonlinear
          autoencoders.
        </p>

        <div className="mt-2 flex flex-col gap-4">
          <LabeledField label="Symbol" htmlFor="ablation-symbol">
            <input
              id="ablation-symbol"
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className={inputClass}
              disabled={isRunning}
            />
          </LabeledField>

          <LabeledField label="Timeframe" htmlFor="ablation-timeframe">
            <select
              id="ablation-timeframe"
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

          <div className="grid grid-cols-2 gap-2">
            <LabeledField label="Target" htmlFor="ablation-target">
              <input
                id="ablation-target"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={inputClass}
                disabled={isRunning}
              />
            </LabeledField>

            <LabeledField label="Horizon" htmlFor="ablation-horizon">
              <NumberInput
                id="ablation-horizon"
                value={horizon}
                onChange={setHorizon}
                min="1"
                disabled={isRunning}
              />
            </LabeledField>
          </div>

          {/* Config List Builder */}
          <div className="border-carbon-700/60 mt-2 space-y-2 border-t pt-2">
            <div className="flex items-center justify-between">
              <label className="text-silver-400 text-xs font-semibold tracking-wider uppercase">
                Configurations
              </label>
              <button
                type="button"
                onClick={addConfig}
                disabled={isRunning || configs.length >= 8}
                className="text-brass-400 hover:text-brass-300 flex cursor-pointer items-center gap-1 text-[10px] font-bold transition-colors disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Config
              </button>
            </div>

            <div className="space-y-3">
              {configs.map((c, idx) => (
                <div
                  key={c.id}
                  className="bg-carbon-900/50 border-carbon-700/50 relative space-y-2 rounded-lg border p-3"
                >
                  {configs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeConfig(c.id)}
                      disabled={isRunning}
                      className="text-silver-500 absolute top-2 right-2 cursor-pointer transition-colors hover:text-rose-400"
                      aria-label={`Remove configuration ${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <input
                    type="text"
                    value={c.label}
                    onChange={(e) => updateConfig(c.id, { label: e.target.value })}
                    className="text-silver-100 hover:border-carbon-600 focus:border-brass-500 w-11/12 border-b border-transparent bg-transparent py-0.5 text-xs font-medium focus:outline-none"
                    placeholder="Config Name"
                    disabled={isRunning}
                    aria-label={`Configuration name ${idx + 1}`}
                  />

                  <select
                    value={c.encoder_kind}
                    onChange={(e) =>
                      updateConfig(c.id, { encoder_kind: e.target.value as 'pca' | 'ae' })
                    }
                    className="bg-carbon-950 border-carbon-750 text-silver-300 w-full rounded border px-2 py-1 text-xs focus:outline-none"
                    disabled={isRunning}
                    aria-label={`Configuration encoder type ${idx + 1}`}
                  >
                    <option value="pca">PCA (Linear Control)</option>
                    <option value="ae">Autoencoder (Nonlinear)</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="border-carbon-700/60 mt-4 flex flex-col gap-2 border-t pt-4">
            {!activeJobId ? (
              <Button
                variant="brass"
                onClick={handleLaunch}
                disabled={isRunning || configs.length === 0}
                className="flex w-full items-center justify-center gap-2"
                data-testid="ablation-submit-btn"
              >
                {startMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
                Launch Ablation
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isRunning}
                className="flex w-full items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                New Ablation Run
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {/* Output Panel */}
      <Panel living className="flex flex-1 flex-col overflow-hidden rounded-xl p-4 md:p-6">
        {!activeJobId && !errorMsg && (
          <div
            className="flex flex-1 flex-col items-center justify-center p-8 text-center"
            data-testid="ablation-empty-state"
          >
            <div className="border-carbon-600/40 bg-carbon-900/20 max-w-md rounded-2xl border border-dashed p-10 backdrop-blur-sm">
              <CheckCircle2 className="text-silver-400 mx-auto h-12 w-12 stroke-[1.25]" />
              <h3 className="text-silver-200 mt-4 text-base font-semibold">
                No active ablation study
              </h3>
              <p className="text-silver-400 mt-2 text-sm leading-relaxed">
                Add PCA or autoencoder configs on the left panel and click launch. We will train
                each model and evaluate their latent features against the IC gate.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            className="mb-4 flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 text-rose-300"
            data-testid="ablation-error-state"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold">Ablation Run Failed</h4>
              <p className="mt-1 text-xs leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {activeJobId && isRunning && (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-4 p-8"
            data-testid="ablation-running-state"
          >
            <Loader2 className="text-brass-500 h-8 w-8 animate-spin" />
            <div className="max-w-sm text-center">
              <h4 className="text-silver-200 text-sm font-semibold tracking-wider uppercase">
                Ablation Study Running
              </h4>
              <p className="text-silver-400 mt-1 text-xs leading-relaxed">
                {formatAblationProgress(runQuery.data?.progress)}
              </p>
            </div>
          </div>
        )}

        {result && (
          <div
            className="flex flex-1 flex-col gap-6 overflow-y-auto pr-1"
            data-testid="ablation-results"
          >
            {/* Header */}
            <div className="border-carbon-700/60 border-b pb-4">
              <h3 className="text-cream-100 font-mono text-base font-semibold tracking-wide">
                Ablation Comparison
              </h3>
              <p className="text-silver-400 mt-1 text-xs">
                Head-to-head comparison on target{' '}
                <span className="text-silver-300 font-mono">{result.target}</span> (horizon{' '}
                <span className="text-silver-300 font-mono">{result.horizon}</span>).
                {result.best_label && (
                  <span className="text-brass-400 ml-2 font-medium">
                    Best performer: <strong>{result.best_label}</strong>
                  </span>
                )}
              </p>
            </div>

            {/* Results Table */}
            <div className="border-carbon-700/60 bg-carbon-950/20 overflow-hidden rounded-xl border">
              <table
                className="w-full border-collapse text-left"
                data-testid="ablation-results-table"
              >
                <thead>
                  <tr className="bg-carbon-900/40 text-silver-400 border-carbon-700/60 border-b text-[10px] font-bold tracking-wider uppercase">
                    <th className="p-3 pl-4">Label</th>
                    <th className="p-3">Kind</th>
                    <th className="p-3 text-right">Recon R²</th>
                    <th className="p-3 text-right">Latent IC</th>
                    <th className="p-3 text-right">Baseline IC</th>
                    <th className="p-3 text-right">IC Delta</th>
                    <th className="p-3 pr-4 text-center">Gate Status</th>
                  </tr>
                </thead>
                <tbody className="divide-carbon-800/40 divide-y text-xs">
                  {result.rows.map((row, index) => {
                    const isBest = row.label === result.best_label
                    return (
                      <tr
                        key={index}
                        className={`hover:bg-carbon-900/20 transition-colors ${
                          isBest ? 'bg-brass-500/5 text-gold-400 font-semibold' : 'text-silver-200'
                        }`}
                      >
                        <td className="flex items-center gap-2 p-3 pl-4">
                          {row.label}
                          {isBest && (
                            <span className="border-brass-500/30 text-brass-400 bg-brass-500/10 rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase">
                              Best
                            </span>
                          )}
                        </td>
                        <td className="text-silver-400 p-3 font-mono text-[10px] uppercase">
                          {row.encoder_kind}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {row.recon_r2 !== undefined && row.recon_r2 !== null
                            ? row.recon_r2.toFixed(4)
                            : '—'}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {row.best_latent_ic !== undefined && row.best_latent_ic !== null
                            ? row.best_latent_ic.toFixed(4)
                            : '—'}
                        </td>
                        <td className="text-silver-400 p-3 text-right font-mono">
                          {row.baseline_ic !== undefined && row.baseline_ic !== null
                            ? row.baseline_ic.toFixed(4)
                            : '—'}
                        </td>
                        <td
                          className={`p-3 text-right font-mono ${
                            row.ic_delta_vs_baseline && row.ic_delta_vs_baseline > 0
                              ? 'text-emerald-400'
                              : row.ic_delta_vs_baseline && row.ic_delta_vs_baseline < 0
                                ? 'text-rose-400'
                                : 'text-silver-400'
                          }`}
                        >
                          {row.ic_delta_vs_baseline !== undefined &&
                          row.ic_delta_vs_baseline !== null
                            ? `${row.ic_delta_vs_baseline > 0 ? '+' : ''}${row.ic_delta_vs_baseline.toFixed(4)}`
                            : '—'}
                        </td>
                        <td className="p-3 pr-4 text-center">
                          {row.gate_error ? (
                            <span
                              className="cursor-help rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300"
                              title={row.gate_error}
                              data-testid={`ablation-gate-skipped-${index}`}
                            >
                              Gate Skipped
                            </span>
                          ) : row.passed ? (
                            <span
                              className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400"
                              data-testid={`ablation-gate-passed-${index}`}
                            >
                              <CheckCircle2 className="h-3 w-3" /> Passed
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-400"
                              data-testid={`ablation-gate-failed-${index}`}
                            >
                              <XCircle className="h-3 w-3" /> Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
