import { describe, expect, it, vi, afterEach } from 'vitest'

import type { JobSnapshotResponse } from '../../../../contracts/api'
import { backoffDelay, JobStreamClient, MAX_BACKOFF_MS } from '@/lib/stream/client'

class FakeSocket {
  url: string
  readyState = 0
  sent: string[] = []
  closed = false
  private listeners = new Map<string, Set<(event: { data?: string }) => void>>()

  constructor(url: string) {
    this.url = url
  }

  addEventListener(type: string, fn: (event: { data?: string }) => void) {
    const set = this.listeners.get(type) ?? new Set()
    set.add(fn)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, fn: (event: { data?: string }) => void) {
    this.listeners.get(type)?.delete(fn)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
    this.readyState = 3
    this.emit('close')
  }

  open() {
    this.readyState = 1
    this.emit('open')
  }

  deliver(data: string) {
    this.emit('message', { data })
  }

  private emit(type: string, event: { data?: string } = {}) {
    this.listeners.get(type)?.forEach((fn) => fn(event))
  }
}

const snapshot: JobSnapshotResponse = {
  jobs: [],
  watermark: { 'jobs.terminal': { epoch: 'e1', seq: 0 } },
}

const subscribed = JSON.stringify({
  type: 'subscribed',
  topics: {
    'jobs.terminal': { cursor: '0-0', epoch: 'e1', last_seq: 0 },
    'jobs.progress': { cursor: '0-0', epoch: 'e1', last_seq: 0 },
  },
})

function createClient(overrides?: {
  fetchSnapshot?: () => Promise<JobSnapshotResponse>
  fetchHistory?: () => Promise<{ topic: string; epoch: string; next_seq: null; entries: [] }>
}) {
  const sockets: FakeSocket[] = []
  const timers: Array<{ id: number; fn: () => void; ms: number }> = []
  let timerId = 1

  const fetchSnapshot = overrides?.fetchSnapshot ?? vi.fn(async () => snapshot)
  const fetchHistory =
    overrides?.fetchHistory ??
    vi.fn(async () => ({ topic: 'jobs.terminal', epoch: 'e1', next_seq: null, entries: [] }))

  const client = new JobStreamClient('ws://127.0.0.1:8000/api/v1/stream', {
    socketFactory: (url) => {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      return socket as unknown as WebSocket
    },
    fetchSnapshot,
    fetchHistory,
    now: () => 0,
    setTimer: (fn, ms) => {
      const id = timerId++
      timers.push({ id, fn, ms })
      return id
    },
    clearTimer: (handle) => {
      const index = timers.findIndex((t) => t.id === handle)
      if (index >= 0) timers.splice(index, 1)
    },
  })

  return { client, sockets, timers, fetchSnapshot, fetchHistory }
}

async function goLive(client: JobStreamClient, sockets: FakeSocket[]) {
  const release = client.retain()
  sockets[0].open()
  sockets[0].deliver(subscribed)
  await vi.waitFor(() => expect(client.status()).toBe('live'))
  return release
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('backoffDelay', () => {
  it('grows exponentially and never exceeds 30s', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const delays = Array.from({ length: 9 }, (_, attempt) => backoffDelay(attempt))
    expect(delays.every((ms) => ms <= MAX_BACKOFF_MS)).toBe(true)
    expect(delays[0]).toBe(500)
    expect(delays[1]).toBe(1000)
    expect(delays[5]).toBe(16_000)
    expect(delays.slice(6)).toEqual([30_000, 30_000, 30_000])
  })
})

describe('JobStreamClient', () => {
  it('opens one socket for two retains and closes it when both release', () => {
    const { client, sockets } = createClient()
    const first = client.retain()
    const second = client.retain()
    expect(sockets).toHaveLength(1)
    first()
    expect(sockets[0].closed).toBe(false)
    second()
    expect(sockets[0].closed).toBe(true)
  })

  it('sends subscribe before requesting the snapshot', async () => {
    const order: string[] = []
    let resolveSnapshot!: (value: JobSnapshotResponse) => void
    const fetchSnapshot = vi.fn(
      () =>
        new Promise<JobSnapshotResponse>((resolve) => {
          order.push('fetchSnapshot')
          resolveSnapshot = resolve
        }),
    )
    const { client, sockets } = createClient({ fetchSnapshot })
    client.retain()
    sockets[0].open()
    expect(JSON.parse(sockets[0].sent[0])).toEqual({
      topics: ['jobs.progress', 'jobs.terminal'],
    })
    expect(fetchSnapshot).not.toHaveBeenCalled()
    sockets[0].deliver(subscribed)
    await Promise.resolve()
    expect(order).toEqual(['fetchSnapshot'])
    resolveSnapshot(snapshot)
  })

  it('stays connecting until the snapshot resolves, then becomes live', async () => {
    let resolveSnapshot!: (value: JobSnapshotResponse) => void
    const fetchSnapshot = vi.fn(
      () =>
        new Promise<JobSnapshotResponse>((resolve) => {
          resolveSnapshot = resolve
        }),
    )
    const { client, sockets } = createClient({ fetchSnapshot })
    client.retain()
    expect(client.status()).toBe('connecting')
    sockets[0].open()
    sockets[0].deliver(subscribed)
    await Promise.resolve()
    expect(client.status()).toBe('connecting')
    resolveSnapshot(snapshot)
    await Promise.resolve()
    expect(client.status()).toBe('live')
  })

  it('sets unavailable on close and reconnects with capped backoff', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const { client, sockets, timers } = createClient()
    client.retain()
    sockets[0].open()

    const delays: number[] = []
    for (let attempt = 0; attempt < 9; attempt += 1) {
      sockets[attempt].close()
      expect(client.status()).toBe('unavailable')
      expect(timers).toHaveLength(1)
      delays.push(timers[0].ms)
      const fire = timers[0].fn
      timers.splice(0, 1)
      fire()
    }

    expect(delays.every((ms) => ms <= MAX_BACKOFF_MS)).toBe(true)
    expect(delays.slice(6).every((ms) => ms === MAX_BACKOFF_MS)).toBe(true)
    expect(sockets).toHaveLength(10)
  })

  it('re-sends subscribe and re-fetches the snapshot on resync', async () => {
    const { client, sockets, fetchSnapshot } = createClient()
    await goLive(client, sockets)
    expect(fetchSnapshot).toHaveBeenCalledTimes(1)

    sockets[0].deliver(
      JSON.stringify({ type: 'epoch_changed', topic: 'jobs.terminal', new_epoch: 'e2' }),
    )
    await vi.waitFor(() => expect(sockets[0].sent).toHaveLength(2))
    expect(JSON.parse(sockets[0].sent[1]!)).toEqual({
      topics: ['jobs.progress', 'jobs.terminal'],
    })

    sockets[0].deliver(subscribed)
    await vi.waitFor(() => expect(fetchSnapshot).toHaveBeenCalledTimes(2))
  })
})
