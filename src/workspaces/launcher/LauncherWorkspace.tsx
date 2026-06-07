import { Link } from '@tanstack/react-router'
import { ArrowRight, BarChart3, Settings } from 'lucide-react'
import { motion } from 'motion/react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSystemHealth } from '@/api/queries/system'
import { formatDisplayDateTime } from '@/lib/formatDate'

const workspaceCards = [
  {
    title: 'Market Data',
    description: 'Instruments, snapshots, and OHLCV exploration.',
    to: '/market-data',
    icon: BarChart3,
  },
  {
    title: 'System',
    description: 'Backend health, data lake status, and sync telemetry.',
    to: '/system',
    icon: Settings,
  },
] as const

export function LauncherWorkspace() {
  const { data: health, isLoading } = useSystemHealth()

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <p className="text-brass-500 mb-2 font-mono text-xs tracking-[0.35em] uppercase">
          Quant Desktop
        </p>
        <h1 className="text-silver-100 text-3xl font-medium tracking-tight">
          Research infrastructure, engineered.
        </h1>
        <p className="text-silver-400 mx-auto mt-3 max-w-xl text-sm">
          Phase 1 foundation: Tauri shell, React workspaces, mock API, and the carbon / brass visual
          system. Connect q_backend when ready.
        </p>
      </motion.section>

      <div className="grid gap-4 sm:grid-cols-2">
        {workspaceCards.map((item, index) => {
          const Icon = item.icon
          return (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index, duration: 0.3 }}
            >
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="text-brass-400 h-4 w-4" />
                    <CardTitle>{item.title}</CardTitle>
                  </div>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="brass" size="sm" asChild>
                    <Link to={item.to}>
                      Open workspace
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform status</CardTitle>
          <CardDescription>
            {isLoading ? 'Checking mock API…' : `Backend ${health?.status ?? 'unknown'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {health ? (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-silver-400">Version</dt>
                <dd className="text-silver-100 font-mono">{health.backendVersion}</dd>
              </div>
              <div>
                <dt className="text-silver-400">Data lake</dt>
                <dd className="text-silver-100 font-mono capitalize">{health.dataLakeStatus}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-silver-400">Last sync</dt>
                <dd className="text-silver-100 font-mono">
                  {formatDisplayDateTime(health.lastSyncAt)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-silver-400 text-sm">Unable to load health endpoint.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
