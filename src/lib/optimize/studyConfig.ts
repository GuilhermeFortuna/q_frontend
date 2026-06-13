import type { StudyConfig } from '@/types/optimization'

/** Parse the optional "Worker processes" field. Empty => omit (backend uses auto). */
export function parseMaxWorkersInput(input: string): number | undefined {
  const trimmed = input.trim()
  if (trimmed === '') return undefined
  const value = Number(trimmed)
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    return undefined
  }
  return value
}

export function isMaxWorkersInputInvalid(input: string): boolean {
  const trimmed = input.trim()
  if (trimmed === '') return false
  return parseMaxWorkersInput(input) === undefined
}

export function formatMaxWorkersForInput(maxWorkers: number | null | undefined): string {
  if (maxWorkers == null) return ''
  return String(maxWorkers)
}

/** Merge parsed worker cap into a study block when the user set a value. */
export function withMaxWorkers(study: StudyConfig, maxWorkersInput: string): StudyConfig {
  const max_workers = parseMaxWorkersInput(maxWorkersInput)
  if (max_workers === undefined) {
    return study
  }
  return { ...study, max_workers }
}
