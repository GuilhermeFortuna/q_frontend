import { formatISO } from 'date-fns'

import type { TargetFamily } from '@/components/research/featureLabUtils'
import type { NeuralEncoderKind, NeuralTrainRequest } from '@/types/neural'

/** Matches `q_train_encoder` CLI defaults (WO146). */
export const DEFAULT_NEURAL_INPUT_FEATURES = [
  'rsi',
  'macd',
  'momentum',
  'realized_vol',
  'ma',
  'bollinger_upper',
  'bollinger_lower',
] as const

export type NeuralTrainFormState = {
  kind: NeuralEncoderKind
  symbol: string
  timeframe: string
  trainStart: Date
  trainEnd: Date
  nLatents: number
  selectedFeatures: Set<string>
  runGate: boolean
  targetName: TargetFamily
  horizon: number
}

export function isNeuralTrainFormValid(state: NeuralTrainFormState): boolean {
  return (
    state.symbol.trim().length > 0 &&
    state.trainStart < state.trainEnd &&
    state.nLatents >= 1 &&
    state.selectedFeatures.size >= 1 &&
    (!state.runGate || state.horizon >= 1)
  )
}

export function neuralTrainMissingFields(state: NeuralTrainFormState): string[] {
  const missing: string[] = []
  if (state.symbol.trim().length === 0) missing.push('symbol')
  if (!(state.trainStart < state.trainEnd)) missing.push('train_end after train_start')
  if (state.nLatents < 1) missing.push('n_latents ≥ 1')
  if (state.selectedFeatures.size === 0) missing.push('at least one input feature')
  if (state.runGate && state.horizon < 1) missing.push('a gate horizon ≥ 1')
  return missing
}

export function buildNeuralTrainRequest(state: NeuralTrainFormState): NeuralTrainRequest {
  const request: NeuralTrainRequest = {
    kind: state.kind,
    symbol: state.symbol.trim().toUpperCase(),
    timeframe: state.timeframe,
    train_start: formatISO(state.trainStart),
    train_end: formatISO(state.trainEnd),
    n_latents: state.nLatents,
    input_features: [...state.selectedFeatures].sort(),
  }

  if (state.runGate) {
    request.evaluate = {
      target: state.targetName,
      horizon: state.horizon,
    }
  }

  return request
}

export function neuralTrainRunLabel(state: NeuralTrainFormState): string {
  const gateSuffix = state.runGate ? ` · gate ${state.targetName}:${state.horizon}` : ''
  return `${state.symbol} ${state.timeframe} · ${state.kind}${gateSuffix}`
}

export function isNeuralTrainingJobActive(status: string | undefined): boolean {
  return status === 'queued' || status === 'running'
}

export function neuralTrainingRefetchInterval(isRunning: boolean): number | false {
  return isRunning ? 800 : false
}

export const NEURAL_TRAINING_PHASE_LABELS: Record<string, string> = {
  queued: 'Queued',
  building_window: 'Building feature window',
  training: 'Training encoder',
  evaluating: 'Running IC gate',
  done: 'Complete',
  failed: 'Failed',
}
