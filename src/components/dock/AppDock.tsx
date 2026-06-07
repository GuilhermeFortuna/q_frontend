import { Link } from '@tanstack/react-router'
import { Activity, BarChart3, FlaskConical, Home, Settings } from 'lucide-react'
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
  { id: 'system', label: 'System', to: '/system', icon: Settings, enabled: true },
]

type AppDockProps = {
  activeWorkspace: WorkspaceId
}

export function AppDock({ activeWorkspace }: AppDockProps) {
  return (
    <nav
      aria-label="Workspace dock"
      className="border-carbon-600/80 bg-carbon-900/90 fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-end gap-1 rounded-xl border px-2 py-2 shadow-lg backdrop-blur-md"
    >
      {dockItems.map((item) => {
        const Icon = item.icon
        const isActive = activeWorkspace === item.id

        if (!item.enabled) {
          return (
            <span
              key={item.id}
              title={`${item.label} (coming soon)`}
              className="text-silver-400 flex cursor-not-allowed flex-col items-center gap-1 rounded-lg px-3 py-2 opacity-40"
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] tracking-wide uppercase">{item.label}</span>
            </span>
          )
        }

        return (
          <Link
            key={item.id}
            to={item.to}
            className={cn(
              'text-silver-300 relative flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-colors',
              isActive ? 'text-brass-400' : 'hover:text-silver-100',
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="dock-active"
                className="bg-brass-600/15 ring-brass-500/40 absolute inset-0 rounded-lg ring-1"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            ) : null}
            <Icon className="relative h-5 w-5" />
            <span className="relative text-[10px] tracking-wide uppercase">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
