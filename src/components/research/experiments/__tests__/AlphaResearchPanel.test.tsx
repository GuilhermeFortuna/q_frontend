import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { AlphaResearchPanel } from '@/components/research/experiments/AlphaResearchPanel'
import { handlers } from '@/mocks/handlers'
import { resetMockExperimentsState } from '@/mocks/experiments'
import type { AlphaResearchRequest } from '@/types/experiments'
import { renderWithQueryClient } from '../../../../../tests/unit/testUtils'

const navigateMock = vi.hoisted(() => vi.fn())
const setPendingBacktestConfig = vi.hoisted(() => vi.fn())
const setPendingOptimizationConfig = vi.hoisted(() => vi.fn())
const patchBacktestSession = vi.hoisted(() => vi.fn())
const patchOptimizeSession = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      setPendingBacktestConfig,
      setPendingOptimizationConfig,
      patchBacktestSession,
      patchOptimizeSession,
    }),
}))

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockExperimentsState()
  navigateMock.mockReset()
  setPendingBacktestConfig.mockReset()
  setPendingOptimizationConfig.mockReset()
  patchBacktestSession.mockReset()
  patchOptimizeSession.mockReset()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  server.resetHandlers()
})
afterAll(() => server.close())

async function launchAlphaResearch(
  user: ReturnType<typeof userEvent.setup>,
  profileLabel = 'CCM$ H1 swing',
) {
  await user.selectOptions(screen.getByTestId('alpha-profile-select'), profileLabel)
  await user.click(screen.getByTestId('alpha-submit-btn'))
  await waitFor(() => {
    expect(screen.getByTestId('alpha-running-state')).toBeInTheDocument()
  })
  await vi.advanceTimersByTimeAsync(2_600)
  await waitFor(() => {
    expect(screen.getByTestId('alpha-results')).toBeInTheDocument()
  })
}

describe('AlphaResearchPanel', () => {
  it('shows the empty-state CTA before any run is started', () => {
    renderWithQueryClient(<AlphaResearchPanel />)

    expect(screen.getByTestId('alpha-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('alpha-submit-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('alpha-running-state')).not.toBeInTheDocument()
    expect(screen.queryByTestId('alpha-results')).not.toBeInTheDocument()
  })

  it('submits the exact profile_id for each launch profile', async () => {
    const posted: AlphaResearchRequest[] = []
    server.use(
      http.post('*/api/v1/experiments/alpha-research', async ({ request }) => {
        const body = (await request.json()) as AlphaResearchRequest
        posted.push(body)
        return HttpResponse.json({ job_id: `ar_profile_${posted.length}`, status: 'queued' })
      }),
      http.get('*/api/v1/experiments/alpha-research/:jobId', () =>
        HttpResponse.json({
          job_id: 'ar_profile_done',
          status: 'completed',
          progress: 100,
          result: {
            verdict: 'ready_for_paper',
            profile_id: 'ccm_h1_swing',
            provenance: { optimization_seeds: [42], split_manifest_hash: 'x' },
            feature_evidence_summary: [],
            hypothesis_manifest: [],
            stages: [],
            inconclusive_reasons: [],
            coverage: { bar_count: 1 },
          },
        }),
      ),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    for (const [label, profileId] of [
      ['CCM$ H1 swing', 'ccm_h1_swing'],
      ['WIN$ H1 swing', 'win_h1_swing'],
      ['WDO$ M15 day trade', 'wdo_m15_day'],
    ] as const) {
      const { unmount } = renderWithQueryClient(<AlphaResearchPanel />)
      await user.selectOptions(screen.getByTestId('alpha-profile-select'), label)
      await user.click(screen.getByTestId('alpha-submit-btn'))
      await waitFor(() => {
        expect(posted.at(-1)?.profile_id).toBe(profileId)
      })
      unmount()
    }

    expect(posted.map((body) => body.profile_id)).toEqual([
      'ccm_h1_swing',
      'win_h1_swing',
      'wdo_m15_day',
    ])
  })

  it('renders ready_for_paper verdict with criterion evidence rows', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<AlphaResearchPanel />)

    await launchAlphaResearch(user, 'CCM$ H1 swing')

    expect(screen.getByTestId('alpha-verdict-badge')).toHaveTextContent('READY FOR PAPER TRADING')
    expect(screen.getByTestId('alpha-acceptance-criteria')).toBeInTheDocument()
    expect(screen.getByText('seed_robustness')).toBeInTheDocument()
    expect(screen.getByText('dsr')).toBeInTheDocument()
    expect(screen.getByTestId('alpha-lockbox-stats')).toBeInTheDocument()
    expect(screen.getByTestId('alpha-promote-backtest')).toBeInTheDocument()
  })

  it('renders rejected verdict without implying profitability', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<AlphaResearchPanel />)

    await launchAlphaResearch(user, 'WIN$ H1 swing')

    expect(screen.getByTestId('alpha-verdict-badge')).toHaveTextContent('REJECTED')
    expect(screen.queryByTestId('alpha-promote-backtest')).not.toBeInTheDocument()
    expect(screen.getByText('Only 2/5 seeds were positive.')).toBeInTheDocument()
  })

  it('renders zero-sample inconclusive copy instead of a no-effect verdict', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<AlphaResearchPanel />)

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2000-01-01' } })
    await user.selectOptions(screen.getByTestId('alpha-profile-select'), 'CCM$ H1 swing')
    await user.click(screen.getByTestId('alpha-submit-btn'))
    await vi.advanceTimersByTimeAsync(2_600)

    await waitFor(() => {
      expect(screen.getByTestId('alpha-verdict-badge')).toHaveTextContent(
        'INCONCLUSIVE — MORE/VALID DATA REQUIRED',
      )
    })
    expect(screen.getByTestId('alpha-inconclusive-reasons')).toHaveTextContent('0 bars')
    expect(screen.queryByText(/NO SIGNIFICANT EFFECT/i)).not.toBeInTheDocument()
    expect(screen.getByText('coverage')).toBeInTheDocument()
  })

  it('renders failed job detail from the backend', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<AlphaResearchPanel />)

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '1999-06-01' } })
    await user.click(screen.getByTestId('alpha-submit-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('alpha-error-state')).toHaveTextContent(
        /preflight continuity check failed/i,
      )
    })
    expect(screen.queryByTestId('alpha-results')).not.toBeInTheDocument()
  })

  it('preserves cancelled run detail from the backend', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<AlphaResearchPanel />)

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2019-03-01' } })
    await user.selectOptions(screen.getByTestId('alpha-profile-select'), 'WDO$ M15 day trade')
    await user.click(screen.getByTestId('alpha-submit-btn'))
    await vi.advanceTimersByTimeAsync(1_300)

    await waitFor(() => {
      expect(screen.getByTestId('alpha-error-state')).toHaveTextContent(/cancelled by operator/i)
    })
  })

  it('promotes the frozen champion into pending backtest and optimize sessions', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<AlphaResearchPanel />)

    await launchAlphaResearch(user, 'CCM$ H1 swing')

    await user.click(screen.getByTestId('alpha-promote-backtest'))
    expect(setPendingBacktestConfig).toHaveBeenCalledTimes(1)
    expect(patchBacktestSession).toHaveBeenCalledWith(
      expect.objectContaining({ workflowMode: 'backtest' }),
    )
    expect(navigateMock).toHaveBeenCalledWith({ to: '/backtests' })

    await user.click(screen.getByTestId('alpha-promote-optimize'))
    expect(setPendingOptimizationConfig).toHaveBeenCalledTimes(1)
    expect(patchOptimizeSession).toHaveBeenCalledWith(expect.objectContaining({ focus: 'setup' }))
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/backtests',
      search: { mode: 'optimize' },
    })
  })

  it('does not poll when the panel is inactive', async () => {
    const fetchSpy = vi.fn()
    server.use(
      http.get('*/api/v1/experiments/alpha-research/:jobId', ({ params }) => {
        fetchSpy()
        return HttpResponse.json({
          job_id: String(params.jobId),
          status: 'running',
          progress: 40,
          detail: 'still running',
          stages: [],
          result: null,
          error: null,
        })
      }),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { rerender } = renderWithQueryClient(<AlphaResearchPanel isActive />)

    await user.click(screen.getByTestId('alpha-submit-btn'))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const callsWhileActive = fetchSpy.mock.calls.length

    rerender(<AlphaResearchPanel isActive={false} />)
    await vi.advanceTimersByTimeAsync(5_000)

    expect(fetchSpy.mock.calls.length).toBe(callsWhileActive)
  })
})
