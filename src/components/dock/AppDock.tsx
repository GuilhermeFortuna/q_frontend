import { Link } from '@tanstack/react-router'
import { Activity, BarChart3, FlaskConical, Home, Settings, SlidersHorizontal } from 'lucide-react'
import { motion } from 'motion/react'

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
  { id: 'research', label: 'Research', to: '/research', icon: FlaskConical, enabled: false },
  { id: 'backtests', label: 'Backtests', to: '/backtests', icon: Activity, enabled: true },
  { id: 'optimize', label: 'Optimize', to: '/optimize', icon: SlidersHorizontal, enabled: true },
  { id: 'system', label: 'System', to: '/system', icon: Settings, enabled: true },
]

type AppDockProps = {
  activeWorkspace: WorkspaceId
}

export function AppDock({ activeWorkspace }: AppDockProps) {
  const isLauncher = activeWorkspace === 'launcher'

  return (
    <nav
      aria-label="Workspace dock"
      className={cn(
        'border-brass-600/30 bg-espresso-900/75 fixed left-1/2 z-20 flex -translate-x-1/2 items-end shadow-lg shadow-black/30 backdrop-blur-lg',
        isLauncher
          ? 'bottom-[18%] w-[min(720px,58vw)] justify-evenly gap-3 rounded-3xl border px-8 py-5'
          : 'bottom-8 gap-1 rounded-2xl border px-3 py-2.5',
      )}
    >
      {dockItems.map((item) => {
        const Icon = item.icon
        const isActive = activeWorkspace === item.id

        if (!item.enabled) {
          return (
            <span
              key={item.id}
              title={`${item.label} (coming soon)`}
              className={cn(
                'text-cream-300 flex cursor-not-allowed flex-col items-center opacity-40',
                isLauncher ? 'gap-2 rounded-xl px-6 py-4' : 'gap-1 rounded-lg px-4 py-2.5',
              )}
            >
              <Icon className={isLauncher ? 'h-9 w-9' : 'h-6 w-6'} />
              <span
                className={cn('tracking-wide uppercase', isLauncher ? 'text-xs' : 'text-[11px]')}
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
              'text-cream-300 relative flex flex-col items-center transition-colors',
              isLauncher ? 'gap-2 rounded-xl px-6 py-4' : 'gap-1 rounded-lg px-4 py-2.5',
              isActive ? 'text-gold-400' : 'hover:text-cream-200',
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="dock-active"
                className={cn(
                  'bg-brass-600/20 ring-gold-400/50 absolute inset-0 ring-1',
                  isLauncher ? 'rounded-xl' : 'rounded-lg',
                )}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            ) : null}
            <Icon className={cn('relative', isLauncher ? 'h-9 w-9' : 'h-6 w-6')} />
            <span
              className={cn(
                'relative tracking-wide uppercase',
                isLauncher ? 'text-xs' : 'text-[11px]',
              )}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
