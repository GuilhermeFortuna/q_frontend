import { describe, expect, it } from 'vitest'

import { requiresTickData, resolveTickCoverage } from '@/lib/backtesting/tickCoverage'
import type { BacktestRequest } from '@/types/backtesting'

const request = (overrides: Partial<BacktestRequest> = {}): BacktestRequest =>
  ({
    symbol: 'WSP$N',
    start: '2021-01-01T03:00:00.000Z',
    end: '2021-12-31T23:59:59.999Z',
    exit_params: { breakeven_trigger_pct: 1 },
    ...overrides,
  }) as BacktestRequest

const ticks = { start: '2021-10-20T09:00:00-03:00', end: '2021-12-20T18:00:00-03:00' }

describe('tickCoverage', () => {
  it('requires ticks for the tick engine or an enabled breakeven stop only', () => {
    expect(requiresTickData(request())).toBe(true)
    expect(requiresTickData(request({ engine: 'tick', exit_params: {} }))).toBe(true)
    expect(requiresTickData(request({ exit_params: { breakeven_trigger_pct: 0 } }))).toBe(false)
  })

  it('leaves requests that need no ticks untouched', () => {
    expect(resolveTickCoverage(request({ exit_params: {} }), ticks).status).toBe('unneeded')
  })

  it('does not intervene without a tick inventory entry', () => {
    expect(resolveTickCoverage(request(), undefined).status).toBe('unknown')
  })

  it('reports a covered period', () => {
    const covered = request({
      start: '2021-11-01T03:00:00.000Z',
      end: '2021-12-01T00:00:00.000Z',
    })
    expect(resolveTickCoverage(covered, ticks).status).toBe('covered')
  })

  it('does not count the future part of today as missing history', () => {
    const now = Date.parse('2021-12-20T15:30:00-03:00')
    const endOfToday = request({
      start: '2021-11-01T03:00:00.000Z',
      end: '2021-12-21T02:59:59.999Z',
    })
    expect(resolveTickCoverage(endOfToday, ticks, now).status).toBe('covered')
  })

  it('clamps both ends to the tick envelope', () => {
    const result = resolveTickCoverage(request(), ticks)
    expect(result).toMatchObject({
      status: 'clamped',
      used: { start: '2021-10-20T12:00:00.000Z', end: '2021-12-20T21:00:00.000Z' },
    })
  })

  it('falls back to the whole tick period when the selection is disjoint', () => {
    const early = request({ start: '2020-01-01T00:00:00.000Z', end: '2020-02-01T00:00:00.000Z' })
    expect(resolveTickCoverage(early, ticks)).toMatchObject({
      status: 'clamped',
      used: { start: '2021-10-20T12:00:00.000Z', end: '2021-12-20T21:00:00.000Z' },
    })
  })
})
