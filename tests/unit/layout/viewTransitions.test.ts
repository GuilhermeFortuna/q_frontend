import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const globalsCss = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8')
const appShellSource = readFileSync(
  resolve(process.cwd(), 'src/components/layout/AppShell.tsx'),
  'utf8',
)
const readerShellSource = readFileSync(
  resolve(process.cwd(), 'src/components/layout/ReaderWindowShell.tsx'),
  'utf8',
)
const appDockSource = readFileSync(
  resolve(process.cwd(), 'src/components/dock/AppDock.tsx'),
  'utf8',
)

describe('view transition chrome-only policy', () => {
  it('does not name main-content as a view-transition target in globals.css', () => {
    expect(globalsCss).not.toContain('view-transition-name: main-content')
    expect(globalsCss).not.toMatch(/::view-transition-(old|new)\(main-content\)/)
    expect(globalsCss).not.toContain('.vt-content')
  })

  it('keeps header and dock view-transition names', () => {
    expect(globalsCss).toContain('view-transition-name: app-header')
    expect(globalsCss).toContain('view-transition-name: app-dock')
    expect(globalsCss).toMatch(/::view-transition-(old|new)\(app-header\)/)
    expect(globalsCss).toMatch(/::view-transition-(old|new)\(app-dock\)/)
  })
})

describe('shell view-transition classes', () => {
  it('keeps vt-header and vt-dock without vt-content on main', () => {
    expect(appShellSource).toContain('vt-header')
    expect(appShellSource).not.toContain('vt-content')
    expect(appDockSource).toContain('vt-dock')

    expect(readerShellSource).toContain('vt-header')
    expect(readerShellSource).not.toContain('vt-content')
  })
})

describe('quant-panel paint policy', () => {
  it('uses a compositor overlay for launcher spotlight instead of backdrop-filter', () => {
    const materialsCss = readFileSync(resolve(process.cwd(), 'src/styles/materials.css'), 'utf8')
    expect(materialsCss).toContain('.quant-panel--spotlight::after')
    expect(globalsCss).not.toMatch(/:where\(\.quant-panel\)[^}]*backdrop-filter/s)
    expect(materialsCss).toContain('will-change: opacity')
  })
})
