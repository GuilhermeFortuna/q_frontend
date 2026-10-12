import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8')
const lazyWorkspacesSource = readFileSync(
  resolve(process.cwd(), 'src/app/lazyWorkspaces.tsx'),
  'utf8',
)
const workspaceLoadersSource = readFileSync(
  resolve(process.cwd(), 'src/app/workspaceLoaders.ts'),
  'utf8',
)
const dockSource = readFileSync(resolve(process.cwd(), 'src/components/dock/AppDock.tsx'), 'utf8')

describe('research route', () => {
  it('registers /research as a lazy-loaded workspace route', () => {
    expect(routerSource).toContain("path: '/research'")
    expect(routerSource).toContain("syncWorkspace('research')")
    expect(routerSource).toContain('LazyResearchWorkspace')
    expect(routerSource).not.toMatch(/active === 'research'/)
    expect(lazyWorkspacesSource).toContain('lazy(loadResearchWorkspace)')
    expect(workspaceLoadersSource).toContain("import('@/workspaces/research/ResearchWorkspace')")
  })

  it('validates the tab search param for deep links', () => {
    expect(routerSource).toContain('parseResearchTab')
    expect(routerSource).toContain('source_run_id')
    expect(routerSource).toMatch(
      /value === 'figures' \|\|\s*value === 'scoring' \|\|\s*value === 'lab' \|\|\s*value === 'store' \|\|\s*value === 'neural' \|\|\s*value === 'ml-filters' \|\|\s*value === 'experiments'/,
    )
  })

  it('opens on Figures by default and passes the figure id to the workspace', () => {
    expect(routerSource).toMatch(/return 'figures'\s*\}/)
    expect(routerSource).toContain("tab={search.tab ?? 'figures'}")
    expect(routerSource).toContain('figureId={search.figure}')
    expect(routerSource).toContain('search.figure.length > 0')
  })

  it('exposes Research in the dock navigation', () => {
    expect(dockSource).toContain("id: 'research'")
    expect(dockSource).toContain("to: '/research'")
  })
})
