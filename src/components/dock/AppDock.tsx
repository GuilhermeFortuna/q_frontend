import { Link } from '@tanstack/react-router'
import {
  Activity,
  BarChart3,
  Compass,
  Database,
  Home,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { useActiveJobs } from '@/hooks/useActiveJobs'
import { cn } from '@/lib/utils'
import type { WorkspaceId } from '@/types/api'

type DockItem = {
  id: WorkspaceId
  label: string
  to: string
  icon: typeof Home
  enabled: boolean
}

const dockItems: DockItem[] = [
  { id: 'launcher', label: 'Launcher', to: '/', icon: Home, enabled: true },
  { id: 'market-data', label: 'Market', to: '/market-data', icon: BarChart3, enabled: true },
  { id: 'storage', label: 'Storage', to: '/storage', icon: Database, enabled: true },
  { id: 'backtests', label: 'Backtests', to: '/backtests', icon: Activity, enabled: true },
  { id: 'optimize', label: 'Optimize', to: '/optimize', icon: SlidersHorizontal, enabled: true },
  { id: 'validate', label: 'Validate', to: '/validate', icon: ShieldCheck, enabled: true },
  { id: 'discover', label: 'Discover', to: '/discover', icon: Compass, enabled: true },
  { id: 'system', label: 'System', to: '/system', icon: Settings, enabled: true },
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
        'vt-dock fixed left-1/2 z-20 flex -translate-x-1/2 items-end backdrop-blur-xl transition-all duration-300 ease-in-out',
        isLauncher
          ? 'border-brass-500/20 from-espresso-950/80 to-carbon-950/90 bottom-[12%] w-[min(980px,95vw)] justify-evenly gap-2.5 rounded-3xl border bg-gradient-to-b px-6 py-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),_0_0_40px_rgba(196,165,116,0.08)]'
          : 'border-brass-500/20 from-espresso-950/85 to-carbon-950/92 bottom-8 gap-1.5 rounded-2xl border bg-gradient-to-b px-3.5 py-2.5 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8),_0_0_30px_rgba(196,165,116,0.06)]',
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
              <Icon className={isLauncher ? 'h-9 w-9' : 'h-6 w-6'} />
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
              'text-cream-300 relative flex flex-col items-center border border-transparent transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-105 active:scale-95',
              isLauncher ? 'shrink-0 gap-1.5 rounded-xl px-4 py-3' : 'gap-1 rounded-lg px-4 py-2.5',
              isActive
                ? 'text-brass-400 font-bold'
                : 'hover:text-silver-100 hover:bg-carbon-800/35 hover:border-carbon-700/20',
            )}
          >
            {isActive ? (
              <>
                <motion.span
                  layoutId="dock-active"
                  className={cn(
                    'from-brass-500/10 to-brass-600/5 border-brass-500/30 absolute inset-0 border bg-gradient-to-b shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_15px_rgba(196,165,116,0.12)]',
                    isLauncher ? 'rounded-xl' : 'rounded-lg',
                  )}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
                <span className="bg-brass-400 absolute bottom-1.5 left-1/2 z-10 h-0.5 w-3.5 -translate-x-1/2 rounded-full shadow-[0_0_8px_rgba(196,165,116,0.8)]" />
              </>
            ) : null}
            <span className="relative z-10 flex">
              <Icon className={isLauncher ? 'h-9 w-9' : 'h-6 w-6'} />
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
                    className="bg-carbon-900/40 hover:bg-carbon-800/50 border-carbon-700/30 hover:border-brass-500/30 flex w-40 shrink-0 flex-col gap-1.5 rounded-xl border px-3 py-2 transition-colors"
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
                    <div className="bg-carbon-950/85 border-brass-600/10 h-1.5 w-full overflow-hidden rounded-full border shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
                      <motion.div
                        className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r shadow-[0_0_8px_rgba(196,165,116,0.35)]"
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
