import type { BacktestRequest } from '@/types/backtesting'
import type { OptimizationBacktestConfig, OptimizationConfig } from '@/types/optimization'
import type {
  AlphaResearchAcceptanceResult,
  AlphaResearchResult,
  AlphaResearchStageName,
  AlphaResearchStageStatus,
  AlphaResearchVerdict,
  AlphaResearchProfileId,
} from '@/types/experiments'
import type { CandidateResult, Genome, StrategySearchConfig } from '@/types/strategySearch'
import {
  buildBacktestRequestFromCandidate,
  buildOptimizationConfigFromCandidate,
} from '@/lib/discover/promoteCandidate'

export type AlphaResearchProfileOption = {
  id: AlphaResearchProfileId
  label: string
  symbol: string
  timeframe: string
  style: 'swing' | 'day_trade'
  thresholds: {
    minOosWindows: number
    minStitchedOosTrades: number
    optimizationSeeds: number
    minPositiveSeedOutcomes: number
    minDsr: number
    lockboxMinTrades: number
    lockboxMaxDrawdownPct: number | null
  }
}

export const ALPHA_RESEARCH_PROFILES: AlphaResearchProfileOption[] = [
  {
    id: 'ccm_h1_swing',
    label: 'CCM$ H1 swing',
    symbol: 'CCM$',
    timeframe: 'H1',
    style: 'swing',
    thresholds: {
      minOosWindows: 6,
      minStitchedOosTrades: 30,
      optimizationSeeds: 5,
      minPositiveSeedOutcomes: 4,
      minDsr: 0.95,
      lockboxMinTrades: 5,
      lockboxMaxDrawdownPct: null,
    },
  },
  {
    id: 'win_h1_swing',
    label: 'WIN$ H1 swing',
    symbol: 'WIN$',
    timeframe: 'H1',
    style: 'swing',
    thresholds: {
      minOosWindows: 6,
      minStitchedOosTrades: 30,
      optimizationSeeds: 5,
      minPositiveSeedOutcomes: 4,
      minDsr: 0.95,
      lockboxMinTrades: 5,
      lockboxMaxDrawdownPct: null,
    },
  },
  {
    id: 'wdo_m15_day',
    label: 'WDO$ M15 day trade',
    symbol: 'WDO$',
    timeframe: 'M15',
    style: 'day_trade',
    thresholds: {
      minOosWindows: 6,
      minStitchedOosTrades: 100,
      optimizationSeeds: 5,
      minPositiveSeedOutcomes: 4,
      minDsr: 0.95,
      lockboxMinTrades: 10,
      lockboxMaxDrawdownPct: 0.25,
    },
  },
]

export function getAlphaResearchProfile(
  profileId: AlphaResearchProfileId,
): AlphaResearchProfileOption {
  const profile = ALPHA_RESEARCH_PROFILES.find((entry) => entry.id === profileId)
  if (!profile) {
    throw new Error(`Unknown alpha-research profile '${profileId}'.`)
  }
  return profile
}

export const ALPHA_RESEARCH_VERDICT_LABEL: Record<AlphaResearchVerdict, string> = {
  ready_for_paper: 'READY FOR PAPER TRADING',
  rejected: 'REJECTED',
  inconclusive: 'INCONCLUSIVE — MORE/VALID DATA REQUIRED',
}

export const ALPHA_RESEARCH_VERDICT_CLASS: Record<AlphaResearchVerdict, string> = {
  ready_for_paper:
    'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_-3px_rgba(52,211,153,0.2)]',
  rejected:
    'border-rose-500/30 text-rose-400 bg-rose-500/10 shadow-[0_0_12px_-3px_rgba(244,63,94,0.2)]',
  inconclusive: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
}

export const PIPELINE_STAGE_LABELS: Record<AlphaResearchStageName, string> = {
  preflight: 'Data preflight',
  feature_evidence: 'Feature evidence',
  hypothesis_eligibility: 'Hypotheses admitted',
  candidate_evaluation: 'Candidates evaluated',
  acceptance: 'Repeated seeds & plateau',
  lockbox: 'Lock-box holdout',
  complete: 'Verdict',
}

const PIPELINE_ORDER: AlphaResearchStageName[] = [
  'preflight',
  'feature_evidence',
  'hypothesis_eligibility',
  'candidate_evaluation',
  'acceptance',
  'lockbox',
  'complete',
]

export function orderedPipelineStages(
  stages: AlphaResearchStageStatus[] | undefined,
): AlphaResearchStageStatus[] {
  const byName = new Map((stages ?? []).map((stage) => [stage.name, stage]))
  return PIPELINE_ORDER.map((name) => ({
    name,
    status: byName.get(name)?.status ?? 'pending',
    detail: byName.get(name)?.detail ?? null,
  }))
}

export function progressPercent(progress: number | undefined): number {
  if (progress == null) return 0
  return progress <= 1 ? Math.round(progress * 100) : Math.round(progress)
}

export function formatNullableNumber(value: unknown, digits = 4): string {
  if (value == null || typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

export function formatCriterionValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'number') return formatNullableNumber(value)
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export function stageStatusClass(status: AlphaResearchStageStatus['status']): string {
  switch (status) {
    case 'completed':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    case 'running':
      return 'border-brass-500/30 bg-brass-500/10 text-brass-300'
    case 'failed':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
    case 'skipped':
      return 'border-silver-500/30 bg-silver-500/10 text-silver-400'
    default:
      return 'border-carbon-600/40 bg-carbon-950/30 text-silver-500'
  }
}

export function criterionStatusClass(status: string): string {
  switch (status) {
    case 'passed':
      return 'text-emerald-400'
    case 'failed':
      return 'text-rose-400'
    case 'unavailable':
      return 'text-amber-300'
    default:
      return 'text-silver-300'
  }
}

function manifestRange(result: AlphaResearchResult): {
  start: string
  end: string
} {
  const manifest = result.split_manifest as
    | { range_start?: string; range_end?: string }
    | null
    | undefined
  if (manifest?.range_start && manifest?.range_end) {
    return { start: manifest.range_start, end: manifest.range_end }
  }
  const provenance = result.provenance.requested_range as
    | { start?: string; end?: string }
    | undefined
  if (provenance?.start && provenance?.end) {
    return { start: provenance.start, end: provenance.end }
  }
  return {
    start: new Date().toISOString(),
    end: new Date().toISOString(),
  }
}

export function buildBacktestConfigFromAlphaResult(
  result: AlphaResearchResult,
): OptimizationBacktestConfig {
  const profile = getAlphaResearchProfile(result.profile_id)
  const range = manifestRange(result)
  return {
    symbol: profile.symbol,
    timeframe: profile.timeframe,
    start: range.start,
    end: range.end,
    initial_capital: 100_000,
    point_value: 1,
    strategy: 'CompositeStrategy',
    day_trade: profile.style === 'day_trade',
    day_trade_start_time: '09:00',
    day_trade_end_time: '17:55',
    day_trade_close_time: '18:00',
    engine: 'candle',
  }
}

export function buildSearchConfigFromAlphaResult(
  result: AlphaResearchResult,
): StrategySearchConfig {
  const profile = getAlphaResearchProfile(result.profile_id)
  const backtest = buildBacktestConfigFromAlphaResult(result)
  return {
    backtest,
    objective: { mode: 'maximize_sharpe' },
    walkforward: {
      mode: 'rolling',
      train_days: profile.style === 'day_trade' ? 20 : 60,
      test_days: profile.style === 'day_trade' ? 10 : 30,
      min_windows: 6,
    },
    study: {
      name: `alpha_research_${result.profile_id}`,
      n_trials: 30,
      sampler: 'tpe',
      seed: 42,
      pruner: 'none',
      continue_on_trial_error: false,
    },
    provider: 'registry',
    lockbox: {
      enabled: true,
      lockbox_pct: 0.2,
      min_trades: profile.thresholds.lockboxMinTrades,
      max_drawdown_pct: profile.thresholds.lockboxMaxDrawdownPct,
    },
    gates: {
      min_completed_windows: profile.thresholds.minOosWindows,
      min_oos_trades: profile.thresholds.minStitchedOosTrades,
      efficiency_low: 0.3,
      efficiency_high: 1.5,
    },
    include_risk_search: false,
  }
}

export function buildCandidateResultFromAlphaChampion(
  result: AlphaResearchResult,
): CandidateResult | null {
  const champion = result.champion
  if (!champion?.best_params) return null
  const acceptance = result.acceptance as AlphaResearchAcceptanceResult | null | undefined
  const championSeed = acceptance?.seeds?.find((seed) => seed.seed === champion.champion_seed)
  const lockboxMetrics = acceptance?.lockbox_metrics as Record<string, number> | null | undefined
  const seedMetrics = championSeed?.oos_metrics as Record<string, number> | null | undefined
  return {
    candidate_id: champion.candidate_id,
    strategy: 'CompositeStrategy',
    status: 'completed',
    rank: 1,
    passed_gates: true,
    gate_flags: [],
    robustness_score: null,
    efficiency: null,
    error: null,
    is_metrics_summary: null,
    best_params: champion.best_params,
    genome: (champion.genome as Genome | undefined) ?? null,
    oos_metrics: seedMetrics ?? lockboxMetrics ?? null,
    objective_value: championSeed?.objective_value ?? null,
    completed_windows: championSeed?.completed_windows ?? 0,
    window_count: championSeed?.window_count ?? 0,
  }
}

export function buildBacktestRequestFromAlphaResult(
  result: AlphaResearchResult,
): BacktestRequest | null {
  const candidate = buildCandidateResultFromAlphaChampion(result)
  if (!candidate) return null
  return buildBacktestRequestFromCandidate(candidate, buildBacktestConfigFromAlphaResult(result))
}

export function buildOptimizationConfigFromAlphaResult(
  result: AlphaResearchResult,
): OptimizationConfig | null {
  const candidate = buildCandidateResultFromAlphaChampion(result)
  if (!candidate) return null
  return buildOptimizationConfigFromCandidate(candidate, buildSearchConfigFromAlphaResult(result))
}

export function acceptanceEvidenceRows(
  acceptance: AlphaResearchAcceptanceResult | null | undefined,
) {
  return acceptance?.criteria ?? []
}

export function hasRenderableAcceptanceEvidence(result: AlphaResearchResult): boolean {
  if (result.verdict === 'inconclusive' && result.inconclusive_reasons.length > 0) {
    return true
  }
  return Boolean(result.acceptance?.criteria?.length)
}
