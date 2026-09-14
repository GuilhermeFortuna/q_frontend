import type { SystemHealthResponse } from '../../../contracts/api'

export type BackendConnection =
  | { state: 'mocked' }
  | { state: 'connected'; health: SystemHealthResponse }
  | { state: 'degraded'; health: SystemHealthResponse; failing: Array<'postgres' | 'redis'> }
  | { state: 'offline'; apiBaseUrl: string; nextRetryMs: number; since: number }

export const BACKEND_START_COMMAND = 'systemctl --user start q-backend.target'

export function retryDelayMs(attempt: number): number {
  return Math.min(30_000, 1000 * Math.pow(2, Math.max(0, attempt)))
}

export function classifyHealth(health: SystemHealthResponse): BackendConnection {
  const failing: Array<'postgres' | 'redis'> = []
  if (health.storageStatus?.postgres?.status === 'error') {
    failing.push('postgres')
  }
  if (health.storageStatus?.redis?.status === 'error') {
    failing.push('redis')
  }
  if (failing.length > 0) {
    return {
      state: 'degraded',
      health,
      failing,
    }
  }
  return {
    state: 'connected',
    health,
  }
}
