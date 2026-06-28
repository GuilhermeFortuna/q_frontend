import type {
  DiscoveryAbRequest,
  DiscoveryAbResult,
  DiscoveryAbStatusResponse,
  EncoderAblationRequest,
  EncoderAblationResult,
  EncoderAblationStatusResponse,
} from '@/types/experiments'

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

const mockDiscoveryAbJobs = new Map<string, MockDiscoveryAbJob>()
const mockEncoderAblationJobs = new Map<string, MockEncoderAblationJob>()

export function resetMockExperimentsState() {
  mockDiscoveryAbJobs.clear()
  mockEncoderAblationJobs.clear()
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

export function getDiscoveryAbResult(request: DiscoveryAbRequest): DiscoveryAbResult {
  const nSeeds = request.seeds.length
  // Generate some dummy objective values based on symbol
  const symbol = request.config.backtest.symbol
  const isHurts = symbol === 'HURTS'
  const isNoEffect = symbol === 'NEUTRAL'

  const controlMean = 0.42
  const treatmentMean = isHurts ? 0.35 : isNoEffect ? 0.425 : 0.58

  const controlValues = Array.from({ length: nSeeds }, (_, i) => controlMean + Math.sin(i) * 0.05)
  const treatmentValues = Array.from(
    { length: nSeeds },
    (_, i) => treatmentMean + Math.cos(i) * 0.05,
  )
  const pairedDeltas = treatmentValues.map((t, idx) => t - controlValues[idx]!)
  const deltaMean = pairedDeltas.reduce((a, b) => a + b, 0) / nSeeds

  const cohensD = isHurts ? -0.82 : isNoEffect ? 0.08 : 1.24
  const pValue = isNoEffect ? 0.65 : 0.018
  const verdict = isHurts ? 'hurts' : isNoEffect ? 'no_effect' : 'helps'

  return {
    verdict,
    n_seeds: nSeeds,
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
