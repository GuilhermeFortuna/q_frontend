import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { createElement, type ReactElement, type ReactNode } from 'react'

import { JobStreamClient } from '@/lib/stream/client'
import { JobStreamProvider } from '@/lib/stream/JobStreamProvider'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

export function createDisabledJobStreamClient() {
  return new JobStreamClient('', {
    socketFactory: () => {
      throw new Error('stream sockets are disabled in unit tests')
    },
    fetchSnapshot: async () => ({ jobs: [], watermark: {} }),
    fetchHistory: async () => ({ topic: 'jobs.terminal', epoch: 'e', next_seq: null, entries: [] }),
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>)
    },
  })
}

export function createTestProviders(
  queryClient: QueryClient,
  streamClient: JobStreamClient = createDisabledJobStreamClient(),
) {
  return function TestProviders({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JobStreamProvider, { client: streamClient, children }),
    )
  }
}

export function renderWithQueryClient(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  const queryClient = createTestQueryClient()
  const Wrapper = createTestProviders(queryClient)

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...options }),
  }
}
