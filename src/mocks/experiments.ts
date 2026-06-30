import type {
  AlphaResearchRequest,
  AlphaResearchResult,
  AlphaResearchStageStatus,
  AlphaResearchStatusResponse,
  DiscoveryAbRequest,
  DiscoveryAbResult,
  DiscoveryAbStatusResponse,
  EncoderAblationRequest,
  EncoderAblationResult,
  EncoderAblationStatusResponse,
} from '@/types/experiments'
import { DEFAULT_MINIMUM_COMPLETE_PAIRS } from '@/types/experiments'

type MockDiscoveryAbJob = {
  job_id: string
  status: DiscoveryAbStatusResponse['status']
  progress: number
  start_time: number
  request: DiscoveryAbRequest
  error?: string | null
}

type MockEncoderAblationJob = {
  job_id: string
  status: EncoderAblationStatusResponse['status']
  progress: string
  start_time: number
  request: EncoderAblationRequest
  error?: string | null
}

type MockAlphaResearchJob = {
  job_id: string
  status: AlphaResearchStatusResponse['status']
  progress: number
  start_time: number
  request: AlphaResearchRequest
  error?: string | null
  cancelled?: boolean
}

const mockDiscoveryAbJobs = new Map<string, MockDiscoveryAbJob>()
const mockEncoderAblationJobs = new Map<string, MockEncoderAblationJob>()
const mockAlphaResearchJobs = new Map<string, MockAlphaResearchJob>()

export function resetMockExperimentsState() {
  mockDiscoveryAbJobs.clear()
  mockEncoderAblationJobs.clear()
  mockAlphaResearchJobs.clear()
}

export function createMockDiscoveryAbJob(request: DiscoveryAbRequest): MockDiscoveryAbJob {
  const jobId = `ab_${Math.random().toString(36).slice(2, 10)}`
  const job: MockDiscoveryAbJob = {
    job_id: jobId,
    status: 'queued',
    progress: 0,
    start_time: Date.now(),
    request,
  }
  mockDiscoveryAbJobs.set(jobId, job)
  return job
}

export function getUpdatedMockDiscoveryAbJob(jobId: string): MockDiscoveryAbJob | undefined {
  const job = mockDiscoveryAbJobs.get(jobId)
  if (!job) return undefined

  if (job.status === 'completed' || job.status === 'failed') {
    return job
  }

  // If backtest symbol is 'FAIL', simulate a failed job.
  if (job.request.config.backtest.symbol === 'FAIL') {
    job.status = 'failed'
    job.progress = 0
    job.error = 'Mock Discovery A/B failure: engine connection timed out.'
    return job
  }

  const elapsed = Date.now() - job.start_time
  if (elapsed < 500) {
    job.status = 'queued'
    job.progress = 0
  } else if (elapsed < 2000) {
    job.status = 'running'
    job.progress = Math.round((elapsed / 2000) * 100)
  } else {
    job.status = 'completed'
    job.progress = 100
  }

  return job
}

function buildLegacyNoEffectResult(request: DiscoveryAbRequest): DiscoveryAbResult {
  return {
    verdict: 'no_effect',
    n_seeds: 0,
    requested_seeds: request.seeds.length,
    complete_pairs: 0,
    minimum_complete_pairs: request.minimum_complete_pairs ?? DEFAULT_MINIMUM_COMPLETE_PAIRS,
    dropped_pair_reasons: ['seed 42 control: legacy stored report with zero pairs'],
    metric: request.config.lockbox?.enabled ? 'lockbox_objective' : 'oos_objective',
    control: { values: [], mean: 0 },
    treatment: { values: [], mean: 0 },
    paired_delta: { values: [], mean: 0, cohens_d: 0, p_value: 1 },
    child_runs: [],
  }
}

export function getDiscoveryAbResult(request: DiscoveryAbRequest): DiscoveryAbResult {
  const symbol = request.config.backtest.symbol
  const requestedSeeds = request.seeds.length
  const minimumCompletePairs = request.minimum_complete_pairs ?? DEFAULT_MINIMUM_COMPLETE_PAIRS

  if (symbol === 'LEGACY') {
    return buildLegacyNoEffectResult(request)
  }

  const isInconclusiveZero = symbol === 'INCONC0'
  const isInconclusiveOne = symbol === 'INCONC1'
  const isHurts = symbol === 'HURTS'
  const isNoEffect = symbol === 'NEUTRAL'

  if (isInconclusiveZero) {
    return {
      verdict: 'inconclusive',
      n_seeds: 0,
      requested_seeds: requestedSeeds,
      complete_pairs: 0,
      minimum_complete_pairs: minimumCompletePairs,
      dropped_pair_reasons: [
        'seed 42 control: child run run_c_42 ended failed',
        'seed 42 treatment: child run run_t_42 ended cancelled',
      ],
      metric: request.config.lockbox?.enabled ? 'lockbox_objective' : 'oos_objective',
      control: { values: [], mean: null },
      treatment: { values: [], mean: null },
      paired_delta: { values: [], mean: null, cohens_d: null, p_value: null },
      child_runs: request.seeds.flatMap((seed) => [
        { seed, arm: 'control', run_id: `run_c_${seed}`, terminal_status: 'failed' },
        { seed, arm: 'treatment', run_id: `run_t_${seed}`, terminal_status: 'cancelled' },
      ]),
    }
  }

  const effectivePairs = isInconclusiveOne ? 1 : requestedSeeds
  const controlMean = 0.42
  const treatmentMean = isHurts ? 0.35 : isNoEffect ? 0.425 : 0.58

  const controlValues = Array.from(
    { length: effectivePairs },
    (_, i) => controlMean + Math.sin(i) * 0.05,
  )
  const treatmentValues = Array.from(
    { length: effectivePairs },
    (_, i) => treatmentMean + Math.cos(i) * 0.05,
  )

  if (isInconclusiveOne) {
    return {
      verdict: 'inconclusive',
      n_seeds: 1,
      requested_seeds: requestedSeeds,
      complete_pairs: 1,
      minimum_complete_pairs: minimumCompletePairs,
      dropped_pair_reasons: [
        'seed 43 control: child run run_c_43 ended failed',
        'seed 44 treatment: synthetic missing candidate',
      ],
      metric: request.config.lockbox?.enabled ? 'lockbox_objective' : 'oos_objective',
      control: { values: controlValues, mean: null },
      treatment: { values: treatmentValues, mean: null },
      paired_delta: { values: [], mean: null, cohens_d: null, p_value: null },
      child_runs: request.seeds.flatMap((seed) => [
        {
          seed,
          arm: 'control',
          run_id: `run_c_${seed}`,
          terminal_status: seed === 42 ? 'completed' : 'failed',
        },
        {
          seed,
          arm: 'treatment',
          run_id: `run_t_${seed}`,
          terminal_status: seed === 42 ? 'completed' : 'failed',
        },
      ]),
    }
  }

  const pairedDeltas = treatmentValues.map((t, idx) => t - controlValues[idx]!)
  const deltaMean = pairedDeltas.reduce((a, b) => a + b, 0) / effectivePairs
  const cohensD = isHurts ? -0.82 : isNoEffect ? 0.08 : 1.24
  const pValue = isNoEffect ? 0.65 : 0.018
  const verdict = isHurts ? 'hurts' : isNoEffect ? 'no_effect' : 'helps'

  return {
    verdict,
    n_seeds: effectivePairs,
    requested_seeds: requestedSeeds,
    complete_pairs: effectivePairs,
    minimum_complete_pairs: minimumCompletePairs,
    dropped_pair_reasons: [],
    metric: request.config.lockbox?.enabled ? 'lockbox_objective' : 'oos_objective',
    control: {
      values: controlValues,
      mean: controlMean,
    },
    treatment: {
      values: treatmentValues,
      mean: treatmentMean,
    },
    paired_delta: {
      values: pairedDeltas,
      mean: deltaMean,
      cohens_d: cohensD,
      p_value: pValue,
    },
    child_runs: request.seeds.flatMap((seed) => [
      {
        seed,
        arm: 'control',
        run_id: `run_c_${seed}`,
        objective: controlMean + Math.sin(seed) * 0.05,
      },
      {
        seed,
        arm: 'treatment',
        run_id: `run_t_${seed}`,
        objective: treatmentMean + Math.cos(seed) * 0.05,
      },
    ]),
  }
}

export function createMockEncoderAblationJob(
  request: EncoderAblationRequest,
): MockEncoderAblationJob {
  const jobId = `abl_${Math.random().toString(36).slice(2, 10)}`
  const job: MockEncoderAblationJob = {
    job_id: jobId,
    status: 'queued',
    progress: 'queued',
    start_time: Date.now(),
    request,
  }
  mockEncoderAblationJobs.set(jobId, job)
  return job
}

export function getUpdatedMockEncoderAblationJob(
  jobId: string,
): MockEncoderAblationJob | undefined {
  const job = mockEncoderAblationJobs.get(jobId)
  if (!job) return undefined

  if (job.status === 'completed' || job.status === 'failed') {
    return job
  }

  if (job.request.symbol === 'FAIL') {
    job.status = 'failed'
    job.progress = 'failed'
    job.error = 'Mock Ablation failure: target fwd_return not found in dataset.'
    return job
  }

  const elapsed = Date.now() - job.start_time
  const total = job.request.configs.length
  if (elapsed < 500) {
    job.status = 'queued'
    job.progress = 'queued'
  } else if (elapsed < 1200) {
    job.status = 'running'
    job.progress = `0/${total}`
  } else if (elapsed < 2000) {
    job.status = 'running'
    job.progress = `${Math.max(1, total - 1)}/${total}`
  } else {
    job.status = 'completed'
    job.progress = `${total}/${total}`
  }

  return job
}

export function getEncoderAblationResult(request: EncoderAblationRequest): EncoderAblationResult {
  const rows = request.configs.map((config, index) => {
    const isPca = config.encoder_kind === 'pca'
    // Let PCA beat Autoencoder to match CCM$ H1 precedent (PCA > AE)
    const baselineIc = 0.091
    const bestLatentIc = isPca ? 0.1695 : 0.0782
    const passed = bestLatentIc > baselineIc
    const reconR2 = isPca ? 0.854 : 0.612

    return {
      label: config.label,
      encoder_kind: config.encoder_kind,
      model_hash: `mock_abl_hash_${config.label}_${index}`,
      recon_r2: reconR2,
      best_latent_ic: bestLatentIc,
      baseline_ic: baselineIc,
      ic_delta_vs_baseline: bestLatentIc - baselineIc,
      passed,
      gate_error: passed ? null : 'Failed to beat baseline IC.',
    }
  })

  // Find best label
  const passedRows = rows.filter((r) => r.passed)
  let bestLabel: string | undefined
  if (passedRows.length > 0) {
    bestLabel = passedRows.reduce((best, curr) =>
      (curr.best_latent_ic ?? 0) > (best.best_latent_ic ?? 0) ? curr : best,
    ).label
  } else {
    bestLabel = rows[0]?.label
  }

  return {
    rows,
    best_label: bestLabel ?? null,
    symbol: request.symbol,
    timeframe: request.timeframe,
    target: request.target,
    horizon: request.horizon,
  }
}

function completedStages(detail?: string): AlphaResearchStageStatus[] {
  const names = [
    'preflight',
    'feature_evidence',
    'hypothesis_eligibility',
    'candidate_evaluation',
    'acceptance',
    'lockbox',
    'complete',
  ] as const
  return names.map((name, index) => ({
    name,
    status: 'completed',
    detail: index === names.length - 1 ? (detail ?? null) : null,
  }))
}

function baseAlphaResult(
  request: AlphaResearchRequest,
  verdict: AlphaResearchResult['verdict'],
): AlphaResearchResult {
  const seeds = [42, 43, 44, 45, 46]
  const candidateId = `${request.profile_id}_v1_breakout`
  const inconclusiveReasons =
    verdict === 'inconclusive'
      ? request.start.startsWith('2000-')
        ? ['insufficient_bars: evidence segment has 0 bars']
        : ['no_candidate_passed_repeated_seed_robustness']
      : []

  const criteria =
    verdict === 'ready_for_paper'
      ? [
          {
            name: 'seed_robustness',
            status: 'passed',
            observed: 5,
            threshold: 4,
            reason: '5/5 seeds produced positive OOS objectives.',
          },
          {
            name: 'dsr',
            status: 'passed',
            observed: 0.97,
            threshold: 0.95,
            reason: 'Deflated Sharpe exceeds profile minimum.',
          },
          {
            name: 'lockbox_trades',
            status: 'passed',
            observed: 8,
            threshold: 5,
            reason: 'Lock-box holdout met minimum trade count.',
          },
        ]
      : verdict === 'rejected'
        ? [
            {
              name: 'seed_robustness',
              status: 'failed',
              observed: 2,
              threshold: 4,
              reason: 'Only 2/5 seeds were positive.',
            },
            {
              name: 'dsr',
              status: 'failed',
              observed: 0.71,
              threshold: 0.95,
              reason: 'Deflated Sharpe below profile minimum.',
            },
          ]
        : request.start.startsWith('2000-')
          ? [
              {
                name: 'coverage',
                status: 'unavailable',
                observed: 0,
                threshold: 1,
                reason: 'No bars available in evidence segment.',
              },
            ]
          : [
              {
                name: 'seed_robustness',
                status: 'unavailable',
                observed: 0,
                threshold: 4,
                reason: 'No champion survived repeated-seed evaluation.',
              },
            ]

  const seedRows = seeds.map((seed, index) => ({
    seed,
    status: verdict === 'ready_for_paper' ? 'completed' : index < 2 ? 'completed' : 'failed',
    objective_value: verdict === 'ready_for_paper' ? 0.42 + index * 0.01 : index < 2 ? 0.1 : -0.05,
    completed_windows: verdict === 'ready_for_paper' ? 6 : index < 2 ? 4 : 2,
    window_count: 6,
    failure_reason:
      verdict === 'ready_for_paper' ? null : index < 2 ? null : 'insufficient_oos_trades',
  }))

  return {
    verdict,
    profile_id: request.profile_id,
    provenance: {
      backend_version: 'mock-backend',
      profile_id: request.profile_id,
      profile_version: request.profile_version ?? 1,
      catalog_version: request.catalog_version ?? 1,
      split_manifest_hash: 'mock_manifest_hash',
      data_fingerprint: 'mock_data_fingerprint',
      optimization_seeds: seeds,
      frozen_champion_id: verdict === 'ready_for_paper' ? candidateId : null,
      champion_hash: verdict === 'ready_for_paper' ? 'mock_champion_hash' : null,
      requested_range: { start: request.start, end: request.end },
    },
    split_manifest: {
      manifest_hash: 'mock_manifest_hash',
      range_start: request.start,
      range_end: request.end,
      evidence: { bar_count: request.start.startsWith('2000-') ? 0 : 420 },
      walkforward: { windows: 6 },
      lockbox: { bar_count: 120 },
    },
    feature_evidence_summary:
      verdict === 'inconclusive' && request.start.startsWith('2000-')
        ? []
        : [
            {
              feature_name: 'vol_regime',
              decision: 'admitted',
              deflated_score: 0.62,
              n_obs: 420,
            },
            {
              feature_name: 'session_bias',
              decision: verdict === 'rejected' ? 'rejected' : 'admitted',
              deflated_score: verdict === 'rejected' ? 0.31 : 0.58,
              n_obs: 420,
            },
          ],
    hypothesis_manifest:
      verdict === 'inconclusive' && request.start.startsWith('2000-')
        ? []
        : [
            {
              candidate_id: candidateId,
              hypothesis_id: candidateId,
              hypothesis_rationale: 'Breakout continuation with admitted vol regime.',
              hypothesis_required_features: ['vol_regime'],
              genome_node_count: 4,
            },
          ],
    champion:
      verdict === 'ready_for_paper'
        ? {
            candidate_id: candidateId,
            champion_seed: 46,
            best_params: {
              strategy_params: { lookback: 20, threshold: 1.5 },
              risk_params: { type: 'fixed_quantity', quantity: 1 },
            },
            genome: {
              version: 1,
              genome_id: candidateId,
              nodes: [{ id: 'entry', kind: 'breakout', params: { lookback: 20 } }],
              entry_long: { ref: 'entry' },
              exit_long: { ref: 'entry' },
            },
          }
        : null,
    acceptance: {
      acceptance_id: `mock_acceptance_${request.profile_id}`,
      candidate_id: candidateId,
      verdict,
      criteria,
      seeds: seedRows,
      plateau:
        verdict === 'ready_for_paper'
          ? {
              neighbors_evaluated: 8,
              profitable_fraction: 0.75,
              score_retention: 0.91,
              champion_objective: 0.47,
            }
          : null,
      dsr_value: verdict === 'ready_for_paper' ? 0.97 : verdict === 'rejected' ? 0.71 : null,
      lockbox_metrics:
        verdict === 'ready_for_paper'
          ? { total_return_pct: 0.03, sharpe_ratio: 0.8, total_trades: 8 }
          : null,
      champion_seed: verdict === 'ready_for_paper' ? 46 : null,
    },
    stages: completedStages(
      verdict === 'ready_for_paper'
        ? 'ready_for_paper'
        : verdict === 'rejected'
          ? 'rejected'
          : 'inconclusive',
    ),
    inconclusive_reasons: inconclusiveReasons,
    coverage: {
      bar_count: request.start.startsWith('2000-') ? 0 : 600,
      manifest_hash: 'mock_manifest_hash',
    },
  }
}

export function createMockAlphaResearchJob(request: AlphaResearchRequest): MockAlphaResearchJob {
  const jobId = `ar_${Math.random().toString(36).slice(2, 10)}`
  const job: MockAlphaResearchJob = {
    job_id: jobId,
    status: 'queued',
    progress: 0,
    start_time: Date.now(),
    request,
  }
  mockAlphaResearchJobs.set(jobId, job)
  return job
}

export function getUpdatedMockAlphaResearchJob(jobId: string): MockAlphaResearchJob | undefined {
  const job = mockAlphaResearchJobs.get(jobId)
  if (!job) return undefined

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return job
  }

  if (job.request.start.startsWith('1999-')) {
    job.status = 'failed'
    job.progress = 0
    job.error = 'Mock alpha-research failure: preflight continuity check failed.'
    return job
  }

  if (job.request.start.startsWith('2019-') && job.request.profile_id === 'wdo_m15_day') {
    const elapsed = Date.now() - job.start_time
    if (elapsed >= 1200) {
      job.status = 'cancelled'
      job.progress = 45
      job.cancelled = true
      return job
    }
  }

  const elapsed = Date.now() - job.start_time
  if (elapsed < 500) {
    job.status = 'queued'
    job.progress = 0
  } else if (elapsed < 2500) {
    job.status = 'running'
    job.progress = Math.round((elapsed / 2500) * 100)
  } else {
    job.status = 'completed'
    job.progress = 100
  }

  return job
}

export function getAlphaResearchResult(request: AlphaResearchRequest): AlphaResearchResult {
  if (request.start.startsWith('2000-')) {
    return baseAlphaResult(request, 'inconclusive')
  }
  if (request.profile_id === 'win_h1_swing') {
    return baseAlphaResult(request, 'rejected')
  }
  if (request.profile_id === 'wdo_m15_day') {
    return baseAlphaResult(request, 'inconclusive')
  }
  return baseAlphaResult(request, 'ready_for_paper')
}
