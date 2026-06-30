import { endOfDay, startOfDay } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, Loader2, Play, RefreshCw, ArrowRightCircle } from 'lucide-react'

import { useAlphaResearchRun, useStartAlphaResearch } from '@/api/queries/experiments'
import { DateRangePresetsFields } from '@/components/shared/InstrumentConfigFields'
import { Button } from '@/components/ui/button'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatTile } from '@/components/ui/StatTile'
import { defaultBacktestStart, defaultBacktestEnd } from '@/lib/backtesting/dateRange'
import {
  acceptanceEvidenceRows,
  ALPHA_RESEARCH_PROFILES,
  ALPHA_RESEARCH_VERDICT_CLASS,
  ALPHA_RESEARCH_VERDICT_LABEL,
  buildBacktestRequestFromAlphaResult,
  buildOptimizationConfigFromAlphaResult,
  criterionStatusClass,
  formatCriterionValue,
  formatNullableNumber,
  getAlphaResearchProfile,
  hasRenderableAcceptanceEvidence,
  orderedPipelineStages,
  PIPELINE_STAGE_LABELS,
  progressPercent,
  stageStatusClass,
} from '@/lib/research/alphaResearch'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type {
  AlphaResearchProfileId,
  AlphaResearchRequest,
  AlphaResearchResult,
} from '@/types/experiments'

type AlphaResearchPanelProps = {
  isActive?: boolean
}

const DEFAULT_TRIALS = 30
const DEFAULT_SEEDS = 5

export function AlphaResearchPanel({ isActive = true }: AlphaResearchPanelProps) {
  const navigate = useNavigate()
  const setPendingBacktestConfig = useAppStore((s) => s.setPendingBacktestConfig)
  const setPendingOptimizationConfig = useAppStore((s) => s.setPendingOptimizationConfig)
  const patchBacktestSession = useAppStore((s) => s.patchBacktestSession)
  const patchOptimizeSession = useAppStore((s) => s.patchOptimizeSession)

  const [profileId, setProfileId] = useState<AlphaResearchProfileId>('ccm_h1_swing')
  const [startDate, setStartDate] = useState(defaultBacktestStart)
  const [endDate, setEndDate] = useState(defaultBacktestEnd)
  const [studyTrials, setStudyTrials] = useState(DEFAULT_TRIALS)
  const [optimizationSeeds, setOptimizationSeeds] = useState(DEFAULT_SEEDS)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const profile = useMemo(() => getAlphaResearchProfile(profileId), [profileId])
  const startMutation = useStartAlphaResearch()
  const runQuery = useAlphaResearchRun(activeJobId, { enabled: isActive })

  const jobStatus = runQuery.data?.status
  const isRunning = startMutation.isPending || jobStatus === 'queued' || jobStatus === 'running'
  const result = runQuery.data?.result ?? null
  const liveStages = runQuery.data?.stages ?? result?.stages
  const pipelineStages = orderedPipelineStages(liveStages)

  useEffect(() => {
    if (jobStatus === 'failed' && runQuery.data?.error) {
      setErrorMsg(runQuery.data.error)
    }
    if (jobStatus === 'cancelled' && runQuery.data?.detail) {
      setErrorMsg(runQuery.data.detail)
    }
  }, [jobStatus, runQuery.data?.detail, runQuery.data?.error])

  const handleLaunch = async () => {
    setErrorMsg(null)
    const request: AlphaResearchRequest = {
      profile_id: profileId,
      start: startOfDay(startDate).toISOString(),
      end: endOfDay(endDate).toISOString(),
      target_name: 'fwd_return',
      compute_budget: {
        study_n_trials: Math.min(200, Math.max(1, studyTrials)),
        optimization_seeds: Math.min(16, Math.max(1, optimizationSeeds)),
      },
    }

    try {
      const started = await startMutation.mutateAsync(request)
      setActiveJobId(started.job_id)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail
        setErrorMsg(typeof detail === 'string' ? detail : 'Failed to start alpha-research run.')
      } else {
        setErrorMsg('Failed to start alpha-research run.')
      }
    }
  }

  const handleReset = () => {
    setActiveJobId(null)
    setErrorMsg(null)
  }

  const handlePromoteBacktest = (completed: AlphaResearchResult) => {
    const request = buildBacktestRequestFromAlphaResult(completed)
    if (!request) return
    setPendingBacktestConfig(request)
    patchBacktestSession({
      workflowMode: 'backtest',
      focus: 'setup',
      rightPanelTab: 'results',
    })
    void navigate({ to: '/backtests' })
  }

  const handlePromoteOptimize = (completed: AlphaResearchResult) => {
    const config = buildOptimizationConfigFromAlphaResult(completed)
    if (!config) return
    setPendingOptimizationConfig(config)
    patchBacktestSession({ workflowMode: 'optimize' })
    patchOptimizeSession({
      focus: 'setup',
      rightPanelTab: 'results',
    })
    void navigate({ to: '/backtests', search: { mode: 'optimize' } })
  }

  const canPromote =
    result?.verdict === 'ready_for_paper' &&
    Boolean(result.champion?.best_params) &&
    jobStatus === 'completed'

  return (
    <div className="flex h-full min-h-0 flex-col gap-4" data-testid="alpha-research-panel">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <Panel className="flex flex-col gap-4 overflow-y-auto p-4">
          <SectionHeader title="Alpha Research" />
          <p className="text-silver-400 -mt-2 text-xs">
            Launch a profile-scoped evidence funnel with immutable acceptance thresholds.
          </p>

          <LabeledField label="Profile">
            <select
              aria-label="Profile"
              data-testid="alpha-profile-select"
              className="border-carbon-600/50 bg-carbon-900/60 text-silver-100 w-full rounded-md border px-3 py-2 text-sm"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value as AlphaResearchProfileId)}
              disabled={isRunning}
            >
              {ALPHA_RESEARCH_PROFILES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </LabeledField>

          <DateRangePresetsFields
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
            symbol={profile.symbol}
            timeframe={profile.timeframe}
          />

          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="Study trials">
              <NumberInput
                aria-label="Study trials"
                data-testid="alpha-study-trials"
                value={studyTrials}
                onChange={setStudyTrials}
                min={1}
                max={200}
                disabled={isRunning}
              />
            </LabeledField>
            <LabeledField label="Optimization seeds">
              <NumberInput
                aria-label="Optimization seeds"
                data-testid="alpha-optimization-seeds"
                value={optimizationSeeds}
                onChange={setOptimizationSeeds}
                min={1}
                max={16}
                disabled={isRunning}
              />
            </LabeledField>
          </div>

          <div
            className="border-carbon-600/40 bg-carbon-950/40 rounded-md border p-3 text-xs"
            data-testid="alpha-profile-thresholds"
          >
            <p className="text-silver-400 mb-2 font-medium tracking-wide uppercase">
              Acceptance thresholds (read-only)
            </p>
            <dl className="text-silver-300 grid grid-cols-2 gap-x-3 gap-y-1">
              <dt>Instrument</dt>
              <dd>
                {profile.symbol} {profile.timeframe}
              </dd>
              <dt>Min OOS windows</dt>
              <dd>{profile.thresholds.minOosWindows}</dd>
              <dt>Min stitched OOS trades</dt>
              <dd>{profile.thresholds.minStitchedOosTrades}</dd>
              <dt>Optimization seeds</dt>
              <dd>{profile.thresholds.optimizationSeeds}</dd>
              <dt>Min positive seeds</dt>
              <dd>{profile.thresholds.minPositiveSeedOutcomes}</dd>
              <dt>Min DSR</dt>
              <dd>{profile.thresholds.minDsr}</dd>
              <dt>Lock-box min trades</dt>
              <dd>{profile.thresholds.lockboxMinTrades}</dd>
              {profile.thresholds.lockboxMaxDrawdownPct != null ? (
                <>
                  <dt>Lock-box max drawdown</dt>
                  <dd>{(profile.thresholds.lockboxMaxDrawdownPct * 100).toFixed(0)}%</dd>
                </>
              ) : null}
            </dl>
          </div>

          <div className="flex gap-2">
            <Button
              data-testid="alpha-submit-btn"
              onClick={() => void handleLaunch()}
              disabled={isRunning}
              className="flex-1"
            >
              {isRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {isRunning ? 'Running…' : 'Launch experiment'}
            </Button>
            {activeJobId ? (
              <Button variant="outline" onClick={handleReset} disabled={isRunning}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          {!activeJobId && !errorMsg ? (
            <div
              className="text-silver-400 flex flex-1 flex-col items-center justify-center gap-2 text-center"
              data-testid="alpha-empty-state"
            >
              <ArrowRightCircle className="text-silver-500 h-10 w-10" />
              <p className="text-sm">Select a profile and launch an alpha-research experiment.</p>
              <p className="text-silver-500 max-w-md text-xs">
                Results render the full evidence funnel: feature admission, hypothesis eligibility,
                repeated seeds, plateau, DSR, and lock-box holdout.
              </p>
            </div>
          ) : null}

          {errorMsg ? (
            <div
              className="mb-4 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300"
              data-testid="alpha-error-state"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Experiment did not complete</p>
                <p>{errorMsg}</p>
                {runQuery.data?.checkpoint ? (
                  <p className="text-silver-400 mt-2 text-xs">
                    Checkpoint: {JSON.stringify(runQuery.data.checkpoint)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {isRunning ? (
            <div className="flex flex-col gap-4" data-testid="alpha-running-state">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="text-brass-400 h-4 w-4 animate-spin" />
                <span className="text-silver-200">
                  {runQuery.data?.detail ?? 'Running alpha-research pipeline…'}
                </span>
                <span className="text-silver-500 ml-auto">
                  {progressPercent(runQuery.data?.progress)}%
                </span>
              </div>
              <div className="bg-carbon-800/60 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-brass-500 h-full transition-all duration-300"
                  style={{ width: `${progressPercent(runQuery.data?.progress)}%` }}
                />
              </div>
              <PipelineStages stages={pipelineStages} />
            </div>
          ) : null}

          {result && jobStatus === 'completed' ? (
            <AlphaResearchResults
              result={result}
              canPromote={canPromote}
              onPromoteBacktest={() => handlePromoteBacktest(result)}
              onPromoteOptimize={() => handlePromoteOptimize(result)}
            />
          ) : null}
        </Panel>
      </div>
    </div>
  )
}

function PipelineStages({ stages }: { stages: ReturnType<typeof orderedPipelineStages> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="alpha-pipeline-stages">
      {stages.map((stage) => (
        <div
          key={stage.name}
          className={cn('rounded-md border px-3 py-2 text-xs', stageStatusClass(stage.status))}
        >
          <p className="font-medium">{PIPELINE_STAGE_LABELS[stage.name]}</p>
          {stage.detail ? <p className="text-silver-400 mt-1">{stage.detail}</p> : null}
        </div>
      ))}
    </div>
  )
}

function AlphaResearchResults({
  result,
  canPromote,
  onPromoteBacktest,
  onPromoteOptimize,
}: {
  result: AlphaResearchResult
  canPromote: boolean
  onPromoteBacktest: () => void
  onPromoteOptimize: () => void
}) {
  const criteria = acceptanceEvidenceRows(result.acceptance)
  const seeds = result.acceptance?.seeds ?? []
  const plateau = result.acceptance?.plateau
  const lockbox = result.acceptance?.lockbox_metrics
  const pipelineStages = orderedPipelineStages(result.stages)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto" data-testid="alpha-results">
      <div className="flex flex-wrap items-center gap-3">
        <span
          data-testid="alpha-verdict-badge"
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase',
            ALPHA_RESEARCH_VERDICT_CLASS[result.verdict],
          )}
        >
          {ALPHA_RESEARCH_VERDICT_LABEL[result.verdict]}
        </span>
        <span className="text-silver-400 text-xs">
          Profile {result.profile_id} · {String(result.coverage.bar_count ?? '—')} bars
        </span>
        {canPromote ? (
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              data-testid="alpha-promote-backtest"
              onClick={onPromoteBacktest}
            >
              Open in Backtest
            </Button>
            <Button size="sm" data-testid="alpha-promote-optimize" onClick={onPromoteOptimize}>
              Open in Optimize
            </Button>
          </div>
        ) : null}
      </div>

      {result.inconclusive_reasons.length > 0 ? (
        <div
          className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
          data-testid="alpha-inconclusive-reasons"
        >
          <p className="mb-1 font-medium">Inconclusive reasons</p>
          <ul className="list-disc pl-5">
            {result.inconclusive_reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <PipelineStages stages={pipelineStages} />

      <SectionHeader title="Feature evidence" />
      <EvidenceTable
        testId="alpha-feature-evidence"
        headers={['Feature', 'Decision', 'Deflated score', 'N obs']}
        rows={result.feature_evidence_summary.map((row) => [
          row.feature_name,
          row.decision,
          formatNullableNumber(row.deflated_score ?? null),
          row.n_obs != null ? String(row.n_obs) : '—',
        ])}
        emptyLabel="No feature evidence rows returned."
      />

      <SectionHeader title="Hypothesis manifest" />
      <EvidenceTable
        testId="alpha-hypothesis-manifest"
        headers={['Candidate', 'Hypothesis', 'Required features', 'Nodes']}
        rows={result.hypothesis_manifest.map((row) => [
          row.candidate_id,
          row.hypothesis_id ?? '—',
          row.hypothesis_required_features?.join(', ') ?? '—',
          row.genome_node_count != null ? String(row.genome_node_count) : '—',
        ])}
        emptyLabel="No hypotheses admitted."
      />

      {hasRenderableAcceptanceEvidence(result) ? (
        <>
          <SectionHeader title="Acceptance criteria" />
          <div className="overflow-x-auto" data-testid="alpha-acceptance-criteria">
            <table className="text-silver-200 w-full min-w-[640px] text-left text-xs">
              <thead className="text-silver-400 border-carbon-600/40 border-b">
                <tr>
                  <th className="px-2 py-2">Criterion</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Observed</th>
                  <th className="px-2 py-2">Threshold</th>
                  <th className="px-2 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((row) => (
                  <tr key={row.name} className="border-carbon-600/30 border-t">
                    <td className="px-2 py-2 font-medium">{row.name}</td>
                    <td className={cn('px-2 py-2 uppercase', criterionStatusClass(row.status))}>
                      {row.status}
                    </td>
                    <td className="px-2 py-2">{formatCriterionValue(row.observed)}</td>
                    <td className="px-2 py-2">{formatCriterionValue(row.threshold)}</td>
                    <td className="text-silver-400 px-2 py-2">{row.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionHeader title="Repeated seeds" />
          <EvidenceTable
            testId="alpha-seed-rows"
            headers={['Seed', 'Status', 'Objective', 'Windows', 'Failure']}
            rows={seeds.map((seed) => [
              String(seed.seed),
              seed.status,
              formatNullableNumber(seed.objective_value ?? null),
              `${seed.completed_windows ?? 0}/${seed.window_count ?? 0}`,
              seed.failure_reason ?? '—',
            ])}
            emptyLabel="No seed evaluations recorded."
          />

          {plateau ? (
            <div data-testid="alpha-plateau-summary">
              <SectionHeader title="Parameter plateau" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="Neighbors evaluated"
                  value={String(plateau.neighbors_evaluated ?? '—')}
                />
                <StatTile
                  label="Profitable fraction"
                  value={formatNullableNumber(plateau.profitable_fraction ?? null)}
                />
                <StatTile
                  label="Score retention"
                  value={formatNullableNumber(plateau.score_retention ?? null)}
                />
                <StatTile
                  label="Champion objective"
                  value={formatNullableNumber(plateau.champion_objective ?? null)}
                />
              </div>
            </div>
          ) : null}

          <SectionHeader title="DSR & lock-box" />
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            data-testid="alpha-lockbox-stats"
          >
            <StatTile
              label="DSR"
              value={formatNullableNumber(result.acceptance?.dsr_value ?? null)}
            />
            <StatTile
              label="Lock-box return"
              value={formatNullableNumber(
                typeof lockbox?.total_return_pct === 'number' ? lockbox.total_return_pct : null,
              )}
            />
            <StatTile
              label="Lock-box Sharpe"
              value={formatNullableNumber(
                typeof lockbox?.sharpe_ratio === 'number' ? lockbox.sharpe_ratio : null,
              )}
            />
            <StatTile
              label="Lock-box trades"
              value={lockbox?.total_trades != null ? String(lockbox.total_trades) : '—'}
            />
          </div>
        </>
      ) : (
        <div
          className="text-silver-400 border-carbon-600/40 rounded-md border p-4 text-sm"
          data-testid="alpha-evidence-unavailable"
        >
          Acceptance evidence is unavailable for this run. Review inconclusive reasons and pipeline
          stages above.
        </div>
      )}

      {result.champion ? (
        <div data-testid="alpha-champion-card">
          <SectionHeader title="Frozen champion" />
          <div className="border-carbon-600/40 bg-carbon-950/30 rounded-md border p-3 text-xs">
            <p className="text-silver-200 font-medium">{result.champion.candidate_id}</p>
            <p className="text-silver-400 mt-1">
              Champion seed {result.champion.champion_seed ?? '—'}
            </p>
            {result.champion.genome ? (
              <pre className="text-silver-400 mt-2 max-h-40 overflow-auto rounded bg-black/20 p-2">
                {JSON.stringify(result.champion.genome, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="text-silver-500 border-carbon-600/30 border-t pt-3 text-[11px]">
        <p data-testid="alpha-provenance">
          Manifest {String(result.provenance.split_manifest_hash ?? '—')} · Seeds{' '}
          {Array.isArray(result.provenance.optimization_seeds)
            ? (result.provenance.optimization_seeds as number[]).join(', ')
            : '—'}{' '}
          · Backend {String(result.provenance.backend_version ?? '—')}
        </p>
      </div>
    </div>
  )
}

function EvidenceTable({
  testId,
  headers,
  rows,
  emptyLabel,
}: {
  testId: string
  headers: string[]
  rows: string[][]
  emptyLabel: string
}) {
  if (rows.length === 0) {
    return (
      <p className="text-silver-500 text-xs" data-testid={`${testId}-empty`}>
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto" data-testid={testId}>
      <table className="text-silver-200 w-full min-w-[480px] text-left text-xs">
        <thead className="text-silver-400 border-carbon-600/40 border-b">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-2 py-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${testId}-${index}`} className="border-carbon-600/30 border-t">
              {row.map((cell, cellIndex) => (
                <td key={`${testId}-${index}-${cellIndex}`} className="px-2 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
