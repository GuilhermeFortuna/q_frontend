import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  registerWorkspaceTransitionExecutor,
  resetWorkspaceTransitionStoreForTests,
  useWorkspaceTransitionStore,
  type WorkspaceTransitionExecutor,
  type WorkspaceTransitionPhase,
} from '@/components/transitions/workspaceTransitionStore'

function dockEl() {
  const el = document.createElement('button')
  el.setAttribute('aria-label', 'Market')
  document.body.appendChild(el)
  return el
}

function makeExecutor(
  overrides: Partial<WorkspaceTransitionExecutor> = {},
): WorkspaceTransitionExecutor {
  return {
    onCapture: vi.fn(async () => undefined),
    onReconfigure: vi.fn(async () => undefined),
    onReducedMotion: vi.fn(async () => undefined),
    onCancel: vi.fn(),
    ...overrides,
  }
}

describe('workspaceTransitionStore / WorkspaceGridTransition coordinator', () => {
  beforeEach(() => {
    resetWorkspaceTransitionStoreForTests()
    registerWorkspaceTransitionExecutor(null)
  })

  afterEach(() => {
    resetWorkspaceTransitionStoreForTests()
    registerWorkspaceTransitionExecutor(null)
    document.body.replaceChildren()
  })

  it('runs capturing → committing → reconfiguring → settling → idle and commits once', async () => {
    const phases: WorkspaceTransitionPhase[] = []
    const unsub = useWorkspaceTransitionStore.subscribe((state) => {
      phases.push(state.phase)
    })
    const commit = vi.fn(async () => undefined)
    const executor = makeExecutor()
    registerWorkspaceTransitionExecutor(executor)

    await useWorkspaceTransitionStore.getState().runWorkspaceTransition({
      from: 'launcher',
      to: 'market-data',
      direction: 'forward',
      destinationDockElement: dockEl(),
      commit,
    })

    unsub()
    expect(commit).toHaveBeenCalledTimes(1)
    expect(executor.onCapture).toHaveBeenCalledTimes(1)
    expect(executor.onReconfigure).toHaveBeenCalledTimes(1)
    expect(phases).toContain('capturing')
    expect(phases).toContain('committing')
    expect(phases).toContain('reconfiguring')
    expect(phases).toContain('settling')
    expect(useWorkspaceTransitionStore.getState().phase).toBe('idle')
    expect(useWorkspaceTransitionStore.getState().completionId).toBe(1)
  })

  it('coalesces rapid requests to the latest destination before commit', async () => {
    let releaseCapture!: () => void
    const captureGate = new Promise<void>((resolve) => {
      releaseCapture = resolve
    })
    const firstCommit = vi.fn(async () => undefined)
    const finalCommit = vi.fn(async () => undefined)
    const executor = makeExecutor({
      onCapture: vi.fn(async () => {
        await captureGate
      }),
    })
    registerWorkspaceTransitionExecutor(executor)

    const first = useWorkspaceTransitionStore.getState().runWorkspaceTransition({
      from: 'launcher',
      to: 'market-data',
      direction: 'forward',
      destinationDockElement: dockEl(),
      commit: firstCommit,
    })
    const final = useWorkspaceTransitionStore.getState().runWorkspaceTransition({
      from: 'launcher',
      to: 'system',
      direction: 'forward',
      destinationDockElement: dockEl(),
      commit: finalCommit,
    })

    expect(useWorkspaceTransitionStore.getState().to).toBe('system')
    releaseCapture()
    await Promise.all([first, final])

    expect(firstCommit).not.toHaveBeenCalled()
    expect(finalCommit).toHaveBeenCalledTimes(1)
    expect(useWorkspaceTransitionStore.getState().phase).toBe('idle')
  })

  it('queues at most one latest request after commit has started', async () => {
    let releaseReconfigure!: () => void
    const reconfigureGate = new Promise<void>((resolve) => {
      releaseReconfigure = resolve
    })
    const firstCommit = vi.fn(async () => undefined)
    const queuedCommit = vi.fn(async () => undefined)
    const executor = makeExecutor({
      onReconfigure: vi.fn(async () => {
        await reconfigureGate
      }),
    })
    registerWorkspaceTransitionExecutor(executor)

    const first = useWorkspaceTransitionStore.getState().runWorkspaceTransition({
      from: 'launcher',
      to: 'market-data',
      direction: 'forward',
      destinationDockElement: dockEl(),
      commit: firstCommit,
    })

    await vi.waitFor(() => {
      expect(useWorkspaceTransitionStore.getState().phase).toBe('reconfiguring')
    })

    const queued = useWorkspaceTransitionStore.getState().runWorkspaceTransition({
      from: 'market-data',
      to: 'storage',
      direction: 'forward',
      destinationDockElement: dockEl(),
      commit: queuedCommit,
    })

    releaseReconfigure()
    await first
    await queued

    expect(firstCommit).toHaveBeenCalledTimes(1)
    expect(queuedCommit).toHaveBeenCalledTimes(1)
  })

  it('uses reduced-motion path: immediate commit and no Flip reconfigure', async () => {
    useWorkspaceTransitionStore.getState().setReducedMotion(true)
    const commit = vi.fn(async () => undefined)
    const executor = makeExecutor()
    registerWorkspaceTransitionExecutor(executor)

    await useWorkspaceTransitionStore.getState().runWorkspaceTransition({
      from: 'launcher',
      to: 'system',
      direction: 'backward',
      destinationDockElement: dockEl(),
      commit,
    })

    expect(commit).toHaveBeenCalledTimes(1)
    expect(executor.onCapture).not.toHaveBeenCalled()
    expect(executor.onReconfigure).not.toHaveBeenCalled()
    expect(executor.onReducedMotion).toHaveBeenCalledTimes(1)
    expect(useWorkspaceTransitionStore.getState().phase).toBe('idle')
  })

  it('rejects to idle without bumping completionId when commit fails', async () => {
    const failure = new Error('navigation rejected')
    const executor = makeExecutor()
    registerWorkspaceTransitionExecutor(executor)

    await expect(
      useWorkspaceTransitionStore.getState().runWorkspaceTransition({
        from: 'launcher',
        to: 'market-data',
        direction: 'forward',
        destinationDockElement: dockEl(),
        commit: () => Promise.reject(failure),
      }),
    ).rejects.toBe(failure)

    expect(useWorkspaceTransitionStore.getState().phase).toBe('idle')
    expect(useWorkspaceTransitionStore.getState().completionId).toBe(0)
    expect(executor.onCancel).toHaveBeenCalled()
  })

  it('abortAndCommit commits once, cancels visuals, and returns to idle', async () => {
    let releaseCapture!: () => void
    const captureGate = new Promise<void>((resolve) => {
      releaseCapture = resolve
    })
    const commit = vi.fn(async () => undefined)
    const executor = makeExecutor({
      onCapture: vi.fn(async () => {
        await captureGate
      }),
    })
    registerWorkspaceTransitionExecutor(executor)

    const transition = useWorkspaceTransitionStore.getState().runWorkspaceTransition({
      from: 'launcher',
      to: 'backtests',
      direction: 'forward',
      destinationDockElement: dockEl(),
      commit,
    })

    await vi.waitFor(() => {
      expect(useWorkspaceTransitionStore.getState().phase).toBe('capturing')
    })

    await useWorkspaceTransitionStore.getState().abortAndCommit()
    releaseCapture()
    await transition

    expect(commit).toHaveBeenCalledTimes(1)
    expect(executor.onCancel).toHaveBeenCalled()
    expect(useWorkspaceTransitionStore.getState().phase).toBe('idle')
    expect(useWorkspaceTransitionStore.getState().completionId).toBe(1)
  })

  it('passes direction through for forward and backward navigations', async () => {
    const executor = makeExecutor()
    registerWorkspaceTransitionExecutor(executor)
    const commit = vi.fn(async () => undefined)

    await useWorkspaceTransitionStore.getState().runWorkspaceTransition({
      from: 'system',
      to: 'launcher',
      direction: 'backward',
      destinationDockElement: dockEl(),
      commit,
    })

    const captureCtx = vi.mocked(executor.onCapture).mock.calls[0]?.[0]
    expect(captureCtx?.direction).toBe('backward')
    expect(captureCtx?.from).toBe('system')
    expect(captureCtx?.to).toBe('launcher')
  })
})

describe('WorkspaceGridTransition surface matching helpers (DOM contract)', () => {
  it('matches surfaces by role between outgoing and incoming roots', () => {
    const fromRoot = document.createElement('div')
    fromRoot.setAttribute('data-workspace-transition-root', 'launcher')
    const primary = document.createElement('div')
    primary.setAttribute('data-workspace-transition-surface', 'primary')
    const secondary = document.createElement('div')
    secondary.setAttribute('data-workspace-transition-surface', 'secondary')
    fromRoot.append(primary, secondary)

    const toRoot = document.createElement('div')
    toRoot.setAttribute('data-workspace-transition-root', 'storage')
    const destPrimary = document.createElement('div')
    destPrimary.setAttribute('data-workspace-transition-surface', 'primary')
    const destUtility = document.createElement('div')
    destUtility.setAttribute('data-workspace-transition-surface', 'utility')
    toRoot.append(destPrimary, destUtility)

    document.body.append(fromRoot, toRoot)

    const outgoing = [
      ...fromRoot.querySelectorAll<HTMLElement>('[data-workspace-transition-surface]'),
    ].map((el) => el.getAttribute('data-workspace-transition-surface'))
    const incoming = [
      ...toRoot.querySelectorAll<HTMLElement>('[data-workspace-transition-surface]'),
    ].map((el) => el.getAttribute('data-workspace-transition-surface'))

    const matched = outgoing.filter((role) => incoming.includes(role))
    const unmatchedOut = outgoing.filter((role) => !incoming.includes(role))
    const unmatchedIn = incoming.filter((role) => !outgoing.includes(role))

    expect(matched).toEqual(['primary'])
    expect(unmatchedOut).toEqual(['secondary'])
    expect(unmatchedIn).toEqual(['utility'])
  })
})
