import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const materialsCss = readFileSync(resolve(process.cwd(), 'src/styles/materials.css'), 'utf8')
const globalsCss = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8')
const libraryCardSource = readFileSync(
  resolve(process.cwd(), 'src/components/backtests/setup/LibraryCard.tsx'),
  'utf8',
)
const strategyLibrarySource = readFileSync(
  resolve(process.cwd(), 'src/components/backtests/setup/StrategyLibrary.tsx'),
  'utf8',
)

describe('material system roles', () => {
  it('defines the five surface material classes', () => {
    expect(materialsCss).toContain('.surface-shell')
    expect(materialsCss).toContain('.surface-panel')
    expect(materialsCss).toContain('.surface-card')
    expect(materialsCss).toContain('.surface-control')
    expect(materialsCss).toContain('.surface-overlay')
  })

  it('restricts backdrop-filter to shell, panels, cards, overlay scrims, and float overlays', () => {
    const blurBlocks = materialsCss.match(/backdrop-filter/g) ?? []
    expect(blurBlocks.length).toBeGreaterThanOrEqual(5)
    expect(materialsCss).not.toMatch(/\.surface-well\s*\{[^}]*backdrop-filter/s)
    expect(materialsCss).toMatch(/\.surface-panel,\s*\n\s*\.quant-panel[\s\S]*backdrop-filter/)
    expect(materialsCss).toMatch(
      /\.surface-card\s*\{[\s\S]*?backdrop-filter:\s*blur\(var\(--glass-blur\)\)/,
    )
  })

  it('uses tunable frosted glass on panels, not a global quant-panel rule (WO121)', () => {
    expect(globalsCss).toContain('--glass-blur')
    expect(globalsCss).toContain('--panel-blur')
    expect(materialsCss).toMatch(/backdrop-filter:\s*blur\(var\(--panel-blur\)\)/)
    expect(globalsCss).not.toMatch(/:where\(\.quant-panel\)[^}]*backdrop-filter/s)
  })

  it('scopes pointer spotlight to spotlight modifier classes', () => {
    expect(materialsCss).toContain('.quant-panel--spotlight::after')
    expect(materialsCss).toContain('.surface-panel--spotlight::after')
    expect(materialsCss).not.toMatch(/\.quant-panel::after/)
  })
})

describe('repeated card paint policy', () => {
  it('uses surface-card via EntityCard in LibraryCard', () => {
    expect(libraryCardSource).toContain('EntityCard')
    expect(libraryCardSource).not.toMatch(/'quant-panel /)
    expect(libraryCardSource).not.toMatch(/drop-shadow|filter:/)
    expect(libraryCardSource).not.toContain('box-shadow')
  })

  it('uses EntityCard for custom strategy tiles in StrategyLibrary', () => {
    expect(strategyLibrarySource).toContain('EntityCard')
    expect(strategyLibrarySource).not.toMatch(/transition-\[transform,border-color,box-shadow\]/)
  })
})
