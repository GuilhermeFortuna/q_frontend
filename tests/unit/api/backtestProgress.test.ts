import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse, delay } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { useBacktestJob, useBacktestJobStatus } from '@/api/queries/backtests'
import { getMockBacktestResponse } from '@/mocks/backtest'
import { useAppStore } from '@/store/useAppStore'
import type { BacktestRequest } from '@/types/backtesting'
import { createTestProviders, createTestQueryClient } from '../testUtils'
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
describe('backtest progress delivery', () => {
  it('delivers optional telemetry, retains it through fallback/navigation, and obeys terminal status', async () => {
    let body: Record<string, unknown> = {
      run_id: 'bt-1',
      status: 'running',
      phase: 'simulating',
      progress: 0.4,
      updated_at: '2026-10-12T07:15:00Z',
      candles_replayed: 12,
      activity: { kind: 'reading_ticks', started_at: '2026-10-12T07:15:00Z' },
      phase_history: [{ phase: 'simulating', started_at: '2026-10-12T07:14:00Z' }],
    }
    server.use(http.get('*/api/v1/backtest/bt-1', () => HttpResponse.json(body)))
    const queryClient = createTestQueryClient()
    const wrapper = createTestProviders(queryClient)
    const first = renderHook(() => useBacktestJobStatus('bt-1'), { wrapper })
    await waitFor(() => expect(first.result.current.data?.activity?.kind).toBe('reading_ticks'))
    expect(first.result.current.data?.phase_history?.[0].phase).toBe('simulating')
    const observedAt = first.result.current.data?.updateObservedAt
    body = { run_id: 'bt-1', status: 'running', phase: null, progress: null, activity: null }
    await act(async () => {
      await first.result.current.refetch()
    })
    expect(first.result.current.data?.progress).toBe(0.4)
    await waitFor(() => expect(first.result.current.data?.telemetryUnavailable).toBe(true))
    first.unmount()
    const resumed = renderHook(() => useBacktestJobStatus('bt-1'), { wrapper })
    await waitFor(() => expect(resumed.result.current.isFetching).toBe(false))
    expect(resumed.result.current.data?.updateObservedAt).toBe(observedAt)
    expect(resumed.result.current.data?.activity?.kind).toBe('reading_ticks')
    body = { run_id: 'bt-1', status: 'failed', error: 'Read failed' }
    await act(async () => {
      await resumed.result.current.refetch()
    })
    await waitFor(() => expect(resumed.result.current.data?.status).toBe('failed'))
    expect(resumed.result.current.data?.activity).toBeUndefined()
    resumed.unmount()
    queryClient.clear()
  })
  it('refreshes progress and results when resubmitting a configuration with the same run ID', async () => {
    let running = false
    let generation = 1
    const runId = 'repeat-run'
    const fixture = getMockBacktestResponse({
      symbol: 'WSP$',
      strategy: 'MACrossover',
      timeframe: 'H1',
    } as BacktestRequest)
    useAppStore.getState().patchBacktestSession({ runId, workflowMode: 'backtest' })
    server.use(
      http.get('*/api/v1/backtest/repeat-run', () =>
        HttpResponse.json({
          run_id: runId,
          status: running ? 'running' : 'completed',
          phase: running ? 'simulating' : null,
          progress: running ? 0.4 : null,
        }),
      ),
      http.get('*/api/v1/backtest/repeat-run/result', () =>
        HttpResponse.json({
          run_id: runId,
          metrics: { ...fixture.metrics, total_pnl: generation },
          trades: [],
          bars: [],
          indicators: [],
        }),
      ),
      http.post('*/api/v1/backtest', async () => {
        await delay(50)
        running = true
        return HttpResponse.json({ run_id: runId, status: 'running' })
      }),
    )
    const queryClient = createTestQueryClient()
    const { result, unmount } = renderHook(() => useBacktestJob(), {
      wrapper: createTestProviders(queryClient),
    })
    await waitFor(() => expect(result.current.data?.metrics.total_pnl).toBe(1))
    act(() => result.current.mutate({ symbol: 'WSP$', strategy: 'MACrossover' } as BacktestRequest))
    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(result.current.runStatus).toBeUndefined()
    await waitFor(() => expect(result.current.runStatus?.phase).toBe('simulating'))
    expect(result.current.data).toBeUndefined()
    running = false
    generation = 2
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['backtests', 'job-status', runId] })
    })
    await waitFor(() => expect(result.current.data?.metrics.total_pnl).toBe(2))
    unmount()
    queryClient.clear()
    useAppStore.getState().patchBacktestSession({ runId: null })
  })
})
