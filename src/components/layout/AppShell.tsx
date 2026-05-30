import type { ReactNode } from 'react'

import { QuantMeshBackground } from '@/components/background/QuantMeshBackground'
import { AppDock } from '@/components/dock/AppDock'
import { useAppStore } from '@/store/useAppStore'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)

  return (
    <div className="relative flex min-h-full flex-col">
      <QuantMeshBackground />
      <header className="flex items-center justify-between border-b border-carbon-700/80 px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-md border border-brass-600/40 bg-brass-600/10 font-mono text-sm text-brass-400"
            aria-hidden
          >
            Q
          </div>
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-silver-100 uppercase">Quant</p>
            <p className="text-xs text-silver-400">Desktop research platform</p>
          </div>
        </div>
        <p className="font-mono text-xs text-silver-400">Phase 1 · Foundation</p>
      </header>
      <main className="flex-1 overflow-auto px-6 pb-28 pt-6">{children}</main>
      <AppDock activeWorkspace={activeWorkspace} />
    </div>
  )
}
