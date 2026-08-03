import { motion } from 'motion/react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

import type { ActiveJobInfo } from '@/hooks/useActiveJobs'
import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { cn } from '@/lib/utils'
import type { WorkspaceId } from '@/types/api'

export type ActiveJobIslandMode = 'compact' | 'expanded'

export type ActiveJobIslandJob = ActiveJobInfo & {
  icon: ComponentType<{ className?: string }>
}

export type ActiveJobIslandProps = {
  jobs: ActiveJobIslandJob[]
  mode: ActiveJobIslandMode
  onModeChange: (mode: ActiveJobIslandMode) => void
  onNavigate: (job: ActiveJobIslandJob) => void
  className?: string
}

const BOUNCE_VARIANTS = {
  'compact-expanded': 0.35,
  'expanded-compact': 0.3,
} as const

const DEFAULT_BOUNCE = 0.5

type JobSnapshot = {
  pct: number
  detail: string
  progressKind: ActiveJobInfo['progressKind']
}

function snapshotJobs(jobs: ActiveJobIslandJob[]): Map<WorkspaceId, JobSnapshot> {
  const map = new Map<WorkspaceId, JobSnapshot>()
  for (const job of jobs) {
    map.set(job.workspaceId, {
      pct: job.pct,
      detail: job.detail,
      progressKind: job.progressKind,
    })
  }
  return map
}

function resolvePrimaryJobId(
  jobs: ActiveJobIslandJob[],
  previous: Map<WorkspaceId, JobSnapshot> | null,
  currentPrimary: WorkspaceId | null,
): WorkspaceId {
  if (jobs.length === 0) return currentPrimary ?? 'backtests'
  if (jobs.length === 1) return jobs[0].workspaceId

  if (previous) {
    for (let i = jobs.length - 1; i >= 0; i -= 1) {
      const job = jobs[i]
      const prev = previous.get(job.workspaceId)
      if (!prev) return job.workspaceId
      if (
        prev.pct !== job.pct ||
        prev.detail !== job.detail ||
        prev.progressKind !== job.progressKind
      ) {
        return job.workspaceId
      }
    }
  }

  if (currentPrimary && jobs.some((job) => job.workspaceId === currentPrimary)) {
    return currentPrimary
  }
  return jobs[0].workspaceId
}

function workspaceLabelForId(id: WorkspaceId): string {
  switch (id) {
    case 'backtests':
      return 'Backtests'
    case 'validate':
      return 'Validate'
    case 'discover':
      return 'Discover'
    case 'launcher':
    case 'market-data':
    case 'storage':
    case 'research':
    case 'execution':
    case 'system':
    case 'strategy-builder':
      return id
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

function JobProgress({ job, compact }: { job: ActiveJobIslandJob; compact?: boolean }) {
  if (job.progressKind === 'indeterminate') {
    return (
      <div
        className={cn(
          'surface-well relative overflow-hidden rounded-full',
          compact ? 'h-1 w-16' : 'h-1.5 w-full',
        )}
        role="progressbar"
        aria-label={`${job.workspaceLabel} progress`}
        aria-valuetext="In progress"
        data-progress-kind="indeterminate"
      >
        <span className="bg-brass-400/80 absolute inset-y-0 w-1/3 animate-pulse rounded-full" />
      </div>
    )
  }

  return (
    <div
      className={cn('surface-well overflow-hidden rounded-full', compact ? 'h-1 w-16' : 'h-1.5 w-full')}
      role="progressbar"
      aria-label={`${job.workspaceLabel} progress`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={job.pct}
      data-progress-kind="determinate"
    >
      <motion.div
        className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r"
        initial={false}
        animate={{ width: `${job.pct}%` }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        data-testid="active-job-progress-fill"
      />
    </div>
  )
}

function CompactJobSummary({
  job,
  extraCount,
}: {
  job: ActiveJobIslandJob
  extraCount: number
}) {
  const Icon = job.icon
  return (
    <div className="flex min-w-0 items-center gap-2 px-3 py-2" data-testid="active-job-compact">
      <Icon className="text-brass-400 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="text-silver-200 text-2xs truncate font-mono font-[560] tracking-[0.08em] uppercase">
        {job.workspaceLabel}
      </span>
      {job.progressKind === 'determinate' ? (
        <span className="text-silver-100 quant-tabular-nums text-2xs font-mono font-[560]">
          {job.pct}%
        </span>
      ) : (
        <span className="text-silver-400 text-2xs font-mono tracking-[0.06em] uppercase">Live</span>
      )}
      <JobProgress job={job} compact />
      {extraCount > 0 ? (
        <span
          className="bg-brass-500/20 text-brass-300 border-brass-500/30 text-2xs shrink-0 rounded-md border px-1.5 py-0.5 font-mono font-[560]"
          data-testid="active-job-extra-count"
        >
          +{extraCount}
        </span>
      ) : null}
    </div>
  )
}

function ExpandedJobList({
  jobs,
  onNavigate,
  listId,
}: {
  jobs: ActiveJobIslandJob[]
  onNavigate: (job: ActiveJobIslandJob) => void
  listId: string
}) {
  return (
    <ul
      id={listId}
      className="flex max-h-[min(40vh,16rem)] w-[min(18rem,calc(100vw-2rem))] flex-col gap-1 overflow-y-auto px-2 pb-2"
      data-testid="active-job-expanded"
    >
      {jobs.map((job) => {
        const Icon = job.icon
        return (
          <li key={job.workspaceId}>
            <button
              type="button"
              className="hover:bg-brass-500/10 focus-visible:ring-brass-400/50 flex w-full flex-col gap-1.5 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:ring-1 focus-visible:outline-none"
              onClick={() => onNavigate(job)}
              aria-label={`Open ${job.workspaceLabel}: ${job.detail}`}
              data-testid={`active-job-row-${job.workspaceId}`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="text-brass-400 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="text-silver-200 text-2xs truncate font-mono font-[560] tracking-[0.08em] uppercase">
                  {job.workspaceLabel}
                </span>
                {job.progressKind === 'determinate' ? (
                  <span className="text-silver-100 quant-tabular-nums text-2xs ml-auto font-mono font-[560]">
                    {job.pct}%
                  </span>
                ) : (
                  <span className="text-silver-400 text-2xs ml-auto font-mono tracking-[0.06em] uppercase">
                    Live
                  </span>
                )}
              </div>
              <JobProgress job={job} />
              <span className="text-silver-400 truncate text-[10px]">{job.detail}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function ActiveJobIsland({
  jobs,
  mode,
  onModeChange,
  onNavigate,
  className,
}: ActiveJobIslandProps) {
  const reduceMotion = useReducedMotion()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const previousJobsRef = useRef<Map<WorkspaceId, JobSnapshot> | null>(null)
  const [primaryId, setPrimaryId] = useState<WorkspaceId | null>(jobs[0]?.workspaceId ?? null)
  const [variantKey, setVariantKey] = useState('compact-expanded')
  const [announcement, setAnnouncement] = useState('')
  const knownIdsRef = useRef<Set<WorkspaceId>>(new Set(jobs.map((job) => job.workspaceId)))

  const previousModeRef = useRef(mode)

  useLayoutEffect(() => {
    const nextPrimary = resolvePrimaryJobId(jobs, previousJobsRef.current, primaryId)
    previousJobsRef.current = snapshotJobs(jobs)
    if (nextPrimary !== primaryId) setPrimaryId(nextPrimary)
  }, [jobs, primaryId])

  useLayoutEffect(() => {
    const wasExpanded = previousModeRef.current === 'expanded'
    previousModeRef.current = mode
    if (wasExpanded && mode === 'compact') {
      triggerRef.current?.focus()
    }
  }, [mode])

  useEffect(() => {
    const nextIds = new Set(jobs.map((job) => job.workspaceId))
    const prevIds = knownIdsRef.current
    const started: string[] = []
    const completed: string[] = []

    for (const job of jobs) {
      if (!prevIds.has(job.workspaceId)) started.push(job.workspaceLabel)
    }
    for (const id of prevIds) {
      if (!nextIds.has(id)) completed.push(workspaceLabelForId(id))
    }

    knownIdsRef.current = nextIds

    if (started.length === 0 && completed.length === 0) return

    const parts: string[] = []
    if (started.length > 0) parts.push(`${started.join(', ')} job started`)
    if (completed.length > 0) parts.push(`${completed.join(', ')} job completed`)
    setAnnouncement(parts.join('. '))
  }, [jobs])

  useEffect(() => {
    if (mode !== 'expanded') return

    const collapse = () => {
      setVariantKey('expanded-compact')
      onModeChange('compact')
    }

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (!root) return
      if (event.target instanceof Node && root.contains(event.target)) return
      collapse()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      collapse()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mode, onModeChange])

  if (jobs.length === 0) return null

  const primary = jobs.find((job) => job.workspaceId === primaryId) ?? jobs[0]
  const extraCount = Math.max(0, jobs.length - 1)
  const expanded = mode === 'expanded'

  const setMode = (next: ActiveJobIslandMode) => {
    if (next === mode) return
    setVariantKey(`${mode}-${next}`)
    onModeChange(next)
  }

  const toggle = () => setMode(expanded ? 'compact' : 'expanded')

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle()
    }
  }

  const springTransition = reduceMotion
    ? { duration: 0 }
    : {
        bounce: BOUNCE_VARIANTS[variantKey as keyof typeof BOUNCE_VARIANTS] ?? DEFAULT_BOUNCE,
        duration: 0.25,
        type: 'spring' as const,
      }

  const contentTransition = reduceMotion
    ? { duration: 0 }
    : {
        bounce: BOUNCE_VARIANTS[variantKey as keyof typeof BOUNCE_VARIANTS] ?? DEFAULT_BOUNCE,
        type: 'spring' as const,
      }

  return (
    <div
      ref={rootRef}
      className={cn('relative ml-1.5 border-l border-brass-500/15 pl-2.5', className)}
      data-testid="active-job-island"
      data-mode={mode}
    >
      <motion.div
        layout
        className="surface-float surface-float--blur w-fit min-w-[7.5rem] overflow-hidden border-brass-500/25"
        style={{ borderRadius: expanded ? 18 : 999 }}
        transition={springTransition}
      >
        <button
          ref={triggerRef}
          type="button"
          className="hover:bg-brass-500/10 focus-visible:ring-brass-400/50 block w-full text-left focus-visible:ring-1 focus-visible:outline-none"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-label={
            expanded
              ? 'Collapse active jobs'
              : jobs.length === 1
                ? `Active job: ${primary.workspaceLabel}. Expand for details`
                : `Active jobs: ${primary.workspaceLabel} and ${extraCount} more. Expand for details`
          }
          onClick={toggle}
          onKeyDown={onTriggerKeyDown}
          data-testid="active-job-island-trigger"
        >
          <motion.div
            key={expanded ? 'expanded-header' : 'compact'}
            initial={reduceMotion ? false : { filter: 'blur(5px)', opacity: 0, scale: 0.94 }}
            animate={
              reduceMotion
                ? { opacity: 1, scale: 1 }
                : {
                    filter: 'blur(0px)',
                    opacity: 1,
                    scale: 1,
                    transition: { delay: 0.05 },
                  }
            }
            transition={contentTransition}
          >
            {expanded ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="bg-brass-400 h-1.5 w-1.5 shrink-0 rounded-full shadow-[0_0_8px_rgba(196,165,116,0.8)]" />
                <span className="text-silver-200 text-2xs font-mono font-[560] tracking-[0.08em] uppercase">
                  {jobs.length} active
                </span>
              </div>
            ) : (
              <CompactJobSummary job={primary} extraCount={extraCount} />
            )}
          </motion.div>
        </button>
        {expanded ? (
          <motion.div
            key="expanded-list"
            initial={reduceMotion ? false : { filter: 'blur(5px)', opacity: 0, scale: 0.98 }}
            animate={
              reduceMotion
                ? { opacity: 1, scale: 1 }
                : { filter: 'blur(0px)', opacity: 1, scale: 1 }
            }
            transition={contentTransition}
          >
            <ExpandedJobList jobs={jobs} onNavigate={onNavigate} listId={listId} />
          </motion.div>
        ) : null}
      </motion.div>
      <span className="sr-only" aria-live="polite" data-testid="active-job-live">
        {announcement}
      </span>
    </div>
  )
}
