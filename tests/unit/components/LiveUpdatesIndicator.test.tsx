import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { LiveUpdatesIndicator } from '@/components/layout/LiveUpdatesIndicator'
import { JobStreamClient, type StreamStatus } from '@/lib/stream/client'
import { JobStreamProvider } from '@/lib/stream/JobStreamProvider'

function stubClient(status: StreamStatus): JobStreamClient {
  return {
    status: () => status,
    onStatus: (fn: (next: StreamStatus) => void) => {
      fn(status)
      return () => {}
    },
    retain: () => () => {},
    onJobEvent: () => () => {},
  } as unknown as JobStreamClient
}

function renderIndicator(status: StreamStatus) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JobStreamProvider, { client: stubClient(status), children }),
    )
  return render(createElement(LiveUpdatesIndicator), { wrapper })
}

describe('LiveUpdatesIndicator', () => {
  it('renders Live updates unavailable when the stream is unavailable', () => {
    renderIndicator('unavailable')
    expect(screen.getByText('Live updates unavailable')).toBeInTheDocument()
  })

  it.each(['live', 'connecting', 'disabled'] as const)(
    'renders nothing when status is %s',
    (status) => {
      const { container } = renderIndicator(status)
      expect(screen.queryByText('Live updates unavailable')).not.toBeInTheDocument()
      expect(container).toBeEmptyDOMElement()
    },
  )
})
