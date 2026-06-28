import type { NeuralModelStatus } from '@/types/neural'
import { cn } from '@/lib/utils'

const ALLOWED_TRANSITIONS: Record<NeuralModelStatus, readonly NeuralModelStatus[]> = {
  trained: ['candidate', 'archived'],
  candidate: ['production', 'archived', 'trained'],
  production: ['archived', 'candidate'],
  archived: [],
}

const STATUS_LABELS: Record<NeuralModelStatus, string> = {
  trained: 'Trained',
  candidate: 'Candidate',
  production: 'Production',
  archived: 'Archived',
}

const PROMOTE_ACTION_LABELS: Partial<Record<NeuralModelStatus, string>> = {
  candidate: 'Promote to Candidate',
  production: 'Promote to Production',
  archived: 'Archive',
  trained: 'Demote to Trained',
}

export function neuralStatusLabel(status: NeuralModelStatus): string {
  return STATUS_LABELS[status]
}

export function neuralStatusChipClass(status: NeuralModelStatus): string {
  const base =
    'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase'

  switch (status) {
    case 'production':
      return cn(base, 'accent-state text-gold-400')
    case 'candidate':
      return cn(base, 'bg-brass-500/10 text-brass-300')
    case 'trained':
      return cn(base, 'bg-silver-500/10 text-silver-300')
    case 'archived':
    default:
      return cn(base, 'bg-carbon-700/40 text-silver-500')
  }
}

export function legalNextNeuralStatuses(status: NeuralModelStatus): NeuralModelStatus[] {
  return [...ALLOWED_TRANSITIONS[status]]
}

export function neuralPromoteActionLabel(targetStatus: NeuralModelStatus): string {
  return PROMOTE_ACTION_LABELS[targetStatus] ?? `Set ${neuralStatusLabel(targetStatus)}`
}

export function encoderKindFromModelKey(modelKey: string): string {
  const kind = modelKey.split('_')[0]
  return kind || modelKey
}

export function formatNeuralMetric(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined) {
    return '—'
  }
  return value.toFixed(digits)
}
