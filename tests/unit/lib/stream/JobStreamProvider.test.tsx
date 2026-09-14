import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { JobStreamClient } from '@/lib/stream/client'
import { JobStreamProvider, useJobStream, useStreamStatus } from '@/lib/stream/JobStreamProvider'

const envState = vi.hoisted(() => ({
  apiBaseUrl: 'http://127.0.0.1:8000',
  enableMsw: false,
  enableStream: true,
  isDev: false,
  perfHud: false,
  sentryDsn: '',
  sentryEnvironment: 'local',
  sentryTracesSampleRate: 0.2,
  sentryRelease: '',
}))

vi.mock('@/lib/env', () => ({ env: envState }))

class FakeSocket {
  url: string
  readyState = 0
  closed = false
  sent: string[] = []
  private listeners = new Map<string, Set<() => void>>()

  constructor(url: string) {
    this.url = url
  }

  addEventListener(type: string, fn: () => void) {
    const set = this.listeners.get(type) ?? new Set()
    set.add(fn)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
    this.readyState = 3
    this.listeners.get('close')?.forEach((fn) => fn())
  }
}

function renderWithProviders(ui: ReactNode, client?: JobStreamClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JobStreamProvider, { client, children: ui }),
    ),
  )
}

function StatusProbe() {
  const status = useStreamStatus()
  useJobStream()
  return createElement('div', null, status)
}

function RetainProbe({ label }: { label: string }) {
  useJobStream()
  return createElement('div', null, label)
}

afterEach(() => {
  envState.enableMsw = false
  envState.enableStream = true
})

describe('JobStreamProvider', () => {
  it('disables the stream in mock mode and never opens a socket', () => {
    envState.enableMsw = true
    envState.enableStream = false
    const WebSocketSpy = vi.fn()
    vi.stubGlobal('WebSocket', WebSocketSpy)

    renderWithProviders(createElement(StatusProbe))

    expect(screen.getByText('disabled')).toBeInTheDocument()
    expect(WebSocketSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('shares one socket across two useJobStream mounts and closes it when both unmount', () => {
    const sockets: FakeSocket[] = []
    const client = new JobStreamClient('ws://127.0.0.1:8000/api/v1/stream', {
      socketFactory: (url) => {
        const socket = new FakeSocket(url)
        sockets.push(socket)
        return socket as unknown as WebSocket
      },
      fetchSnapshot: async () => ({ jobs: [], watermark: {} }),
      fetchHistory: async () => ({
        topic: 'jobs.terminal',
        epoch: 'e',
        next_seq: null,
        entries: [],
      }),
      now: () => 0,
      setTimer: () => 1,
      clearTimer: () => {},
    })

    const { unmount } = renderWithProviders(
      createElement(
        'div',
        null,
        createElement(RetainProbe, { label: 'one' }),
        createElement(RetainProbe, { label: 'two' }),
      ),
      client,
    )

    expect(sockets).toHaveLength(1)
    unmount()
    expect(sockets[0].closed).toBe(true)
  })
})
