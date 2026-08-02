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
    expect(globalsCss).not.toContain('view-transition-name: app-main')
    expect(globalsCss).not.toMatch(/::view-transition-(old|new)\(app-main\)/)
  })

  it('keeps header and dock view-transition names', () => {
    expect(globalsCss).toContain('view-transition-name: app-header')
    expect(globalsCss).toContain('view-transition-name: app-dock')
    expect(globalsCss).toMatch(/::view-transition-(old|new)\(app-header\)/)
    expect(globalsCss).toMatch(/::view-transition-(old|new)\(app-dock\)/)
  })
})

describe('shell view-transition classes', () => {
  it('keeps chrome continuity while removing shutter and main remount fades', () => {
    expect(appShellSource).toContain('vt-header')
    expect(appShellSource).not.toContain('vt-content')
    expect(appShellSource).not.toContain('animate-fade-in-up')
    expect(appShellSource).not.toContain('quant-edge-ripple')
    expect(appShellSource).toContain('WorkspaceGridTransition')
    expect(appShellSource).not.toContain('WorkspaceStripeShutter')
    expect(globalsCss).not.toContain('workspace-stripe-shutter')
    expect(globalsCss).not.toContain('uVariant')
    expect(globalsCss).toContain('workspace-grid-transition')
    expect(appDockSource).toContain('vt-dock')
    expect(appDockSource).toContain('runWorkspaceTransition')

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
