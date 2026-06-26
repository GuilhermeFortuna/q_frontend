import { useEffect, useState } from 'react'

import { useAppStore } from '@/store/useAppStore'

function readOsReduce(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Effective reduced-motion for decorative effects (particles, panel sheen, spotlight).
 *
 * `motionMode` is the authority: 'full' (default) never reduces; 'system' honors the OS query.
 * This indirection exists because WebKitGTK (Tauri desktop) reports `prefers-reduced-motion: reduce`
 * from the GTK "enable animations" setting — falsely disabling all ambient effects on the desktop
 * while Chromium (web) reported `no-preference`. The motion toggle lets users opt back to 'system'.
 */
export function usePrefersReducedMotion(): boolean {
  const motionMode = useAppStore((s) => s.motionMode)
  const [osReduce, setOsReduce] = useState(readOsReduce)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setOsReduce(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return motionMode === 'system' && osReduce
}
