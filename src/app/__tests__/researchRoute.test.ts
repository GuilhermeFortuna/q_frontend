import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8')
const lazyWorkspacesSource = readFileSync(
  resolve(process.cwd(), 'src/app/lazyWorkspaces.tsx'),
  'utf8',
)
const dockSource = readFileSync(resolve(process.cwd(), 'src/components/dock/AppDock.tsx'), 'utf8')

describe('research route', () => {
  it('registers /research as a lazy-loaded workspace route', () => {
    expect(routerSource).toContain("path: '/research'")
    expect(routerSource).toContain("syncWorkspace('research')")
    expect(routerSource).toContain('LazyResearchWorkspace')
    expect(routerSource).not.toMatch(/active === 'research'/)
    expect(lazyWorkspacesSource).toContain("import('@/workspaces/research/ResearchWorkspace')")
  })

  it('validates the tab search param for deep links', () => {
    expect(routerSource).toContain('parseResearchTab')
    expect(routerSource).toMatch(
      /value === 'scoring' \|\| value === 'lab' \|\| value === 'store' \|\| value === 'neural'/,
    )
  })

  it('exposes Research in the dock navigation', () => {
    expect(dockSource).toContain("id: 'research'")
    expect(dockSource).toContain("to: '/research'")
  })
})
