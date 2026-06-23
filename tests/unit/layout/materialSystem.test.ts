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

  it('restricts backdrop-filter to shell, overlay scrims, and float overlays', () => {
    const blurBlocks = materialsCss.match(/backdrop-filter/g) ?? []
    expect(blurBlocks.length).toBeGreaterThanOrEqual(3)
    expect(materialsCss).not.toMatch(/\.surface-card\s*\{[^}]*backdrop-filter/s)
    expect(materialsCss).not.toMatch(/\.surface-panel\s*\{[^}]*backdrop-filter/s)
  })

  it('removed global quant-panel backdrop blur', () => {
    expect(globalsCss).not.toMatch(/:where\(\.quant-panel\)[^}]*backdrop-filter/s)
    expect(materialsCss).not.toMatch(/\.quant-panel\s*\{[^}]*backdrop-filter/s)
  })

  it('scopes pointer spotlight to spotlight modifier classes', () => {
    expect(materialsCss).toContain('.quant-panel--spotlight::after')
    expect(materialsCss).toContain('.surface-panel--spotlight::after')
    expect(materialsCss).not.toMatch(/\.quant-panel::after/)
  })
})

describe('repeated card paint policy', () => {
  it('uses surface-card without filter drop-shadow in LibraryCard', () => {
    expect(libraryCardSource).toContain('surface-card')
    expect(libraryCardSource).not.toMatch(/'quant-panel /)
    expect(libraryCardSource).not.toMatch(/drop-shadow|filter:/)
    expect(libraryCardSource).not.toContain('box-shadow')
  })

  it('uses surface-card in StrategyLibrary custom strategy tiles', () => {
    expect(strategyLibrarySource).toContain('surface-card')
    expect(strategyLibrarySource).not.toMatch(/transition-\[transform,border-color,box-shadow\]/)
  })
})
