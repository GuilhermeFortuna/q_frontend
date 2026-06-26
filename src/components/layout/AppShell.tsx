import { type ReactNode, useState, useEffect, lazy, Suspense } from 'react'

import { CinematicScene } from '@/components/cinematic/CinematicScene'
import { AppDock } from '@/components/dock/AppDock'
import { PointerSpotlight } from '@/components/effects/PointerSpotlight'
import { BrightnessToggle } from '@/components/layout/BrightnessToggle'
import { DigitalClock } from '@/components/layout/DigitalClock'
import { MotionToggle } from '@/components/layout/MotionToggle'
import { ReaderWindowShell } from '@/components/layout/ReaderWindowShell'
import { WindowControls } from '@/components/layout/WindowControls'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

import { useLocation } from '@tanstack/react-router'

const LazyPerformanceInstrumentation = lazy(() =>
  import('@/components/performance/PerformanceInstrumentation').then((module) => ({
    default: module.PerformanceInstrumentation,
  })),
)

type AppShellProps = {
  children: ReactNode
}

function PhasePill() {
  return (
    <div className="surface-card accent-state flex items-center gap-1.5 rounded-full border px-3 py-1">
      <span className="live-status-dot bg-brass-400 h-1 w-1 rounded-full" aria-hidden />
      <span className="accent-wayfinding font-mono text-[10px] font-semibold tracking-wider uppercase">
        Phase 1 · Foundation
      </span>
    </div>
  )
}

export function AppShell({ children }: AppShellProps) {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const location = useLocation()
  const isLauncher = activeWorkspace === 'launcher'
  const isReader = location.pathname === '/news-reader'

  const [rippleKey, setRippleKey] = useState(0)
  const reducedMotion = usePrefersReducedMotion()

  // Drive reduced-motion CSS off a JS-set root attribute (not the @media query directly) so the
  // motion preference can override WebKitGTK's false `prefers-reduced-motion: reduce`.
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false'
  }, [reducedMotion])

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
      <CinematicScene />
      <PointerSpotlight />
      {rippleKey > 0 && <div key={rippleKey} className="quant-edge-ripple animate-edge-ripple" />}
      <header
        data-tauri-drag-region
        className="vt-header surface-shell surface-shell--blur border-brass-600/15 relative flex items-center justify-between border-b px-6 py-2.5 select-none"
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
          <MotionToggle />
          <BrightnessToggle />
          <PhasePill />
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
      {env.perfHud ? (
        <Suspense fallback={null}>
          <LazyPerformanceInstrumentation />
        </Suspense>
      ) : null}
    </div>
  )
}
