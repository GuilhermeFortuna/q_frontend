import type {
  NeuralModelDetail,
  NeuralModelListItem,
  NeuralModelStatus,
  NeuralTrainRequest,
  NeuralTrainingRun,
} from '@/types/neural'

export const MOCK_NEURAL_CANDIDATE_HASH = 'mock_neural_candidate_a1b2c3d4'
export const MOCK_NEURAL_TRAINED_HASH = 'mock_neural_trained_e5f6g7h8'
export const MOCK_NEURAL_PRODUCTION_HASH = 'mock_neural_production_i9j0k1l2'
export const MOCK_NEURAL_ARCHIVED_HASH = 'mock_neural_archived_m3n4o5p6'

const ALLOWED_TRANSITIONS: Record<NeuralModelStatus, ReadonlySet<NeuralModelStatus>> = {
  trained: new Set(['candidate', 'archived']),
  candidate: new Set(['production', 'archived', 'trained']),
  production: new Set(['archived', 'candidate']),
  archived: new Set(),
}

function baseModel(
  overrides: Partial<NeuralModelListItem> & Pick<NeuralModelListItem, 'model_hash' | 'status'>,
): NeuralModelListItem {
  return {
    model_key: 'autoencoder_ccmusd_h1',
    symbol: 'CCM$',
    timeframe: 'H1',
    version: 1,
    n_latents: 8,
    created_at: '2026-06-20T10:00:00.000Z',
    val_metrics: {
      reconstruction_r2: 0.82,
      reconstruction_mse: 0.014,
    },
    ...overrides,
  }
}

export const mockNeuralModels: NeuralModelListItem[] = [
  baseModel({
    model_hash: MOCK_NEURAL_CANDIDATE_HASH,
    model_key: 'autoencoder_ccmusd_h1',
    status: 'candidate',
    version: 2,
    created_at: '2026-06-22T14:30:00.000Z',
  }),
  baseModel({
    model_hash: MOCK_NEURAL_TRAINED_HASH,
    model_key: 'pca_ccmusd_h1',
    status: 'trained',
    version: 1,
    n_latents: 4,
    val_metrics: { reconstruction_r2: 0.71, reconstruction_mse: 0.021 },
    created_at: '2026-06-18T09:15:00.000Z',
  }),
  baseModel({
    model_hash: MOCK_NEURAL_PRODUCTION_HASH,
    model_key: 'autoencoder_eurusd_h1',
    symbol: 'EURUSD',
    status: 'production',
    version: 3,
    created_at: '2026-06-15T08:00:00.000Z',
  }),
  baseModel({
    model_hash: MOCK_NEURAL_ARCHIVED_HASH,
    model_key: 'pca_eurusd_h1',
    symbol: 'EURUSD',
    status: 'archived',
    version: 1,
    n_latents: 6,
    created_at: '2026-06-01T12:00:00.000Z',
  }),
]

const INITIAL_NEURAL_MODELS: NeuralModelListItem[] = mockNeuralModels.map((model) => ({ ...model }))

export const mockNeuralDetails: Record<string, NeuralModelDetail> = {
  [MOCK_NEURAL_CANDIDATE_HASH]: {
    ...mockNeuralModels[0]!,
    train_start: '2024-01-01T00:00:00.000Z',
    train_end: '2025-06-01T00:00:00.000Z',
    latent_names: ['latent_001', 'latent_002', 'latent_003', 'latent_004'],
    gate_result: {
      evaluation_run_id: 'eval_gate_pass_001',
      baseline_ic: 0.091,
      best_latent_ic: 0.112,
      n_latents_beating_baseline: 3,
      passed: true,
      target_name: 'fwd_return',
      target_horizon: 5,
    },
  },
  [MOCK_NEURAL_TRAINED_HASH]: {
    ...mockNeuralModels[1]!,
    train_start: '2024-01-01T00:00:00.000Z',
    train_end: '2025-06-01T00:00:00.000Z',
    latent_names: ['latent_001', 'latent_002'],
    gate_result: null,
  },
  [MOCK_NEURAL_PRODUCTION_HASH]: {
    ...mockNeuralModels[2]!,
    train_start: '2023-06-01T00:00:00.000Z',
    train_end: '2025-01-01T00:00:00.000Z',
    latent_names: ['latent_001', 'latent_002', 'latent_003'],
    gate_result: {
      evaluation_run_id: 'eval_gate_fail_002',
      baseline_ic: 0.091,
      best_latent_ic: 0.078,
      n_latents_beating_baseline: 0,
      passed: false,
      target_name: 'fwd_return',
      target_horizon: 5,
    },
  },
  [MOCK_NEURAL_ARCHIVED_HASH]: {
    ...mockNeuralModels[3]!,
    train_start: '2023-01-01T00:00:00.000Z',
    train_end: '2024-06-01T00:00:00.000Z',
    latent_names: ['latent_001'],
    gate_result: null,
  },
}

const INITIAL_NEURAL_DETAILS: Record<string, NeuralModelDetail> = Object.fromEntries(
  Object.entries(mockNeuralDetails).map(([hash, detail]) => [
    hash,
    {
      ...detail,
      val_metrics: { ...detail.val_metrics },
      latent_names: [...detail.latent_names],
      gate_result: detail.gate_result ? { ...detail.gate_result } : null,
    },
  ]),
)

export function resetMockNeuralState() {
  mockNeuralModels.splice(
    0,
    mockNeuralModels.length,
    ...INITIAL_NEURAL_MODELS.map((model) => ({
      ...model,
      val_metrics: { ...model.val_metrics },
    })),
  )

  for (const hash of Object.keys(mockNeuralDetails)) {
    delete mockNeuralDetails[hash]
  }
  for (const [hash, detail] of Object.entries(INITIAL_NEURAL_DETAILS)) {
    mockNeuralDetails[hash] = {
      ...detail,
      val_metrics: { ...detail.val_metrics },
      latent_names: [...detail.latent_names],
      gate_result: detail.gate_result ? { ...detail.gate_result } : null,
    }
  }

  mockTrainingJobs.clear()
}

export function getMockNeuralModels(params?: { status?: string }) {
  return mockNeuralModels.filter((item) => {
    if (params?.status && item.status !== params.status) return false
    return true
  })
}

export function setMockNeuralModelStatus(
  modelHash: string,
  status: NeuralModelStatus,
): NeuralModelDetail | { error: string; status: 409 | 404 } {
  const listItem = mockNeuralModels.find((item) => item.model_hash === modelHash)
  const detail = mockNeuralDetails[modelHash]
  if (!listItem || !detail) {
    return { error: `Neural model version '${modelHash}' not found.`, status: 404 }
  }

  const allowed = ALLOWED_TRANSITIONS[listItem.status]
  if (!allowed.has(status)) {
    return {
      error: `Illegal transition from '${listItem.status}' to '${status}'.`,
      status: 409,
    }
  }

  if (status === 'production') {
    for (const other of mockNeuralModels) {
      if (
        other.model_hash !== modelHash &&
        other.symbol === listItem.symbol &&
        other.timeframe === listItem.timeframe &&
        other.status === 'production'
      ) {
        other.status = 'candidate'
        const otherDetail = mockNeuralDetails[other.model_hash]
        if (otherDetail) {
          otherDetail.status = 'candidate'
        }
      }
    }
  }

  listItem.status = status
  detail.status = status
  return detail
}

export function getMockNeuralDetail(modelHash: string): NeuralModelDetail | null {
  return mockNeuralDetails[modelHash] ?? null
}

type MockTrainingJob = {
  job_id: string
  status: NeuralTrainingRun['status']
  progress: NeuralTrainingRun['progress']
  start_time: number
  request: NeuralTrainRequest
  model_hash?: string
  error?: string
}

const mockTrainingJobs = new Map<string, MockTrainingJob>()

export const MOCK_NEURAL_TRAINING_FAIL_SYMBOL = 'FAILTRAIN'

function registerTrainedModelFromJob(job: MockTrainingJob): string {
  const modelHash = `mock_trained_${job.job_id}`
  const modelKey = `${job.request.kind}_${job.request.symbol.toLowerCase()}_${job.request.timeframe.toLowerCase()}`
  const nextVersion =
    Math.max(0, ...mockNeuralModels.filter((m) => m.model_key === modelKey).map((m) => m.version)) +
    1

  const listItem: NeuralModelListItem = {
    model_hash: modelHash,
    model_key: modelKey,
    symbol: job.request.symbol,
    timeframe: job.request.timeframe,
    version: nextVersion,
    status: job.request.evaluate ? 'candidate' : 'trained',
    n_latents: job.request.n_latents,
    created_at: new Date().toISOString(),
    val_metrics: {
      reconstruction_r2: 0.79,
      reconstruction_mse: 0.016,
    },
  }

  mockNeuralModels.unshift(listItem)
  mockNeuralDetails[modelHash] = {
    ...listItem,
    train_start: job.request.train_start,
    train_end: job.request.train_end,
    latent_names: Array.from(
      { length: job.request.n_latents },
      (_, index) => `latent_${String(index + 1).padStart(3, '0')}`,
    ),
    gate_result: job.request.evaluate
      ? {
          evaluation_run_id: `eval_${job.job_id}`,
          baseline_ic: 0.091,
          best_latent_ic: 0.104,
          n_latents_beating_baseline: 2,
          passed: true,
          target_name: job.request.evaluate.target,
          target_horizon: job.request.evaluate.horizon,
        }
      : null,
  }

  return modelHash
}

export function createMockTrainingJob(request: NeuralTrainRequest): MockTrainingJob {
  const jobId = `train_${Math.random().toString(36).slice(2, 10)}`
  const job: MockTrainingJob = {
    job_id: jobId,
    status: 'queued',
    progress: 'queued',
    start_time: Date.now(),
    request,
  }
  mockTrainingJobs.set(jobId, job)
  return job
}

export function getMockTrainingJob(jobId: string): MockTrainingJob | undefined {
  return mockTrainingJobs.get(jobId)
}

export function getUpdatedMockTrainingJob(jobId: string): MockTrainingJob | undefined {
  const job = mockTrainingJobs.get(jobId)
  if (!job) return undefined

  if (job.status === 'completed' || job.status === 'failed') {
    return job
  }

  if (job.request.symbol === MOCK_NEURAL_TRAINING_FAIL_SYMBOL) {
    job.status = 'failed'
    job.progress = 'failed'
    job.error = 'Mock training failure: insufficient bars in train window.'
    return job
  }

  const elapsed = Date.now() - job.start_time
  if (elapsed < 400) {
    job.status = 'queued'
    job.progress = 'queued'
  } else if (elapsed < 1_200) {
    job.status = 'running'
    job.progress = 'building_window'
  } else if (elapsed < 2_000) {
    job.status = 'running'
    job.progress = 'training'
  } else if (elapsed < 2_800 && job.request.evaluate) {
    job.status = 'running'
    job.progress = 'evaluating'
  } else {
    job.status = 'completed'
    job.progress = 'done'
    job.model_hash = registerTrainedModelFromJob(job)
  }

  return job
}

export function trainingRunFromJob(job: MockTrainingJob): NeuralTrainingRun {
  return {
    job_id: job.job_id,
    status: job.status,
    progress: job.progress,
    model_hash: job.model_hash ?? null,
    val_metrics: job.model_hash ? (mockNeuralDetails[job.model_hash]?.val_metrics ?? null) : null,
    gate: job.model_hash
      ? (() => {
          const gate = mockNeuralDetails[job.model_hash!]?.gate_result
          if (!gate) return null
          return {
            baseline_ic: gate.baseline_ic,
            best_latent_ic: gate.best_latent_ic,
            n_latents_beating_baseline: gate.n_latents_beating_baseline,
            passed: gate.passed,
            evaluation_run_id: gate.evaluation_run_id,
          }
        })()
      : null,
    error: job.error ?? null,
  }
}
