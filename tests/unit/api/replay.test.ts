import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { apiClient } from '@/api/client'
import {
  isReplayUnavailable,
  replayErrorMessage,
  replayOverviewPollMs,
  useReplayCommand,
  useReplayJournal,
} from '@/api/queries/replay'
import { handlers } from '@/mocks/handlers'
import { resetMockReplayState } from '@/mocks/replay'
import { createTestProviders, createTestQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockReplayState()
})
afterAll(() => server.close())

function wrapper() {
  return createTestProviders(createTestQueryClient())
}

describe('replay query helpers', () => {
  it('reports a 404 overview as unavailable rather than an error to retry', async () => {
    server.use(http.get('*/api/v1/replay/overview', () => new HttpResponse(null, { status: 404 })))
    const error = await apiClient.get('/api/v1/replay/overview').catch((caught: unknown) => caught)
    expect(isReplayUnavailable(error)).toBe(true)
  })

  it('uses the API message for a refusal', async () => {
    server.use(
      http.post('*/api/v1/replay/runs', () =>
        HttpResponse.json(
          { message: 'the replay stack is ready', code: 'stack_running' },
          { status: 409 },
        ),
      ),
    )
    const error = await apiClient.post('/api/v1/replay/runs', {}).catch((caught: unknown) => caught)
    expect(replayErrorMessage(error)).toBe('the replay stack is ready')
    expect(replayErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('polls faster while a stack exists', () => {
    expect(replayOverviewPollMs(undefined)).toBe(5000)
    expect(replayOverviewPollMs('idle')).toBe(5000)
    expect(replayOverviewPollMs('ready')).toBe(1000)
    expect(replayOverviewPollMs('starting')).toBe(1000)
  })
})

describe('useReplayCommand', () => {
  it('sends a fresh command_id and the expected revision on every command', async () => {
    const bodies: Array<Record<string, unknown>> = []
    server.use(
      http.post('*/api/v1/replay/runs/current/commands', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({
          command_id: bodies[bodies.length - 1].command_id,
          accepted: true,
          reason: null,
          revision: 1,
          state: 'running',
        })
      }),
    )
    const { result } = renderHook(() => useReplayCommand(), { wrapper: wrapper() })

    await act(async () => {
      await result.current.mutateAsync({ action: 'resume', expectedRevision: 0 })
      await result.current.mutateAsync({ action: 'resume', expectedRevision: 0 })
    })

    expect(bodies).toHaveLength(2)
    expect(bodies[0].command_id).not.toBe(bodies[1].command_id)
    expect(String(bodies[0].command_id)).toMatch(/^[0-9a-f-]{36}$/)
    expect(bodies[0]).toMatchObject({ action: 'resume', expected_revision: 0 })
    expect(bodies[0]).not.toHaveProperty('rate')
  })

  it('sends rate only for speed and market_ms only for step', async () => {
    const bodies: Array<Record<string, unknown>> = []
    server.use(
      http.post('*/api/v1/replay/runs/current/commands', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({
          command_id: 'x',
          accepted: true,
          reason: null,
          revision: 2,
          state: 'paused',
        })
      }),
    )
    const { result } = renderHook(() => useReplayCommand(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ action: 'speed', expectedRevision: 1, rate: 4 })
      await result.current.mutateAsync({ action: 'step', expectedRevision: 2, marketMs: 60000 })
    })
    expect(bodies[0]).toMatchObject({ action: 'speed', rate: 4 })
    expect(bodies[0]).not.toHaveProperty('market_ms')
    expect(bodies[1]).toMatchObject({ action: 'step', market_ms: 60000 })
    expect(bodies[1]).not.toHaveProperty('rate')
  })
})

describe('useReplayJournal', () => {
  it('accumulates journal pages in seq order for one generation', async () => {
    let calls = 0
    server.use(
      http.get('*/api/v1/replay/runs/current/journal', ({ request }) => {
        calls += 1
        const afterSeq = Number(new URL(request.url).searchParams.get('after_seq'))
        const entries = [0, 1, 2]
          .filter((seq) => seq > afterSeq)
          .map((seq) => ({
            seq,
            kind: 'command',
            market_time_utc: '2026-10-01T12:00:00Z',
            payload_hash: `sha256:${'0'.repeat(64)}`,
            payload: { action: 'resume' },
          }))
        return HttpResponse.json({ entries, next_after_seq: null })
      }),
    )
    const { result } = renderHook(() => useReplayJournal('gen-a', 60_000), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.rows.map((row) => row.seq)).toEqual([0, 1, 2]))
    expect(calls).toBeGreaterThanOrEqual(1)
    expect(result.current.error).toBeNull()
  })
})
