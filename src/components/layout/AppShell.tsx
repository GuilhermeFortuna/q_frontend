import { type ReactNode, useState, useEffect } from 'react'

import { QuantBackground } from '@/components/background/QuantBackground'
import { AppDock } from '@/components/dock/AppDock'
import { PointerSpotlight } from '@/components/effects/PointerSpotlight'
import { BrightnessToggle } from '@/components/layout/BrightnessToggle'
import { DigitalClock } from '@/components/layout/DigitalClock'
import { ReaderWindowShell } from '@/components/layout/ReaderWindowShell'
import { WindowControls } from '@/components/layout/WindowControls'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

import { useLocation } from '@tanstack/react-router'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const location = useLocation()
  const isLauncher = activeWorkspace === 'launcher'
  const isReader = location.pathname === '/news-reader'

  const [rippleKey, setRippleKey] = useState(0)

  useEffect(() => {
    if (activeWorkspace) {
      setRippleKey((prev) => prev + 1)
    }
  }, [activeWorkspace])

  if (isReader) {
    return <ReaderWindowShell>{children}</ReaderWindowShell>
  }

  return (
    <div className="relative flex min-h-full flex-col">
      <QuantBackground />
      <PointerSpotlight />
      <div className="quant-noise-overlay" />
      <div className="quant-vignette-overlay" />
      {rippleKey > 0 && <div key={rippleKey} className="quant-edge-ripple animate-edge-ripple" />}
      <header
        data-tauri-drag-region
        className="vt-header border-brass-600/15 bg-espresso-950/75 relative flex items-center justify-between border-b px-6 py-2.5 shadow-[0_4px_30px_rgba(0,0,0,0.4)] select-none"
      >
        <div className="flex items-center gap-2.5" data-tauri-drag-region>
          <img
            src="/quant-logo-text.png"
            alt="QUANT"
            className="block h-3.5 w-auto object-contain select-none"
          />
        </div>

        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="pointer-events-auto">
            <DigitalClock />
          </div>
        </div>

        <div className="flex h-full items-center gap-6">
          <BrightnessToggle />
          <div className="border-brass-600/30 bg-brass-600/10 text-brass-400 flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold tracking-wider uppercase shadow-[0_0_10px_rgba(196,165,116,0.05)]">
            <span className="bg-brass-400 h-1 w-1 animate-pulse rounded-full" />
            Phase 1 · Foundation
          </div>
          <WindowControls />
        </div>
      </header>
      <main
        className={cn(
          'vt-main animate-fade-in-up flex-1 overflow-auto px-6 pt-6',
          isLauncher ? 'flex min-h-0 flex-1 flex-col overflow-hidden pt-6 pb-0' : 'pb-32',
        )}
      >
        {children}
      </main>
      <AppDock activeWorkspace={activeWorkspace} />
    </div>
  )
}
