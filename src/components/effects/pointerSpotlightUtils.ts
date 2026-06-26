export const LIVING_SELECTOR = '.surface-panel--living'
export const SPOTLIGHT_SELECTOR = '.quant-panel--spotlight, .surface-panel--spotlight'

export function writeSpotVars(panel: HTMLElement, clientX: number, clientY: number) {
  const rect = panel.getBoundingClientRect()
  panel.style.setProperty('--spot-x', `${clientX - rect.left}px`)
  panel.style.setProperty('--spot-y', `${clientY - rect.top}px`)
}

/** Every living panel from innermost to outermost along the ancestor chain. */
export function collectLivingAncestors(target: Element | null): HTMLElement[] {
  const panels: HTMLElement[] = []
  let el = target

  while (el) {
    if (el instanceof HTMLElement && el.matches(LIVING_SELECTOR)) {
      panels.push(el)
    }
    el = el.parentElement
  }

  return panels
}

export function writeLivingSpotVars(target: Element | null, clientX: number, clientY: number) {
  for (const panel of collectLivingAncestors(target)) {
    writeSpotVars(panel, clientX, clientY)
  }
}
