import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import type { ComponentType } from 'react'

import {
  LauncherIcon,
  MarketIcon,
  StorageIcon,
  BacktestsIcon,
  ValidateIcon,
  DiscoverIcon,
  ExecutionIcon,
  ResearchIcon,
  SystemIcon,
} from '@/components/dock/DockIcons'
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
  { id: 'validate', label: 'Validate', to: '/validate', icon: ValidateIcon, enabled: true },
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
  const activeJobs = useActiveJobs()

  const runningJobs = dockItems.flatMap((item) => {
    const job = item.enabled ? activeJobs[item.id] : undefined
    return job ? [{ item, job }] : []
  })

  return (
    <nav
      aria-label="Workspace dock"
      className={cn(
        'vt-dock surface-shell--blur fixed left-1/2 z-20 flex -translate-x-1/2 items-end transition-[transform,opacity,border-color,box-shadow,background-color] duration-300 ease-in-out',
        isLauncher
          ? 'border-brass-500/20 border-t-brass-400/50 from-espresso-900/80 via-espresso-950/92 to-carbon-950/96 hover:border-brass-500/30 hover:border-t-brass-400/80 bottom-[12%] w-[min(980px,95vw)] justify-evenly gap-2.5 rounded-3xl border border-b-black/60 bg-gradient-to-b px-6 py-4 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.16),_inset_0_-2px_0_rgba(0,0,0,0.65),_inset_0_0_0_1px_rgba(255,255,255,0.03),_0_25px_60px_-15px_rgba(0,0,0,0.9),_0_0_40px_rgba(196,165,116,0.08)] hover:border-b-black/80 hover:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.22),_inset_0_-2px_0_rgba(0,0,0,0.75),_inset_0_0_0_1px_rgba(255,255,255,0.05),_0_30px_70px_-10px_rgba(0,0,0,0.95),_0_0_50px_rgba(196,165,116,0.12)]'
          : 'border-brass-500/20 border-t-brass-400/50 from-espresso-900/80 via-espresso-950/92 to-carbon-950/96 hover:border-brass-500/30 hover:border-t-brass-400/80 bottom-8 gap-1.5 rounded-2xl border border-b-black/60 bg-gradient-to-b px-3.5 py-2.5 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.16),_inset_0_-2px_0_rgba(0,0,0,0.65),_inset_0_0_0_1px_rgba(255,255,255,0.03),_0_20px_50px_-10px_rgba(0,0,0,0.8),_0_0_30px_rgba(196,165,116,0.06)] hover:border-b-black/80 hover:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.22),_inset_0_-2px_0_rgba(0,0,0,0.75),_inset_0_0_0_1px_rgba(255,255,255,0.05),_0_25px_60px_-5px_rgba(0,0,0,0.85),_0_0_40px_rgba(196,165,116,0.1)]',
      )}
    >
      {dockItems.map((item) => {
        const Icon = item.icon
        const isActive = activeWorkspace === item.id
        const hasRunningJob = item.enabled && Boolean(activeJobs[item.id])

        if (!item.enabled) {
          return (
            <span
              key={item.id}
              title={`${item.label} (coming soon)`}
              className={cn(
                'text-silver-500 flex cursor-not-allowed flex-col items-center border border-transparent opacity-40 select-none',
                isLauncher
                  ? 'shrink-0 gap-1.5 rounded-xl px-4 py-3'
                  : 'gap-1 rounded-lg px-4 py-2.5',
              )}
            >
              <Icon className={cn(isLauncher ? 'h-9 w-9' : 'h-6 w-6', 'opacity-20 grayscale')} />
              <span
                className={cn(
                  'font-mono font-bold tracking-wider uppercase',
                  isLauncher ? 'text-xs' : 'text-[10px]',
                )}
              >
                {item.label}
              </span>
            </span>
          )
        }

        return (
          <Link
            key={item.id}
            to={item.to}
            className={cn(
              'text-cream-300 cubic-bezier(0.16,1,0.3,1) group relative flex flex-col items-center border border-transparent transition-[transform,color,background-color,border-color] duration-350 hover:-translate-y-0.5 hover:scale-105 active:scale-95',
              isLauncher ? 'shrink-0 gap-1.5 rounded-xl px-4 py-3' : 'gap-1 rounded-lg px-4 py-2.5',
              isActive ? 'text-gold-400 font-bold' : 'text-silver-400 hover:text-silver-200',
            )}
          >
            {isActive ? (
              <>
                <motion.span
                  layoutId="dock-active"
                  className={cn(
                    'accent-state absolute inset-0 border',
                    isLauncher ? 'rounded-xl' : 'rounded-lg',
                  )}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
                <span className="bg-brass-400 absolute bottom-1.5 left-1/2 z-10 h-0.5 w-3.5 -translate-x-1/2 rounded-full shadow-[0_0_8px_rgba(240,180,41,0.9)]" />
              </>
            ) : null}
            <span className="relative z-10 flex">
              <Icon
                className={cn(
                  isLauncher ? 'h-9 w-9' : 'h-6 w-6',
                  'transition-all duration-300 ease-out',
                  isActive
                    ? 'text-brass-400 scale-110 brightness-110'
                    : 'scale-95 opacity-50 group-hover:scale-105 group-hover:opacity-100',
                )}
              />
              {hasRunningJob ? (
                <span
                  className="absolute -top-0.5 -right-1 flex h-2 w-2"
                  title={`${item.label} job running`}
                  aria-label={`${item.label} job running`}
                >
                  <span className="bg-brass-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                  <span className="bg-brass-400 relative inline-flex h-2 w-2 rounded-full shadow-[0_0_8px_rgba(196,165,116,0.8)]" />
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                'relative z-10 font-mono font-bold tracking-wider uppercase',
                isLauncher ? 'text-xs' : 'text-[10px]',
              )}
            >
              {item.label}
            </span>
          </Link>
        )
      })}

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
                      <span className="text-silver-200 truncate font-mono text-[10px] font-bold tracking-wider uppercase">
                        {item.label}
                      </span>
                      <span className="text-brass-400 ml-auto font-mono text-[10px] font-bold tabular-nums">
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
