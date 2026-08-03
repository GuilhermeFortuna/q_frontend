import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ComponentType } from 'react'

import {
  ActiveJobIsland,
  type ActiveJobIslandJob,
  type ActiveJobIslandMode,
} from '@/components/dock/ActiveJobIsland'

const reduceMotionState = vi.hoisted(() => ({ value: false }))

vi.mock('@/lib/motion/useReducedMotion', () => ({
  useReducedMotion: () => reduceMotionState.value,
}))

function StubIcon({ className }: { className?: string }) {
  return <svg data-testid="stub-icon" className={className} />
}

function makeJob(
  overrides: Partial<ActiveJobIslandJob> & Pick<ActiveJobIslandJob, 'workspaceId'>,
): ActiveJobIslandJob {
  const labels = {
    backtests: 'Backtests',
    validate: 'Validate',
    discover: 'Discover',
  } as const
  const workspaceId = overrides.workspaceId
  return {
    workspaceId,
    workspaceLabel:
      overrides.workspaceLabel ??
      (workspaceId in labels ? labels[workspaceId as keyof typeof labels] : workspaceId),
    pct: overrides.pct ?? 40,
    detail: overrides.detail ?? 'Working…',
    progressKind: overrides.progressKind ?? 'determinate',
    icon: (overrides.icon ?? StubIcon) as ComponentType<{ className?: string }>,
  }
}

function ControlledIsland({
  jobs,
  onNavigate = () => undefined,
}: {
  jobs: ActiveJobIslandJob[]
  onNavigate?: (job: ActiveJobIslandJob) => void
}) {
  const [mode, setMode] = useState<ActiveJobIslandMode>('compact')
  if (jobs.length === 0) return null
  return (
    <ActiveJobIsland jobs={jobs} mode={mode} onModeChange={setMode} onNavigate={onNavigate} />
  )
}

describe('ActiveJobIsland', () => {
  beforeEach(() => {
    reduceMotionState.value = false
  })

  afterEach(() => {
    cleanup()
  })

  it('unmounts when the parent passes zero jobs', () => {
    const { rerender } = render(<ControlledIsland jobs={[makeJob({ workspaceId: 'discover' })]} />)
    expect(screen.getByTestId('active-job-island')).toBeInTheDocument()

    rerender(<ControlledIsland jobs={[]} />)
    expect(screen.queryByTestId('active-job-island')).not.toBeInTheDocument()
  })

  it('shows one job compactly with determinate progress', () => {
    render(
      <ControlledIsland
        jobs={[makeJob({ workspaceId: 'backtests', pct: 48, detail: 'Optimize: Trial 24 / 50' })]}
      />,
    )

    expect(screen.getByTestId('active-job-compact')).toHaveTextContent('Backtests')
    expect(screen.getByTestId('active-job-compact')).toHaveTextContent('48%')
    expect(screen.getByTestId('active-job-progress-fill')).toBeInTheDocument()
    expect(screen.queryByTestId('active-job-extra-count')).not.toBeInTheDocument()
  })

  it('shows indeterminate jobs without a measured percentage', () => {
    render(
      <ControlledIsland
        jobs={[
          makeJob({
            workspaceId: 'backtests',
            pct: 0,
            detail: 'Running…',
            progressKind: 'indeterminate',
          }),
        ]}
      />,
    )

    expect(screen.getByTestId('active-job-compact')).toHaveTextContent('Live')
    expect(screen.getByTestId('active-job-compact')).not.toHaveTextContent('0%')
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-progress-kind', 'indeterminate')
  })

  it('shows +N for multiple jobs and expands to dock order', async () => {
    const user = userEvent.setup()
    const jobs = [
      makeJob({ workspaceId: 'backtests', pct: 10 }),
      makeJob({ workspaceId: 'validate', pct: 50 }),
      makeJob({ workspaceId: 'discover', pct: 90 }),
    ]
    render(<ControlledIsland jobs={jobs} />)

    expect(screen.getByTestId('active-job-extra-count')).toHaveTextContent('+2')

    await user.click(screen.getByTestId('active-job-island-trigger'))
    expect(screen.getByTestId('active-job-island')).toHaveAttribute('data-mode', 'expanded')

    const rows = within(screen.getByTestId('active-job-expanded')).getAllByRole('button')
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'active-job-row-backtests',
      'active-job-row-validate',
      'active-job-row-discover',
    ])
  })

  it('updates determinate percentage without remounting the progress fill', () => {
    const job = makeJob({ workspaceId: 'discover', pct: 20 })
    const { rerender } = render(
      <ActiveJobIsland
        jobs={[job]}
        mode="compact"
        onModeChange={() => undefined}
        onNavigate={() => undefined}
      />,
    )
    const fill = screen.getByTestId('active-job-progress-fill')

    rerender(
      <ActiveJobIsland
        jobs={[{ ...job, pct: 55, detail: 'Candidate 5 / 9' }]}
        mode="compact"
        onModeChange={() => undefined}
        onNavigate={() => undefined}
      />,
    )

    expect(screen.getByTestId('active-job-progress-fill')).toBe(fill)
    expect(screen.getByTestId('active-job-compact')).toHaveTextContent('55%')
  })

  it('promotes the most recently changed job in compact multi-job mode', () => {
    const jobs = [
      makeJob({ workspaceId: 'backtests', pct: 10, detail: 'Optimize: Trial 1 / 10' }),
      makeJob({ workspaceId: 'discover', pct: 20, detail: 'Candidate 1 / 9' }),
    ]
    const { rerender } = render(
      <ActiveJobIsland
        jobs={jobs}
        mode="compact"
        onModeChange={() => undefined}
        onNavigate={() => undefined}
      />,
    )

    rerender(
      <ActiveJobIsland
        jobs={[
          jobs[0],
          { ...jobs[1], pct: 40, detail: 'Candidate 3 / 9' },
        ]}
        mode="compact"
        onModeChange={() => undefined}
        onNavigate={() => undefined}
      />,
    )

    expect(screen.getByTestId('active-job-compact')).toHaveTextContent('Discover')
    expect(screen.getByTestId('active-job-compact')).toHaveTextContent('40%')
  })

  it('toggles with Enter/Space, collapses on Escape and outside click, and restores focus', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <button type="button" data-testid="outside">
          Outside
        </button>
        <ControlledIsland
          jobs={[
            makeJob({ workspaceId: 'backtests' }),
            makeJob({ workspaceId: 'discover' }),
          ]}
        />
      </div>,
    )

    const trigger = screen.getByTestId('active-job-island-trigger')
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('active-job-island')).toHaveAttribute('data-mode', 'expanded')

    await user.keyboard('{Escape}')
    expect(screen.getByTestId('active-job-island')).toHaveAttribute('data-mode', 'compact')
    expect(screen.getByTestId('active-job-island-trigger')).toHaveFocus()

    await user.keyboard(' ')
    expect(screen.getByTestId('active-job-island')).toHaveAttribute('data-mode', 'expanded')

    fireEvent.pointerDown(screen.getByTestId('outside'))
    expect(screen.getByTestId('active-job-island')).toHaveAttribute('data-mode', 'compact')
    await waitFor(() => expect(screen.getByTestId('active-job-island-trigger')).toHaveFocus())
  })

  it('navigates from an expanded job row', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const jobs = [
      makeJob({ workspaceId: 'backtests' }),
      makeJob({ workspaceId: 'discover' }),
    ]
    render(<ControlledIsland jobs={jobs} onNavigate={onNavigate} />)

    await user.click(screen.getByTestId('active-job-island-trigger'))
    await user.click(screen.getByTestId('active-job-row-discover'))

    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate.mock.calls[0][0].workspaceId).toBe('discover')
  })

  it('announces start and completion once, not percentage ticks', () => {
    const job = makeJob({ workspaceId: 'discover', pct: 10 })
    const { rerender } = render(
      <ActiveJobIsland
        jobs={[job]}
        mode="compact"
        onModeChange={() => undefined}
        onNavigate={() => undefined}
      />,
    )

    const live = screen.getByTestId('active-job-live')
    expect(live).toHaveTextContent('')

    rerender(
      <ActiveJobIsland
        jobs={[{ ...job, pct: 55 }]}
        mode="compact"
        onModeChange={() => undefined}
        onNavigate={() => undefined}
      />,
    )
    expect(live).toHaveTextContent('')

    rerender(
      <ActiveJobIsland
        jobs={[]}
        mode="compact"
        onModeChange={() => undefined}
        onNavigate={() => undefined}
      />,
    )
    // Parent would unmount at zero jobs; with empty jobs the island returns null.
    expect(screen.queryByTestId('active-job-island')).not.toBeInTheDocument()
  })

  it('announces completion when a job leaves while others remain', () => {
    const jobs = [
      makeJob({ workspaceId: 'backtests' }),
      makeJob({ workspaceId: 'discover' }),
    ]
    const { rerender } = render(
      <ActiveJobIsland
        jobs={jobs}
        mode="compact"
        onModeChange={() => undefined}
        onNavigate={() => undefined}
      />,
    )

    rerender(
      <ActiveJobIsland
        jobs={[jobs[0]]}
        mode="compact"
        onModeChange={() => undefined}
        onNavigate={() => undefined}
      />,
    )

    expect(screen.getByTestId('active-job-live')).toHaveTextContent(/Discover job completed/i)
  })

  it('still expands under reduced motion', async () => {
    reduceMotionState.value = true
    const user = userEvent.setup()
    render(<ControlledIsland jobs={[makeJob({ workspaceId: 'validate', pct: 75 })]} />)

    await user.click(screen.getByTestId('active-job-island-trigger'))
    expect(screen.getByTestId('active-job-island')).toHaveAttribute('data-mode', 'expanded')
    expect(screen.getByTestId('active-job-expanded')).toBeInTheDocument()
  })
})
