import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FeatureLab } from '@/components/research/FeatureLab'
import { handlers } from '@/mocks/handlers'
import { mockRecommendedFeatureNames, resetMockFeatureState } from '@/mocks/features'
import { renderWithQueryClient } from '../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockFeatureState()
  navigateMock.mockClear()
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderFeatureLab(props: Partial<ComponentProps<typeof FeatureLab>> = {}) {
  const onEvalStarted = vi.fn()
  const onOpenRun = vi.fn()

  renderWithQueryClient(
    <FeatureLab recentRuns={[]} onEvalStarted={onEvalStarted} onOpenRun={onOpenRun} {...props} />,
  )

  return { onEvalStarted, onOpenRun }
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(screen.getByTestId('feature-lab-feature-rsi')).toBeInTheDocument()
  })

  await user.type(screen.getByLabelText('Symbol'), 'EURUSD')
  await user.click(screen.getByTestId('feature-lab-feature-rsi'))
  await user.click(screen.getByTestId('feature-lab-feature-ma'))

  await user.clear(screen.getByTestId('feature-lab-horizon'))
  await user.type(screen.getByTestId('feature-lab-horizon'), '5')
}

describe('FeatureLab', () => {
  it('disables Evaluate until a feature, target horizon, and window are set', async () => {
    renderFeatureLab()

    await waitFor(() => {
      expect(screen.getByTestId('feature-lab-evaluate')).toBeDisabled()
    })

    const user = userEvent.setup()
    await fillValidForm(user)

    await waitFor(() => {
      expect(screen.getByTestId('feature-lab-evaluate')).toBeEnabled()
    })
  })

  it('submits a correctly-shaped EvalRunRequest and routes to scoring with run_id', async () => {
    const user = userEvent.setup()
    const capturedBodies: unknown[] = []
    server.use(
      http.post('*/api/v1/feature-eval', async ({ request }) => {
        const body = await request.json()
        capturedBodies.push(body)
        return HttpResponse.json({ run_id: 'eval_test_route', status: 'pending' })
      }),
    )

    const { onEvalStarted } = renderFeatureLab()
    await fillValidForm(user)

    await waitFor(() => {
      expect(screen.getByTestId('feature-lab-evaluate')).toBeEnabled()
    })

    await user.click(screen.getByTestId('feature-lab-evaluate'))

    await waitFor(() => {
      expect(onEvalStarted).toHaveBeenCalledWith('eval_test_route', expect.any(String))
    })

    expect(capturedBodies).toHaveLength(1)
    expect(capturedBodies[0]).toMatchObject({
      symbol: 'EURUSD',
      timeframe: 'H1',
      target: { name: 'fwd_return', horizon: 5 },
      features: expect.arrayContaining([
        { name: 'rsi', version: 1 },
        { name: 'ma', version: 1 },
      ]),
    })
    expect((capturedBodies[0] as { start: string; end: string }).start).toBeTruthy()
    expect((capturedBodies[0] as { start: string; end: string }).end).toBeTruthy()
  })

  it('preselects exactly the recommended feature set', async () => {
    const user = userEvent.setup()
    renderFeatureLab()

    await waitFor(() => {
      expect(screen.getByTestId('feature-lab-recommended-only')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('feature-lab-recommended-only'))

    const selected = screen.getByTestId('feature-lab-selected-count')
    expect(selected).toHaveTextContent(mockRecommendedFeatureNames.sort().join(', '))
  })

  it('runs compare mode and shows both leaderboards', async () => {
    const user = userEvent.setup()
    let evalCount = 0
    server.use(
      http.post('*/api/v1/feature-eval', async () => {
        evalCount += 1
        return HttpResponse.json({
          run_id: `eval_compare_${evalCount}`,
          status: 'completed',
        })
      }),
      http.get('*/api/v1/feature-eval/:runId', ({ params }) => {
        const runId = String(params.runId)
        return HttpResponse.json({
          run_id: runId,
          status: 'completed',
          symbol: 'EURUSD',
          timeframe: 'H1',
          target_name: 'fwd_return',
          target_horizon: 5,
          feature_count: 2,
          leaderboard: [
            {
              feature_id: `${runId}.rsi`,
              feature_name: 'rsi',
              ic: 0.1,
              rank_ic: 0.12,
              mutual_info: 0.08,
              stability: 0.7,
              global_score: 0.7,
              cluster_id: 1,
              is_representative: true,
              leakage_status: 'clean',
              regime_ics: {},
            },
          ],
          clusters: [],
          heatmap: { metrics: ['ic'], rows: [] },
          result_summary: null,
          error_message: null,
        })
      }),
    )

    renderFeatureLab()
    await fillValidForm(user)

    await user.click(screen.getByTestId('feature-lab-save-set-a'))

    await user.click(screen.getByTestId('feature-lab-feature-macd'))
    await user.click(screen.getByTestId('feature-lab-save-set-b'))

    await user.click(screen.getByTestId('feature-lab-compare'))

    await waitFor(() => {
      expect(screen.getByTestId('feature-lab-compare-view')).toBeInTheDocument()
    })

    expect(screen.getByTestId('feature-lab-compare-run-eval_compare_1')).toBeInTheDocument()
    expect(screen.getByTestId('feature-lab-compare-run-eval_compare_2')).toBeInTheDocument()
    expect(screen.getAllByTestId('feature-leaderboard-panel')).toHaveLength(2)
  })
})
