import { useEffect } from 'react'

import {
  SPOTLIGHT_SELECTOR,
  clearGlowSpotVars,
  writeGlowSpotVars,
  writeLivingSpotVars,
  writeSpotVars,
} from '@/components/effects/pointerSpotlightUtils'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useAppStore } from '@/store/useAppStore'

/**
 * App-wide pointer-reactive lighting for living panels, suede controls, and glow cards.
 *
 * One rAF-throttled `pointermove` listener writes:
 * - panel-local `--spot-x` / `--spot-y` to living / suede ancestors
 * - local `--x` / `--y` / `--xp` / `--yp` to `[data-glow]` ancestors
 * and clears glow vars on hosts that are no longer under the pointer
 * (prevents frozen border light on random edges).
 *
 * Renders nothing; mount once near the app root.
 */
export function PointerSpotlight() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (reducedMotion) {
      return
    }

    let raf = 0
    let clientX = 0
    let clientY = 0
    let target: Element | null = null
    let spotlightRaw: HTMLElement | null = null
    let spotlightLit: HTMLElement | null = null
    let activeGlowHosts: HTMLElement[] = []

    const flush = () => {
      raf = 0

      if (target) {
        writeLivingSpotVars(target, clientX, clientY)
        activeGlowHosts = writeGlowSpotVars(target, clientX, clientY, activeGlowHosts)
      }

      if (activeWorkspace === 'launcher') {
        const nextSpotlight = target?.closest<HTMLElement>(SPOTLIGHT_SELECTOR) ?? null
        if (nextSpotlight !== spotlightRaw) {
          spotlightRaw = nextSpotlight
          spotlightLit?.classList.remove('is-lit')
          spotlightLit =
            nextSpotlight && !nextSpotlight.querySelector(SPOTLIGHT_SELECTOR) ? nextSpotlight : null
          spotlightLit?.classList.add('is-lit')
        }
        if (spotlightLit) {
          writeSpotVars(spotlightLit, clientX, clientY)
        }
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
      spotlightLit?.classList.remove('is-lit')
      spotlightLit = null
      spotlightRaw = null
      target = null
      clearGlowSpotVars(activeGlowHosts)
      activeGlowHosts = []
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
  }, [activeWorkspace, reducedMotion])

  return null
}
