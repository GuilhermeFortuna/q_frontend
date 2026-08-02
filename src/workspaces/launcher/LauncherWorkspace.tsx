import { useLayoutEffect, useRef } from 'react'

import { LauncherDashboard } from '@/components/launcher/LauncherDashboard'

export function LauncherWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    // Stamp floating material shells owned by LauncherDashboard without restaging it.
    const panels = root.querySelectorAll<HTMLElement>('.absolute.z-30')
    panels[0]?.setAttribute('data-workspace-transition-surface', 'primary')
    panels[1]?.setAttribute('data-workspace-transition-surface', 'secondary')
  }, [])

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-1 flex-col"
      data-workspace-transition-root="launcher"
    >
      <h1 className="sr-only" data-workspace-transition-anchor="launcher">
        Launcher
      </h1>
      <LauncherDashboard />
    </div>
  )
}
