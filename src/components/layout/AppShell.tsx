import type { ReactNode } from 'react'

import { QuantBackground } from '@/components/background/QuantBackground'
import { QuantEmblem } from '@/components/brand/QuantEmblem'
import { AppDock } from '@/components/dock/AppDock'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const isLauncher = activeWorkspace === 'launcher'

  return (
    <div className="relative flex min-h-full flex-col">
      <QuantBackground />
      <header className="border-brass-600/20 bg-espresso-950/40 flex items-center justify-between border-b px-6 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <QuantEmblem className="h-10 w-10" />
          <div>
            <p className="text-silver-100 text-sm font-medium tracking-[0.2em] uppercase">Quant</p>
            <p className="text-silver-400 text-xs">Desktop research platform</p>
          </div>
        </div>
        <p className="text-silver-400 font-mono text-xs">Phase 1 · Foundation</p>
      </header>
      <main className={cn('flex-1 overflow-auto px-6 pt-6', isLauncher ? 'pb-6' : 'pb-32')}>
        {children}
      </main>
      <AppDock activeWorkspace={activeWorkspace} />
    </div>
  )
}
