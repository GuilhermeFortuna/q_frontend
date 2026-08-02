export const LIVING_SELECTOR = '.surface-panel--living'
export const SUEDE_SELECTOR = '.surface-suede, .surface-control'
export const SPOTLIGHT_SELECTOR = '.quant-panel--spotlight, .surface-panel--spotlight'
/** Host glow shells only — bloom marker uses `data-glow-bloom`, not `data-glow`. */
export const GLOW_SELECTOR = '[data-glow]'

export function writeSpotVars(panel: HTMLElement, clientX: number, clientY: number) {
  const rect = panel.getBoundingClientRect()
  panel.style.setProperty('--spot-x', `${clientX - rect.left}px`)
  panel.style.setProperty('--spot-y', `${clientY - rect.top}px`)
}

/** Local pointer coords for `[data-glow]` (required under transformed ancestors). */
export function writeGlowVars(node: HTMLElement, clientX: number, clientY: number) {
  const rect = node.getBoundingClientRect()
  const width = rect.width || 1
  const height = rect.height || 1
  const localX = clientX - rect.left
  const localY = clientY - rect.top
  node.style.setProperty('--x', `${localX.toFixed(2)}px`)
  node.style.setProperty('--y', `${localY.toFixed(2)}px`)
  node.style.setProperty('--xp', (localX / width).toFixed(2))
  node.style.setProperty('--yp', (localY / height).toFixed(2))
}

/** Every living panel or suede control from innermost to outermost along the ancestor chain. */
export function collectLivingAncestors(target: Element | null): HTMLElement[] {
  const panels: HTMLElement[] = []
  let el = target

  while (el) {
    if (el instanceof HTMLElement && (el.matches(LIVING_SELECTOR) || el.matches(SUEDE_SELECTOR))) {
      panels.push(el)
    }
    el = el.parentElement
  }

  return panels
}

/** Every glow host from innermost to outermost (skips bloom children). */
export function collectGlowAncestors(target: Element | null): HTMLElement[] {
  const nodes: HTMLElement[] = []
  let el = target

  while (el) {
    if (el instanceof HTMLElement && el.matches(GLOW_SELECTOR)) {
      nodes.push(el)
    }
    el = el.parentElement
  }

  return nodes
}

export function writeLivingSpotVars(target: Element | null, clientX: number, clientY: number) {
  for (const panel of collectLivingAncestors(target)) {
    writeSpotVars(panel, clientX, clientY)
  }
}

export function writeGlowSpotVars(target: Element | null, clientX: number, clientY: number) {
  for (const node of collectGlowAncestors(target)) {
    writeGlowVars(node, clientX, clientY)
  }
}
