import { useEffect } from 'react'

/**
 * App-wide pointer-reactive lighting.
 *
 * A single rAF-throttled `pointermove` listener finds the `.quant-panel` under
 * the cursor and writes panel-local coordinates into `--spot-x` / `--spot-y`,
 * toggling `.is-lit`. The CSS in globals.css turns those into a brass highlight
 * that tracks the cursor across every panel — no per-component markup needed.
 *
 * Renders nothing; mount once near the app root.
 */
export function PointerSpotlight() {
  useEffect(() => {
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
      const next = target?.closest<HTMLElement>('.quant-panel') ?? null

      if (next !== raw) {
        raw = next
        lit?.classList.remove('is-lit')
        // Only light leaf panels. Container panels (the big workspace shells that
        // wrap card panels) would otherwise glow in their dead space when the
        // cursor sits between their children.
        lit = next && !next.querySelector('.quant-panel') ? next : null
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
  }, [])

  return null
}
