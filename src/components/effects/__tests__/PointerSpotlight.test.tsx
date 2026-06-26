import { describe, expect, it, afterEach } from 'vitest'

import {
  collectLivingAncestors,
  writeLivingSpotVars,
} from '@/components/effects/pointerSpotlightUtils'

function stubRect(el: HTMLElement, left: number, top: number, width: number, height: number) {
  el.getBoundingClientRect = () =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect
}

describe('pointerSpotlightUtils', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('collects every living panel from innermost to outermost', () => {
    document.body.innerHTML = `
      <div class="surface-panel--living" id="outer">
        <div class="surface-panel--living" id="inner">
          <button type="button" id="target">Go</button>
        </div>
      </div>
    `

    const target = document.getElementById('target')
    const panels = collectLivingAncestors(target)

    expect(panels.map((panel) => panel.id)).toEqual(['inner', 'outer'])
  })

  it('writes --spot-x/--spot-y to all living ancestors (WO121 nesting guard)', () => {
    document.body.innerHTML = `
      <div class="surface-panel--living" id="outer">
        <div class="surface-panel--living" id="inner">
          <button type="button" id="target">Go</button>
        </div>
      </div>
    `

    const outer = document.getElementById('outer') as HTMLElement
    const inner = document.getElementById('inner') as HTMLElement
    const target = document.getElementById('target')

    stubRect(outer, 0, 0, 400, 400)
    stubRect(inner, 50, 50, 200, 200)

    writeLivingSpotVars(target, 150, 150)

    expect(inner.style.getPropertyValue('--spot-x')).toBe('100px')
    expect(inner.style.getPropertyValue('--spot-y')).toBe('100px')
    expect(outer.style.getPropertyValue('--spot-x')).toBe('150px')
    expect(outer.style.getPropertyValue('--spot-y')).toBe('150px')
  })
})
