import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { ActiveJobsMap } from '@/hooks/useActiveJobs'

const navigate = vi.fn()
const runWorkspaceTransition = vi.fn(async (options: { commit: () => void }) => {
  options.commit()
})

const activeJobsState = vi.hoisted(() => ({
  value: {} as ActiveJobsMap,
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: unknown; to: string }) => <a href={to}>{children as never}</a>,
}))

vi.mock('@/hooks/useActiveJobs', () => ({
  useActiveJobs: () => activeJobsState.value,
}))

vi.mock('@/components/transitions/workspaceTransitionStore', () => ({
  useWorkspaceTransitionStore: (
    selector: (state: { runWorkspaceTransition: typeof runWorkspaceTransition }) => unknown,
  ) => selector({ runWorkspaceTransition }),
}))

vi.mock('@/app/router', () => ({
  workspaceTransitionDirection: (from: string, to: string) => {
    if (from === to) return null
    return 'forward'
  },
}))

vi.mock('@/lib/motion/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

import { AppDock } from '@/components/dock/AppDock'

describe('AppDock active job island', () => {
  beforeEach(() => {
    activeJobsState.value = {}
    navigate.mockReset()
    runWorkspaceTransition.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render the legacy runningJobs GlowCard rail', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/dock/AppDock.tsx'), 'utf8')
    expect(source).toContain('ActiveJobIsland')
    expect(source).not.toContain('GlowCard')
    expect(source).not.toContain('dock-jobs')
    expect(source).not.toMatch(/runningJobs\.map/)
  })

  it('keeps the island unmounted when there are no active jobs', () => {
    render(<AppDock activeWorkspace="launcher" />)
    expect(screen.queryByTestId('active-job-island')).not.toBeInTheDocument()
  })

  it('mounts the island for active jobs and lights the owning dock live dots', () => {
    activeJobsState.value = {
      backtests: {
        workspaceId: 'backtests',
        workspaceLabel: 'Backtests',
        pct: 40,
        detail: 'Optimize: Trial 4 / 10',
        progressKind: 'determinate',
      },
      discover: {
        workspaceId: 'discover',
        workspaceLabel: 'Discover',
        pct: 10,
        detail: 'Candidate 1 / 9',
        progressKind: 'determinate',
      },
    }

    render(<AppDock activeWorkspace="launcher" />)

    expect(screen.getByTestId('active-job-island')).toBeInTheDocument()
    expect(screen.getByLabelText('Backtests job running')).toBeInTheDocument()
    expect(screen.getByLabelText('Discover job running')).toBeInTheDocument()
  })

  it('lights the Backtests live dot for validate/walk-forward jobs', () => {
    activeJobsState.value = {
      validate: {
        workspaceId: 'validate',
        workspaceLabel: 'Validate',
        pct: 50,
        detail: 'Window 2 / 4',
        progressKind: 'determinate',
      },
    }

    render(<AppDock activeWorkspace="launcher" />)

    expect(screen.getByTestId('active-job-island')).toHaveTextContent('Validate')
    expect(screen.getByLabelText('Backtests job running')).toBeInTheDocument()
  })

  it('orders island jobs backtests → validate → discover', async () => {
    const user = userEvent.setup()
    activeJobsState.value = {
      discover: {
        workspaceId: 'discover',
        workspaceLabel: 'Discover',
        pct: 10,
        detail: 'Candidate 1 / 9',
        progressKind: 'determinate',
      },
      validate: {
        workspaceId: 'validate',
        workspaceLabel: 'Validate',
        pct: 50,
        detail: 'Window 2 / 4',
        progressKind: 'determinate',
      },
      backtests: {
        workspaceId: 'backtests',
        workspaceLabel: 'Backtests',
        pct: 20,
        detail: 'Optimize: Trial 1 / 5',
        progressKind: 'determinate',
      },
    }

    render(<AppDock activeWorkspace="launcher" />)
    await user.click(screen.getByTestId('active-job-island-trigger'))

    const rows = screen.getAllByRole('button').filter((el) =>
      el.getAttribute('data-testid')?.startsWith('active-job-row-'),
    )
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'active-job-row-backtests',
      'active-job-row-validate',
      'active-job-row-discover',
    ])
  })

  it('navigates job rows through WO215 runWorkspaceTransition', async () => {
    const user = userEvent.setup()
    activeJobsState.value = {
      discover: {
        workspaceId: 'discover',
        workspaceLabel: 'Discover',
        pct: 10,
        detail: 'Candidate 1 / 9',
        progressKind: 'determinate',
      },
    }

    render(<AppDock activeWorkspace="launcher" />)
    await user.click(screen.getByTestId('active-job-island-trigger'))
    await user.click(screen.getByTestId('active-job-row-discover'))

    expect(runWorkspaceTransition).toHaveBeenCalledTimes(1)
    expect(runWorkspaceTransition.mock.calls[0][0]).toMatchObject({
      from: 'launcher',
      to: 'discover',
      direction: 'forward',
    })
    expect(navigate).toHaveBeenCalledWith({ to: '/discover' })
  })

  it('routes validate jobs to backtests?mode=validate via the backtests dock anchor', async () => {
    const user = userEvent.setup()
    activeJobsState.value = {
      validate: {
        workspaceId: 'validate',
        workspaceLabel: 'Validate',
        pct: 50,
        detail: 'Window 2 / 4',
        progressKind: 'determinate',
      },
    }

    render(<AppDock activeWorkspace="launcher" />)
    await user.click(screen.getByTestId('active-job-island-trigger'))
    await user.click(screen.getByTestId('active-job-row-validate'))

    expect(runWorkspaceTransition).toHaveBeenCalledTimes(1)
    expect(runWorkspaceTransition.mock.calls[0][0]).toMatchObject({
      from: 'launcher',
      to: 'backtests',
      direction: 'forward',
    })
    expect(navigate).toHaveBeenCalledWith({
      to: '/backtests',
      search: { mode: 'validate' },
    })
  })
})
