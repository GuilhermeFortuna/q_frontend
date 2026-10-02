import { create } from 'zustand'

export type WorkspaceTransitionPhase =
  | 'idle'
  | 'capturing'
  | 'committing'
  | 'reconfiguring'
  | 'settling'

export type WorkspaceTransitionDirection = 'forward' | 'backward'

export type WorkspaceTransitionSurfaceRole = 'primary' | 'secondary' | 'tertiary' | 'utility'

export type RunWorkspaceTransitionOptions = {
  from: string
  to: string
  direction: WorkspaceTransitionDirection
  destinationDockElement: HTMLElement
  /** Loads whatever the destination needs so `commit` renders it without suspending. */
  prepare?: () => Promise<void>
  commit: () => void | Promise<void>
}

type Deferred = {
  resolve: () => void
  reject: (error: unknown) => void
}

type TransitionRequest = {
  options: RunWorkspaceTransitionOptions
  deferred: Deferred[]
  committed: boolean
}

export type WorkspaceTransitionContext = {
  from: string
  to: string
  direction: WorkspaceTransitionDirection
  destinationDockElement: HTMLElement
  reducedMotion: boolean
  token: number
  isCurrent: () => boolean
}

export type WorkspaceTransitionExecutor = {
  onCapture: (ctx: WorkspaceTransitionContext) => Promise<void>
  onReconfigure: (ctx: WorkspaceTransitionContext) => Promise<void>
  onReducedMotion: (ctx: WorkspaceTransitionContext) => Promise<void>
  onCancel: () => void
}

const REDUCED_MS = 120

let active: TransitionRequest | null = null
let queued: TransitionRequest | null = null
let generation = 0
let executor: WorkspaceTransitionExecutor | null = null

function settle(request: TransitionRequest, error?: unknown) {
  for (const deferred of request.deferred) {
    if (error === undefined) deferred.resolve()
    else deferred.reject(error)
  }
}

function makeContext(
  request: TransitionRequest,
  token: number,
  reducedMotion: boolean,
): WorkspaceTransitionContext {
  return {
    get from() {
      return request.options.from
    },
    get to() {
      return request.options.to
    },
    get direction() {
      return request.options.direction
    },
    get destinationDockElement() {
      return request.options.destinationDockElement
    },
    reducedMotion,
    token,
    isCurrent: () => active === request && token === generation,
  }
}

type WorkspaceTransitionStore = {
  phase: WorkspaceTransitionPhase
  direction: WorkspaceTransitionDirection
  from: string | null
  to: string | null
  reducedMotion: boolean
  phaseStartedAt: number
  completionId: number
  runWorkspaceTransition: (options: RunWorkspaceTransitionOptions) => Promise<void>
  setReducedMotion: (reducedMotion: boolean) => void
  abortAndCommit: () => Promise<void>
  dispose: () => Promise<void>
}

export const useWorkspaceTransitionStore = create<WorkspaceTransitionStore>((set, get) => {
  const startQueued = () => {
    if (!queued) return
    const next = queued
    queued = null
    void run(next)
  }

  const finish = (request: TransitionRequest, error?: unknown) => {
    if (active !== request) return
    active = null
    set((state) => ({
      phase: 'idle',
      from: null,
      to: null,
      phaseStartedAt: performance.now(),
      completionId: error === undefined ? state.completionId + 1 : state.completionId,
    }))
    settle(request, error)
    startQueued()
  }

  const syncRequestMeta = (request: TransitionRequest) => {
    set({
      direction: request.options.direction,
      from: request.options.from,
      to: request.options.to,
    })
  }

  const commitOnce = async (request: TransitionRequest) => {
    if (request.committed) return
    request.committed = true
    set({ phase: 'committing', phaseStartedAt: performance.now() })
    syncRequestMeta(request)
    await request.options.commit()
  }

  // A request can be coalesced onto a new destination while it prepares, so repeat until the
  // options that were prepared are still the ones about to be committed. A failed prepare is
  // left for the navigation itself to surface.
  const prepareLatest = async (request: TransitionRequest) => {
    let prepared: RunWorkspaceTransitionOptions
    do {
      prepared = request.options
      await prepared.prepare?.().catch(() => undefined)
    } while (request.options !== prepared && !request.committed)
  }

  const run = async (request: TransitionRequest) => {
    active = request
    const token = ++generation
    const { reducedMotion } = get()
    const ctx = makeContext(request, token, reducedMotion)

    set({
      phase: 'capturing',
      direction: request.options.direction,
      from: request.options.from,
      to: request.options.to,
      phaseStartedAt: performance.now(),
    })

    try {
      await prepareLatest(request)
      if (!ctx.isCurrent()) return

      // A hidden document produces no animation frames, so a visual transition would never
      // finish: switch straight to the destination instead.
      if (document.visibilityState === 'hidden') {
        await commitOnce(request)
        if (!ctx.isCurrent()) return
        finish(request)
        return
      }

      if (reducedMotion) {
        await commitOnce(request)
        if (!ctx.isCurrent()) return
        set({ phase: 'settling', phaseStartedAt: performance.now() })
        await executor?.onReducedMotion(ctx)
        if (!ctx.isCurrent()) return
        finish(request)
        return
      }

      await executor?.onCapture(ctx)
      if (!ctx.isCurrent()) return

      await commitOnce(request)
      if (!ctx.isCurrent()) return

      set({ phase: 'reconfiguring', phaseStartedAt: performance.now() })
      syncRequestMeta(request)
      await executor?.onReconfigure(ctx)
      if (!ctx.isCurrent()) return

      set({ phase: 'settling', phaseStartedAt: performance.now() })
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
      if (!ctx.isCurrent()) return
      finish(request)
    } catch (error) {
      executor?.onCancel()
      finish(request, error)
    }
  }

  const makeRequest = (options: RunWorkspaceTransitionOptions) =>
    new Promise<void>((resolve, reject) => {
      const deferred = { resolve, reject }
      if (!active) {
        void run({ options, deferred: [deferred], committed: false })
        return
      }

      const phase = get().phase
      const canCoalesce = (phase === 'capturing' || phase === 'committing') && !active.committed
      if (canCoalesce) {
        active.options = {
          ...options,
          // Outgoing workspace stays the one currently on screen.
          from: active.options.from,
        }
        active.deferred.push(deferred)
        syncRequestMeta(active)
        return
      }

      if (queued) {
        queued.options = options
        queued.deferred.push(deferred)
      } else {
        queued = { options, deferred: [deferred], committed: false }
      }
    })

  const abortAndCommit = async () => {
    const request = active
    if (!request) return
    generation += 1
    executor?.onCancel()
    try {
      if (!request.committed) {
        request.committed = true
        await request.options.commit()
      }
      if (active === request) finish(request)
    } catch (error) {
      finish(request, error)
    }
  }

  return {
    phase: 'idle',
    direction: 'forward',
    from: null,
    to: null,
    reducedMotion: false,
    phaseStartedAt: 0,
    completionId: 0,
    runWorkspaceTransition: makeRequest,
    setReducedMotion: (reducedMotion) => {
      set({ reducedMotion })
      if (reducedMotion && active && !active.committed) {
        void abortAndCommit()
      }
    },
    abortAndCommit,
    dispose: abortAndCommit,
  }
})

// Mirror the phase onto <html> so CSS can keep live surfaces hidden while clones stand in.
useWorkspaceTransitionStore.subscribe((state) => {
  if (typeof document === 'undefined') return
  if (state.phase === 'idle') delete document.documentElement.dataset.workspaceTransition
  else document.documentElement.dataset.workspaceTransition = state.phase
})

export const WORKSPACE_TRANSITION_TIMINGS = {
  durationMs: 260,
  unmatchedEnterProgress: 0.45,
  unmatchedRecedePx: 10,
  settleFadeMs: 90,
  destinationSettleCapMs: 250,
  reducedMs: REDUCED_MS,
  ease: 'power2.out',
} as const

/** Register the AppShell-mounted visual executor. Pass null on unmount. */
export function registerWorkspaceTransitionExecutor(next: WorkspaceTransitionExecutor | null) {
  executor = next
}

/** Test-only reset for the singleton transition coordinator. */
export function resetWorkspaceTransitionStoreForTests() {
  executor?.onCancel()
  active = null
  queued = null
  generation += 1
  useWorkspaceTransitionStore.setState({
    phase: 'idle',
    direction: 'forward',
    from: null,
    to: null,
    reducedMotion: false,
    phaseStartedAt: 0,
    completionId: 0,
  })
}
