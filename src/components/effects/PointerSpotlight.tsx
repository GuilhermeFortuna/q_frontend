import { useEffect } from 'react'

import { useAppStore } from '@/store/useAppStore'

/**
 * App-wide pointer-reactive lighting.
 *
 * A single rAF-throttled `pointermove` listener finds `.quant-panel--spotlight` /
 * `.surface-panel--spotlight` under the cursor and writes panel-local coordinates
 * the cursor and writes panel-local coordinates into `--spot-x` / `--spot-y`,
 * toggling `.is-lit` (drives the ::after highlight opacity). The CSS in
 * globals.css keeps the radial highlight on a compositor-promoted overlay so
 * panel content does not repaint on pointer move.
 *
 * Renders nothing; mount once near the app root.
 */
export function PointerSpotlight() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)

  useEffect(() => {
    if (activeWorkspace !== 'launcher') {
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    let raf = 0
    let clientX = 0
    let clientY = 0
    let target: Element | null = null
    let raw: Element | null = null
    let lit: HTMLElement | null = null

    const flush = () => {
      raf = 0
      const next =
        target?.closest<HTMLElement>('.quant-panel--spotlight, .surface-panel--spotlight') ?? null

      if (next !== raw) {
        raw = next
        lit?.classList.remove('is-lit')
        // Only light leaf panels. Container panels (the big workspace shells that
        // wrap card panels) would otherwise glow in their dead space when the
        // cursor sits between their children.
        lit =
          next && !next.querySelector('.quant-panel--spotlight, .surface-panel--spotlight')
            ? next
            : null
        lit?.classList.add('is-lit')
      }

      if (lit) {
        const rect = lit.getBoundingClientRect()
        lit.style.setProperty('--spot-x', `${clientX - rect.left}px`)
        lit.style.setProperty('--spot-y', `${clientY - rect.top}px`)
      }
    }

    const handleMove = (event: PointerEvent) => {
      clientX = event.clientX
      clientY = event.clientY
      target = event.target as Element | null
      if (!raf) raf = requestAnimationFrame(flush)
    }

    const clear = () => {
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      lit?.classList.remove('is-lit')
      lit = null
      raw = null
      target = null
    }

    document.addEventListener('pointermove', handleMove, { passive: true })
    document.addEventListener('pointerleave', clear)
    window.addEventListener('blur', clear)

    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerleave', clear)
      window.removeEventListener('blur', clear)
      clear()
    }
  }, [activeWorkspace])

  return null
}
