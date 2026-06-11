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
      <header className="border-brass-600/15 bg-espresso-950/40 flex items-center justify-between border-b px-6 py-2.5 shadow-[0_4px_30px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <QuantEmblem className="h-10 w-10" />
          <div>
            <h1 className="text-silver-100 text-sm font-medium tracking-[0.2em] uppercase">
              Quant
            </h1>
            <p className="text-silver-400 text-xs">Desktop research platform</p>
          </div>
        </div>
        <div className="border-brass-600/30 bg-brass-600/10 text-brass-400 flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold tracking-wider uppercase shadow-[0_0_10px_rgba(196,165,116,0.05)]">
          <span className="bg-brass-400 h-1 w-1 animate-pulse rounded-full" />
          Phase 1 · Foundation
        </div>
      </header>
      <main
        className={cn(
          'animate-fade-in-up flex-1 overflow-auto px-6 pt-6',
          isLauncher ? 'pb-6' : 'pb-32',
        )}
      >
        {children}
      </main>
      <AppDock activeWorkspace={activeWorkspace} />
    </div>
  )
}
