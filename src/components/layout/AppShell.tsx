import { type ReactNode, useEffect, lazy, Suspense, useCallback } from 'react'

import { CinematicScene } from '@/components/cinematic/CinematicScene'
import { AppDock } from '@/components/dock/AppDock'
import { PointerSpotlight } from '@/components/effects/PointerSpotlight'
import { BrightnessToggle } from '@/components/layout/BrightnessToggle'
import { DigitalClock } from '@/components/layout/DigitalClock'
import { MotionToggle } from '@/components/layout/MotionToggle'
import { ReaderWindowShell } from '@/components/layout/ReaderWindowShell'
import { WorkspaceGridTransition } from '@/components/transitions/WorkspaceGridTransition'
import { useWorkspaceTransitionStore } from '@/components/transitions/workspaceTransitionStore'
import { WindowControls } from '@/components/layout/WindowControls'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { Toaster, TooltipProvider } from '@/components/ui'

import { useLocation } from '@tanstack/react-router'

const LazyPerformanceInstrumentation = lazy(() =>
  import('@/components/performance/PerformanceInstrumentation').then((module) => ({
    default: module.PerformanceInstrumentation,
  })),
)

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const location = useLocation()
  const isLauncher = activeWorkspace === 'launcher'
  const isReader = location.pathname === '/news-reader'

  const reducedMotion = usePrefersReducedMotion()
  const setTransitionReducedMotion = useWorkspaceTransitionStore((s) => s.setReducedMotion)

  const focusWorkspaceMain = useCallback(() => {
    document.getElementById('workspace-main')?.focus({ preventScroll: true })
  }, [])

  // Drive reduced-motion CSS off a JS-set root attribute (not the @media query directly) so the
  // motion preference can override WebKitGTK's false `prefers-reduced-motion: reduce`.
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false'
    setTransitionReducedMotion(reducedMotion)
  }, [reducedMotion, setTransitionReducedMotion])

  if (isReader) {
    return (
      <TooltipProvider delayDuration={350} skipDelayDuration={100}>
        <ReaderWindowShell>
          {children}
          <Toaster />
        </ReaderWindowShell>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={100}>
      <div className="relative flex min-h-full flex-col">
        <CinematicScene />
        <PointerSpotlight />
        <header
          data-tauri-drag-region
          className="vt-header surface-shell surface-shell--blur border-brass-600/15 relative z-40 flex items-center justify-between border-b px-6 py-2.5 select-none"
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

          <div className="flex h-full items-center gap-2">
            <MotionToggle />
            <BrightnessToggle />
            <WindowControls />
          </div>
        </header>
        <main
          id="workspace-main"
          key={location.pathname}
          tabIndex={-1}
          className={cn(
            'flex-1 overflow-auto px-6 pt-6',
            isLauncher ? 'flex min-h-0 flex-1 flex-col overflow-hidden pt-6 pb-0' : 'pb-32',
          )}
        >
          {children}
        </main>
        <WorkspaceGridTransition onSettled={focusWorkspaceMain} />
        <AppDock activeWorkspace={activeWorkspace} />
        {env.perfHud ? (
          <Suspense fallback={null}>
            <LazyPerformanceInstrumentation />
          </Suspense>
        ) : null}
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
