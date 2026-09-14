import { describe, expect, it } from 'vitest'
import type { SystemHealthResponse } from '../../../../contracts/api'
import { BACKEND_START_COMMAND, classifyHealth, retryDelayMs } from '@/lib/backend/connectionStatus'

describe('retryDelayMs', () => {
  it('returns exponential backoff capped at 30_000 ms for attempts 0 to 6', () => {
    const attempts = [0, 1, 2, 3, 4, 5, 6]
    const delays = attempts.map(retryDelayMs)
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000])
  })
})

describe('classifyHealth', () => {
  const baseHealth: SystemHealthResponse = {
    active_provider: 'mt5',
    backendVersion: '0.1.0',
    dataLakeStatus: 'healthy',
    lastSyncAt: '2026-09-14T10:00:00Z',
    market_data_inventory_count: 10,
    market_data_root: '/data',
    mt5_available: false,
    status: 'degraded',
    storageStatus: {
      postgres: { status: 'ok', error: null },
      redis: { status: 'ok', error: null },
    },
  }

  it('gives connected when both stores are ok even if top-level status is degraded', () => {
    const result = classifyHealth(baseHealth)
    expect(result).toEqual({
      state: 'connected',
      health: baseHealth,
    })
  })

  it('gives degraded with failing: [redis] when redis is in error', () => {
    const health: SystemHealthResponse = {
      ...baseHealth,
      storageStatus: {
        postgres: { status: 'ok', error: null },
        redis: { status: 'error', error: 'Connection refused' },
      },
    }
    const result = classifyHealth(health)
    expect(result).toEqual({
      state: 'degraded',
      health,
      failing: ['redis'],
    })
  })

  it('gives degraded with failing: [postgres, redis] when both are in error', () => {
    const health: SystemHealthResponse = {
      ...baseHealth,
      storageStatus: {
        postgres: { status: 'error', error: 'PG down' },
        redis: { status: 'error', error: 'Redis down' },
      },
    }
    const result = classifyHealth(health)
    expect(result).toEqual({
      state: 'degraded',
      health,
      failing: ['postgres', 'redis'],
    })
  })

  it('exposes BACKEND_START_COMMAND constant', () => {
    expect(BACKEND_START_COMMAND).toBe('systemctl --user start q-backend.target')
  })
})
