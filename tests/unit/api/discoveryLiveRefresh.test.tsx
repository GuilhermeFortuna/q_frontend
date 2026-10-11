import { act, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { useDiscoveryTrials, useStrategySearchResults } from '@/api/queries/strategySearch'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: { get } }))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

it('refreshes candidate and filtered trial results every two seconds and stops on completion', async () => {
  vi.useFakeTimers()
  let count = 0
  get.mockImplementation(async (url: string) => ({
    data: url.endsWith('/trials')
      ? { items: [], total: count, limit: 100, offset: 0 }
      : { candidates: Array.from({ length: count }, () => ({})), status: 'running' },
  }))
  function View({ running }: { running: boolean }) {
    const candidates = useStrategySearchResults('run', true, running)
    const trials = useDiscoveryTrials('run', { candidate_id: 'A' }, running)
    return (
      <p>
        {candidates.data?.candidates.length ?? 0} candidates · {trials.data?.total ?? 0} trials
      </p>
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrap = (running: boolean) => (
    <QueryClientProvider client={client}>
      <View running={running} />
    </QueryClientProvider>
  )
  const view = render(wrap(true))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10)
  })
  expect(screen.getByText('0 candidates · 0 trials')).toBeInTheDocument()
  count = 2
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100)
  })
  expect(screen.getByText('2 candidates · 2 trials')).toBeInTheDocument()
  expect(get).toHaveBeenCalledWith('/api/v1/strategy-search/run/trials', {
    params: { candidate_id: 'A' },
  })
  count = 3
  view.rerender(wrap(false))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10)
  })
  expect(screen.getByText('3 candidates · 3 trials')).toBeInTheDocument()
  const calls = get.mock.calls.length
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000)
  })
  expect(get.mock.calls.length).toBe(calls)
  client.clear()
})
