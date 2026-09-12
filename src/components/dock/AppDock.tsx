import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from 'react'

import {
  ActiveJobIsland,
  type ActiveJobIslandJob,
  type ActiveJobIslandMode,
} from '@/components/dock/ActiveJobIsland'
import {
  LauncherIcon,
  MarketIcon,
  StorageIcon,
  BacktestsIcon,
  DiscoverIcon,
  ExecutionIcon,
  ResearchIcon,
  SystemIcon,
  StrategyBuilderIcon,
} from '@/components/dock/DockIcons'
import { workspaceTransitionDirection } from '@/app/router'
import { useWorkspaceTransitionStore } from '@/components/transitions/workspaceTransitionStore'
import {
  SpotlightNavItem,
  SPOTLIGHT_NAV_MOTION,
  type SpotlightNavItemSize,
} from '@/components/ui/spotlight-button'
import { useActiveJobs } from '@/hooks/useActiveJobs'
import { cn } from '@/lib/utils'
import type { WorkspaceId } from '@/types/api'

type DockItem = {
  id: WorkspaceId
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
  enabled: boolean
}

const dockItems: DockItem[] = [
  { id: 'launcher', label: 'Launcher', to: '/', icon: LauncherIcon, enabled: true },
  { id: 'market-data', label: 'Market', to: '/market-data', icon: MarketIcon, enabled: true },
  { id: 'storage', label: 'Storage', to: '/storage', icon: StorageIcon, enabled: true },
  { id: 'backtests', label: 'Backtests', to: '/backtests', icon: BacktestsIcon, enabled: true },
  {
    id: 'strategy-builder',
    label: 'AI Builder',
    to: '/strategy-builder',
    icon: StrategyBuilderIcon,
    enabled: true,
  },
  { id: 'discover', label: 'Discover', to: '/discover', icon: DiscoverIcon, enabled: true },
  { id: 'research', label: 'Research', to: '/research', icon: ResearchIcon, enabled: true },
  { id: 'execution', label: 'Execution', to: '/execution', icon: ExecutionIcon, enabled: true },
  { id: 'system', label: 'System', to: '/system', icon: SystemIcon, enabled: true },
]

/** Island job order: dock workflow order, with validate after backtests. */
const ACTIVE_JOB_ORDER: WorkspaceId[] = ['backtests', 'validate', 'discover']

type JobDestination = {
  to: '/backtests' | '/discover'
  search?: { mode: 'validate' }
  /** Workspace id used for WO215 transition / dock anchor. */
  transitionTo: WorkspaceId
  icon: ComponentType<{ className?: string }>
}

const JOB_DESTINATIONS: Partial<Record<WorkspaceId, JobDestination>> = {
  backtests: { to: '/backtests', transitionTo: 'backtests', icon: BacktestsIcon },
  validate: {
    to: '/backtests',
    search: { mode: 'validate' },
    transitionTo: 'backtests',
    icon: BacktestsIcon,
  },
  discover: { to: '/discover', transitionTo: 'discover', icon: DiscoverIcon },
}

type AppDockProps = {
  activeWorkspace: WorkspaceId
}

export function AppDock({ activeWorkspace }: AppDockProps) {
  const isLauncher = activeWorkspace === 'launcher'
  const size: SpotlightNavItemSize = isLauncher ? 'large' : 'default'
  const activeJobs = useActiveJobs()
  const activeIndex = dockItems.findIndex((item) => item.id === activeWorkspace)
  const location = useLocation()
  const navigate = useNavigate()
  const runWorkspaceTransition = useWorkspaceTransitionStore(
    (state) => state.runWorkspaceTransition,
  )

  const itemsRowRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLElement | null>>([])
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties | null>(null)
  const [islandMode, setIslandMode] = useState<ActiveJobIslandMode>('compact')

  const updateIndicator = useCallback(() => {
    const row = itemsRowRef.current
    const activeEl = itemRefs.current[activeIndex]
    if (!row || !activeEl || activeIndex < 0) {
      setIndicatorStyle(null)
      return
    }

    const rowRect = row.getBoundingClientRect()
    const itemRect = activeEl.getBoundingClientRect()
    setIndicatorStyle({
      left: `${itemRect.left - rowRect.left}px`,
      width: `${itemRect.width}px`,
      transform: 'translateY(-1px)',
    })
  }, [activeIndex])

  useLayoutEffect(() => {
    updateIndicator()
    const row = itemsRowRef.current
    if (!row || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => updateIndicator())
    observer.observe(row)
    return () => observer.disconnect()
  }, [updateIndicator, isLauncher])

  const islandJobs: ActiveJobIslandJob[] = ACTIVE_JOB_ORDER.flatMap((workspaceId) => {
    const job = activeJobs[workspaceId]
    const destination = JOB_DESTINATIONS[workspaceId]
    if (!job || !destination) return []
    return [{ ...job, icon: destination.icon }]
  })

  useLayoutEffect(() => {
    if (islandJobs.length === 0 && islandMode !== 'compact') {
      setIslandMode('compact')
    }
  }, [islandJobs.length, islandMode])

  const navigateToWorkspace = (item: DockItem, index: number) => {
    const direction = workspaceTransitionDirection(location.pathname, item.to)
    if (!direction) return
    const destinationDockElement = itemRefs.current[index]
    if (!destinationDockElement) {
      void navigate({ to: item.to })
      return
    }
    void runWorkspaceTransition({
      from: activeWorkspace,
      to: item.id,
      direction,
      destinationDockElement,
      commit: () => navigate({ to: item.to }),
    })
  }

  const navigateToJob = (job: ActiveJobIslandJob) => {
    const destination = JOB_DESTINATIONS[job.workspaceId]
    if (!destination) return

    const dockIndex = dockItems.findIndex((item) => item.id === destination.transitionTo)
    const destinationPath = destination.to
    const direction = workspaceTransitionDirection(location.pathname, destinationPath)

    const commit = () => {
      if (destination.search) {
        void navigate({ to: destination.to, search: destination.search })
      } else {
        void navigate({ to: destination.to })
      }
    }

    if (!direction) {
      commit()
      setIslandMode('compact')
      return
    }

    const destinationDockElement = dockIndex >= 0 ? itemRefs.current[dockIndex] : null
    if (!destinationDockElement) {
      commit()
      setIslandMode('compact')
      return
    }

    void runWorkspaceTransition({
      from: activeWorkspace,
      to: destination.transitionTo,
      direction,
      destinationDockElement,
      commit,
    })
    setIslandMode('compact')
  }

  const iconHasRunningJob = (itemId: WorkspaceId) => {
    if (!dockItems.find((item) => item.id === itemId)?.enabled) return false
    if (itemId === 'backtests') {
      return Boolean(activeJobs.backtests || activeJobs.validate)
    }
    return Boolean(activeJobs[itemId])
  }

  return (
    <nav
      aria-label="Workspace dock"
      className={cn(
        'vt-dock surface-shell--blur fixed left-1/2 z-20 flex -translate-x-1/2 items-center transition-[transform,opacity,border-color,box-shadow,background-color] duration-300 ease-in-out',
        'border-brass-500/20 border-t-brass-400/50 from-espresso-900/80 via-espresso-950/92 to-carbon-950/96 border border-b-black/60 bg-gradient-to-b',
        'hover:border-brass-500/30 hover:border-t-brass-400/80 hover:border-b-black/80',
        isLauncher
          ? 'bottom-[12%] w-fit max-w-[min(1100px,96vw)] rounded-3xl px-5 py-3 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.16),_inset_0_-2px_0_rgba(0,0,0,0.65),_inset_0_0_0_1px_rgba(255,255,255,0.03),_0_25px_60px_-15px_rgba(0,0,0,0.9),_0_0_40px_rgba(196,165,116,0.08)] hover:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.22),_inset_0_-2px_0_rgba(0,0,0,0.75),_inset_0_0_0_1px_rgba(255,255,255,0.05),_0_30px_70px_-10px_rgba(0,0,0,0.95),_0_0_50px_rgba(196,165,116,0.12)]'
          : 'bottom-8 rounded-2xl px-2 py-2.5 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.16),_inset_0_-2px_0_rgba(0,0,0,0.65),_inset_0_0_0_1px_rgba(255,255,255,0.03),_0_20px_50px_-10px_rgba(0,0,0,0.8),_0_0_30px_rgba(196,165,116,0.06)] hover:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.22),_inset_0_-2px_0_rgba(0,0,0,0.75),_inset_0_0_0_1px_rgba(255,255,255,0.05),_0_25px_60px_-5px_rgba(0,0,0,0.85),_0_0_40px_rgba(196,165,116,0.1)]',
      )}
    >
      <div ref={itemsRowRef} className="relative flex items-center">
        {indicatorStyle ? (
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-0 h-4 overflow-visible transition-[left,width]',
              SPOTLIGHT_NAV_MOTION,
            )}
            style={indicatorStyle}
          >
            <span className="via-brass-500/70 absolute top-0 -left-[14%] h-px w-[128%] bg-gradient-to-r from-transparent to-transparent blur-[3px]" />
            <span className="from-brass-300/50 via-brass-400/20 absolute top-0 -left-[5%] h-1 w-[110%] bg-gradient-to-b to-transparent blur-[5px]" />
            <span className="absolute top-0 left-[8%] h-px w-[84%] bg-gradient-to-r from-transparent via-[#ffe4a6] to-transparent shadow-[0_1px_2px_rgba(255,235,183,0.8),_0_5px_10px_rgba(240,180,41,0.72),_0_12px_22px_rgba(196,132,28,0.36)]" />
            {/* Icon wash rides with the top bar so both travel as one selection unit */}
            <span
              className={cn(
                'pointer-events-none absolute top-0 left-1/2 w-[155%] -translate-x-1/2',
                size === 'large' ? 'h-[5.75rem]' : 'h-[4.75rem]',
              )}
              style={{
                background:
                  'radial-gradient(ellipse 70% 90% at 50% 0%, rgba(240, 180, 41, 0.48) 0%, rgba(240, 180, 41, 0.2) 32%, rgba(240, 180, 41, 0.06) 58%, transparent 74%)',
              }}
            />
          </div>
        ) : null}

        {dockItems.map((item, index) => {
          const isActive = activeWorkspace === item.id
          const hasRunningJob = iconHasRunningJob(item.id)

          const setItemRef = (node: HTMLElement | null) => {
            itemRefs.current[index] = node
          }

          if (!item.enabled) {
            return (
              <span key={item.id} ref={setItemRef} className="inline-flex">
                <SpotlightNavItem
                  icon={item.icon}
                  label={item.label}
                  isActive={false}
                  indicatorPosition={activeIndex}
                  position={index}
                  size={size}
                  title={`${item.label} (coming soon)`}
                  className="cursor-not-allowed opacity-40 grayscale select-none"
                />
              </span>
            )
          }

          return (
            <button
              key={item.id}
              ref={setItemRef}
              type="button"
              onClick={() => navigateToWorkspace(item, index)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className="group inline-flex"
            >
              <SpotlightNavItem
                icon={item.icon}
                label={item.label}
                isActive={isActive}
                indicatorPosition={activeIndex}
                position={index}
                size={size}
              >
                {hasRunningJob ? (
                  <span
                    className="absolute -top-0.5 -right-1 z-10 flex h-2 w-2"
                    title={`${item.label} job running`}
                    aria-label={`${item.label} job running`}
                  >
                    <span className="bg-brass-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                    <span className="bg-brass-400 relative inline-flex h-2 w-2 rounded-full shadow-[0_0_8px_rgba(196,165,116,0.8)]" />
                  </span>
                ) : null}
              </SpotlightNavItem>
            </button>
          )
        })}
      </div>

      {islandJobs.length > 0 ? (
        <ActiveJobIsland
          jobs={islandJobs}
          mode={islandMode}
          onModeChange={setIslandMode}
          onNavigate={navigateToJob}
        />
      ) : null}
    </nav>
  )
}
