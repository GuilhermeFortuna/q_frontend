import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Vitest stubs `?raw` CSS imports as empty strings; read source text directly (same guard).
const stylesDir = dirname(fileURLToPath(import.meta.url))
const materialsCss = readFileSync(resolve(stylesDir, '../materials.css'), 'utf8')
const globalsCss = readFileSync(resolve(stylesDir, '../globals.css'), 'utf8')

const EXPECTED_SURFACE_CLASSES = [
  'surface-well',
  'surface-panel',
  'surface-card',
  'surface-control',
  'surface-suede',
  'surface-overlay',
  'surface-float',
] as const

const EXPECTED_ACCENT_CLASSES = ['accent-wayfinding', 'accent-interactive', 'accent-state'] as const

function assertExportsClass(css: string, className: string) {
  expect(css).toMatch(new RegExp(`\\.${className}\\b`))
}

function extractLivingBlock(css: string): string {
  const start = css.indexOf('.surface-panel--living')
  if (start === -1) return ''
  const end = css.indexOf('/* Launcher-only pointer spotlight', start)
  return end === -1 ? css.slice(start) : css.slice(start, end)
}

function extractPanelBlock(css: string): string {
  const start = css.indexOf('.surface-panel,\n  .quant-panel')
  if (start === -1) return ''
  const end = css.indexOf('.surface-panel:hover', start)
  return end === -1 ? css.slice(start) : css.slice(start, end)
}

describe('design-system material classes (WO116 regression guard)', () => {
  it('exports the elevation ladder surface roles from materials.css', () => {
    for (const className of EXPECTED_SURFACE_CLASSES) {
      assertExportsClass(materialsCss, className)
    }
    assertExportsClass(materialsCss, 'surface-panel--living')
  })

  it('uses frosted glass on surface-panel (WO121)', () => {
    const panelBlock = extractPanelBlock(materialsCss)
    expect(panelBlock).toMatch(/backdrop-filter:\s*blur\(var\(--panel-blur\)\)/)
    // translucent fill (any opacity) — kept deep (~72-78%) in Rev 1, but don't pin the exact %
    expect(panelBlock).toMatch(/color-mix\(in srgb, var\(--surface-base-1\) \d+%, transparent\)/)
  })

  it('keeps living panels free of weave textures and grain (WO125 + WO121 Rev 1)', () => {
    const livingBlock = extractLivingBlock(materialsCss)
    expect(livingBlock.length).toBeGreaterThan(0)
    expect(livingBlock).not.toMatch(/repeating-linear-gradient/)
    expect(livingBlock).not.toMatch(/-webkit-mask/)
    expect(livingBlock).not.toMatch(/\bmask:/)
    // grain removed — no fractal-noise blend on the glass
    expect(livingBlock).not.toMatch(/background-blend-mode/)
    expect(livingBlock).not.toMatch(/fractalNoise/)
  })

  it('exports accent tier utilities from globals.css', () => {
    for (const className of EXPECTED_ACCENT_CLASSES) {
      assertExportsClass(globalsCss, className)
    }
  })

  it('defines ::selection styling exactly once in globals.css', () => {
    const matches = globalsCss.match(/::selection/g) ?? []
    expect(matches).toHaveLength(1)
    expect(globalsCss).toMatch(/::selection\s*\{[\s\S]*?background-color:[\s\S]*?brass/)
  })

  it('exports brass glow-card ([data-glow]) rules with reduced-motion kill switch', () => {
    expect(materialsCss).toMatch(/\[data-glow\]\s*\{/)
    expect(materialsCss).toMatch(/--base:\s*40/)
    expect(materialsCss).toMatch(/mask-composite:\s*exclude/)
    expect(materialsCss).toMatch(
      /:root\[data-reduced-motion='true'\]\s*\[data-glow\]\s*\{[\s\S]*?--bg-spot-opacity:\s*0/,
    )
  })
})
