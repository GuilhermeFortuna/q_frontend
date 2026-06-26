import { setupServer } from 'msw/node'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FeatureScoringDashboard } from '@/components/research/FeatureScoringDashboard'
import { recommendedFeatureIds } from '@/components/research/featureScoringUtils'
import { handlers } from '@/mocks/handlers'
import {
  MOCK_COMPLETED_EVAL_RUN_ID,
  MOCK_RUNNING_EVAL_RUN_ID,
  mockRecentEvalRuns,
  resetMockFeatureState,
} from '@/mocks/features'
import { renderWithQueryClient } from '../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockFeatureState()
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const runOptions = mockRecentEvalRuns.map((run) => ({
  runId: run.run_id,
  label: run.label,
}))

function renderDashboard(props: Partial<ComponentProps<typeof FeatureScoringDashboard>> = {}) {
  const onSourceChange = vi.fn()
  const onRunIdChange = vi.fn()
  const onGoToLab = vi.fn()

  renderWithQueryClient(
    <FeatureScoringDashboard
      source="eval"
      runId={MOCK_COMPLETED_EVAL_RUN_ID}
      onSourceChange={onSourceChange}
      onRunIdChange={onRunIdChange}
      runOptions={runOptions}
      onGoToLab={onGoToLab}
      {...props}
    />,
  )

  return { onSourceChange, onRunIdChange, onGoToLab }
}

function leaderboardRowNames(): string[] {
  return screen
    .getAllByTestId(/feature-leaderboard-row-/)
    .map((row) => row.getAttribute('data-testid')?.replace('feature-leaderboard-row-', '') ?? '')
}

function recommendedClusterIds(
  run: { leaderboard: Array<{ feature_id: string; cluster_id: number | null }> },
  ids: string[],
) {
  return ids.map((featureId) => {
    const row = run.leaderboard.find((entry) => entry.feature_id === featureId)
    return row?.cluster_id
  })
}

describe('FeatureScoringDashboard', () => {
  it('renders the leaderboard sorted by global_score', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('feature-scoring-dashboard')).toBeInTheDocument()
    })

    expect(leaderboardRowNames()).toEqual(['rsi', 'ma', 'macd', 'leaky_signal'])
  })

  it('shows the leakage badge for a suspect fixture feature', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('feature-leaderboard-row-leaky_signal')).toBeInTheDocument()
    })

    const leakyRow = screen.getByTestId('feature-leaderboard-row-leaky_signal')
    expect(within(leakyRow).getByTestId('feature-leaderboard-leakage-badge')).toHaveTextContent(
      'suspect',
    )
  })

  it('renders heatmap cells for each feature and metric', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('feature-metric-heatmap')).toBeInTheDocument()
    })

    expect(screen.getByTestId('heatmap-cell-rsi-ic')).toBeInTheDocument()
    expect(screen.getByTestId('heatmap-cell-rsi-rank_ic')).toBeInTheDocument()
    expect(screen.getByTestId('heatmap-cell-rsi-mutual_info')).toBeInTheDocument()
    expect(screen.getByTestId('heatmap-cell-rsi-stability')).toBeInTheDocument()
    expect(screen.getByTestId('heatmap-cell-leaky_signal-stability')).toBeInTheDocument()
  })

  it('marks cluster representatives and keeps the recommended set one-per-cluster', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('redundancy-cluster-panel')).toBeInTheDocument()
    })

    expect(screen.getByTestId('cluster-representative-rsi')).toBeInTheDocument()
    expect(screen.getByTestId('cluster-representative-ma')).toBeInTheDocument()
    expect(screen.getByTestId('cluster-representative-leaky_signal')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('feature-recommended-set-panel')).toBeInTheDocument()
    })

    const recommendedNodes = screen.getAllByTestId(/^recommended-feature-/)
    const recommendedNames = recommendedNodes.map((node) =>
      node.getAttribute('data-testid')?.replace('recommended-feature-', ''),
    )
    expect(recommendedNames).toEqual(expect.arrayContaining(['rsi', 'ma', 'leaky_signal']))
    expect(recommendedNames).not.toContain('macd')

    const response = await fetch(`/api/v1/feature-eval/${MOCK_COMPLETED_EVAL_RUN_ID}`)
    const run = await response.json()
    const recommendedIds = recommendedFeatureIds(run)
    const clusterIds = recommendedClusterIds(run, recommendedIds)
    expect(new Set(clusterIds).size).toBe(clusterIds.length)
  })

  it('renders partial panels for a running evaluation without the empty state', async () => {
    renderDashboard({ runId: MOCK_RUNNING_EVAL_RUN_ID })

    await waitFor(() => {
      expect(screen.getByTestId('feature-scoring-live-badge')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('feature-scoring-empty')).not.toBeInTheDocument()
    expect(screen.getByTestId('feature-leaderboard-panel')).toBeInTheDocument()
    expect(screen.getByTestId('feature-metric-heatmap')).toBeInTheDocument()
    expect(screen.queryByTestId('redundancy-cluster-panel')).toBeInTheDocument()
  })

  it('shows the Feature Lab pointer when runId is empty', async () => {
    const user = userEvent.setup()
    const onGoToLab = vi.fn()

    renderWithQueryClient(
      <FeatureScoringDashboard
        source="eval"
        runId={null}
        onSourceChange={vi.fn()}
        onRunIdChange={vi.fn()}
        runOptions={runOptions}
        onGoToLab={onGoToLab}
      />,
    )

    expect(screen.getByTestId('feature-scoring-empty')).toBeInTheDocument()
    expect(screen.getByText(/Run a feature evaluation in the Feature Lab/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open Feature Lab' }))
    expect(onGoToLab).toHaveBeenCalled()
  })

  it('opens the passport drill-in when a leaderboard row is clicked', async () => {
    const user = userEvent.setup()
    const onSelectFeature = vi.fn()

    renderDashboard({ onSelectFeature })

    await waitFor(() => {
      expect(screen.getByTestId('feature-leaderboard-row-rsi')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('feature-leaderboard-row-rsi'))
    expect(onSelectFeature).toHaveBeenCalledWith('rsi')
  })
})
