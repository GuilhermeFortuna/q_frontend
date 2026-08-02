import { describe, expect, it, afterEach } from 'vitest'

import {
  clearGlowVars,
  collectGlowAncestors,
  collectLivingAncestors,
  writeGlowSpotVars,
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

  it('collects glow hosts and skips bloom markers', () => {
    document.body.innerHTML = `
      <div data-glow="panel" id="outer">
        <div data-glow-bloom aria-hidden="true"></div>
        <div data-glow="tile" id="inner">
          <div data-glow-bloom aria-hidden="true"></div>
          <button type="button" id="target">Go</button>
        </div>
      </div>
    `

    const target = document.getElementById('target')
    const hosts = collectGlowAncestors(target)

    expect(hosts.map((node) => node.id)).toEqual(['inner', 'outer'])
  })

  it('writes local --x/--y/--xp/--yp to glow ancestors', () => {
    document.body.innerHTML = `
      <div data-glow="panel" id="outer">
        <div data-glow="card" id="inner">
          <button type="button" id="target">Go</button>
        </div>
      </div>
    `

    const outer = document.getElementById('outer') as HTMLElement
    const inner = document.getElementById('inner') as HTMLElement
    const target = document.getElementById('target')

    stubRect(outer, 0, 0, 400, 400)
    stubRect(inner, 50, 50, 200, 200)

    writeGlowSpotVars(target, 150, 150)

    expect(inner.style.getPropertyValue('--x')).toBe('100.00px')
    expect(inner.style.getPropertyValue('--y')).toBe('100.00px')
    expect(inner.style.getPropertyValue('--xp')).toBe('0.50')
    expect(inner.style.getPropertyValue('--yp')).toBe('0.50')
    expect(outer.style.getPropertyValue('--x')).toBe('150.00px')
    expect(outer.style.getPropertyValue('--y')).toBe('150.00px')
    expect(outer.style.getPropertyValue('--xp')).toBe('0.38')
    expect(outer.style.getPropertyValue('--yp')).toBe('0.38')
  })

  it('clears glow vars on hosts that are no longer under the pointer', () => {
    document.body.innerHTML = `
      <div data-glow="card" id="a">
        <button type="button" id="target-a">A</button>
      </div>
      <div data-glow="card" id="b">
        <button type="button" id="target-b">B</button>
      </div>
    `

    const cardA = document.getElementById('a') as HTMLElement
    const cardB = document.getElementById('b') as HTMLElement
    const targetA = document.getElementById('target-a')
    const targetB = document.getElementById('target-b')

    stubRect(cardA, 0, 0, 100, 100)
    stubRect(cardB, 0, 120, 100, 100)

    const active = writeGlowSpotVars(targetA, 40, 40)
    expect(cardA.style.getPropertyValue('--x')).toBe('40.00px')
    expect(active).toEqual([cardA])

    writeGlowSpotVars(targetB, 40, 160, active)
    expect(cardA.style.getPropertyValue('--x')).toBe('-999px')
    expect(cardA.style.getPropertyValue('--y')).toBe('-999px')
    expect(cardB.style.getPropertyValue('--x')).toBe('40.00px')
    expect(cardB.style.getPropertyValue('--y')).toBe('40.00px')
  })

  it('clearGlowVars parks the spotlight off-card', () => {
    document.body.innerHTML = `<div data-glow="panel" id="card"></div>`
    const card = document.getElementById('card') as HTMLElement
    card.style.setProperty('--x', '12px')
    card.style.setProperty('--y', '24px')
    card.style.setProperty('--xp', '0.5')
    card.style.setProperty('--yp', '0.5')

    clearGlowVars(card)

    expect(card.style.getPropertyValue('--x')).toBe('-999px')
    expect(card.style.getPropertyValue('--y')).toBe('-999px')
    expect(card.style.getPropertyValue('--xp')).toBe('')
    expect(card.style.getPropertyValue('--yp')).toBe('')
  })
})
