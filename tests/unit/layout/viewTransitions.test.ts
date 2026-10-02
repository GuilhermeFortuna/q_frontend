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
const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8')
const appDockSource = readFileSync(
  resolve(process.cwd(), 'src/components/dock/AppDock.tsx'),
  'utf8',
)

describe('view transition policy', () => {
  it('does not name main-content as a view-transition target in globals.css', () => {
    expect(globalsCss).not.toContain('view-transition-name: main-content')
    expect(globalsCss).not.toMatch(/::view-transition-(old|new)\(main-content\)/)
    expect(globalsCss).not.toContain('.vt-content')
    expect(globalsCss).not.toContain('view-transition-name: app-main')
    expect(globalsCss).not.toMatch(/::view-transition-(old|new)\(app-main\)/)
  })

  it('leaves workspace switches to the grid transition alone, with no view transition', () => {
    expect(globalsCss).not.toContain('view-transition-name')
    expect(globalsCss).not.toContain('::view-transition')
    expect(routerSource).not.toContain('defaultViewTransition')
  })
})

describe('shell view-transition classes', () => {
  it('uses the grid transition without shutter, remount fades or view-transition classes', () => {
    expect(appShellSource).not.toContain('vt-header')
    expect(appShellSource).not.toContain('vt-content')
    expect(appShellSource).not.toContain('animate-fade-in-up')
    expect(appShellSource).not.toContain('quant-edge-ripple')
    expect(appShellSource).toContain('WorkspaceGridTransition')
    expect(appShellSource).not.toContain('WorkspaceStripeShutter')
    expect(globalsCss).not.toContain('workspace-stripe-shutter')
    expect(globalsCss).not.toContain('uVariant')
    expect(globalsCss).toContain('workspace-grid-transition')
    expect(appDockSource).not.toContain('vt-dock')
    expect(appDockSource).toContain('runWorkspaceTransition')

    expect(readerShellSource).not.toContain('vt-header')
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

describe('workspace grid transition paint policy', () => {
  const transitionSource = readFileSync(
    resolve(process.cwd(), 'src/components/transitions/WorkspaceGridTransition.tsx'),
    'utf8',
  )

  it('never animates a backdrop blur on the transition clones', () => {
    expect(transitionSource).not.toContain("'backdropFilter'")
    const cloneRule = globalsCss.match(/\.workspace-grid-transition__clone \{[^}]*\}/)?.[0] ?? ''
    expect(cloneRule).toContain('contain: strict')
    expect(cloneRule).not.toContain('backdrop-filter')
  })

  it('hides live surfaces from CSS while clones stand in', () => {
    expect(globalsCss).toMatch(
      /html\[data-workspace-transition='reconfiguring'\] \[data-workspace-transition-surface\]/,
    )
    expect(transitionSource).not.toContain('transitionHidden')
  })
})
