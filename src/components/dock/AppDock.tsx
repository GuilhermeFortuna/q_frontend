import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from 'react'

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
import {
  SpotlightNavItem,
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

type AppDockProps = {
  activeWorkspace: WorkspaceId
}

export function AppDock({ activeWorkspace }: AppDockProps) {
  const isLauncher = activeWorkspace === 'launcher'
  const size: SpotlightNavItemSize = isLauncher ? 'large' : 'default'
  const activeJobs = useActiveJobs()
  const activeIndex = dockItems.findIndex((item) => item.id === activeWorkspace)

  const itemsRowRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLElement | null>>([])
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties | null>(null)

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

  const runningJobs = dockItems.flatMap((item) => {
    const job = item.enabled ? activeJobs[item.id] : undefined
    return job ? [{ item, job }] : []
  })

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
            className="pointer-events-none absolute top-0 h-0.5 bg-brass-400 shadow-[0_6px_12px_rgba(240,180,41,0.55)] transition-all duration-400 ease-in-out"
            style={indicatorStyle}
          />
        ) : null}

        {dockItems.map((item, index) => {
          const isActive = activeWorkspace === item.id
          const hasRunningJob = item.enabled && Boolean(activeJobs[item.id])

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
            <Link
              key={item.id}
              ref={setItemRef}
              to={item.to}
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
            </Link>
          )
        })}
      </div>

      <AnimatePresence>
        {runningJobs.length > 0 ? (
          <motion.div
            key="dock-jobs"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="border-brass-500/15 ml-1.5 flex items-center gap-2 border-l pl-2.5">
              {runningJobs.map(({ item, job }) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    title={`${item.label}: ${job.detail}`}
                    className="surface-card hover:border-brass-500/30 flex w-40 shrink-0 flex-col gap-1.5 rounded-xl border px-3 py-2 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className="text-brass-400 h-3.5 w-3.5 shrink-0" />
                      <span className="text-silver-200 text-2xs truncate font-mono font-[560] tracking-[0.08em] uppercase">
                        {item.label}
                      </span>
                      <span className="text-silver-100 quant-tabular-nums text-2xs ml-auto font-mono font-[560]">
                        {job.pct}%
                      </span>
                    </div>
                    <div className="surface-well h-1.5 w-full overflow-hidden rounded-full">
                      <motion.div
                        className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r"
                        initial={false}
                        animate={{ width: `${job.pct}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-silver-400 truncate text-[10px]">{job.detail}</span>
                  </Link>
                )
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  )
}
