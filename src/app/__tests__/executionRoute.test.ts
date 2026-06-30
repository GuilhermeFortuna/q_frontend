import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8')
const lazyWorkspacesSource = readFileSync(
  resolve(process.cwd(), 'src/app/lazyWorkspaces.tsx'),
  'utf8',
)
const dockSource = readFileSync(resolve(process.cwd(), 'src/components/dock/AppDock.tsx'), 'utf8')
const apiTypesSource = readFileSync(resolve(process.cwd(), 'src/types/api.ts'), 'utf8')

describe('execution route', () => {
  it('registers /execution as a lazy-loaded workspace route', () => {
    expect(routerSource).toContain("path: '/execution'")
    expect(routerSource).toContain("syncWorkspace('execution')")
    expect(routerSource).toContain('LazyExecutionWorkspace')
    expect(routerSource).not.toMatch(/active === 'execution'/)
    expect(lazyWorkspacesSource).toContain("import('@/workspaces/execution/ExecutionWorkspace')")
  })

  it('includes execution in workspace ID union', () => {
    expect(apiTypesSource).toMatch(/'execution'/)
  })

  it('exposes Execution in the dock navigation', () => {
    expect(dockSource).toContain("id: 'execution'")
    expect(dockSource).toContain("to: '/execution'")
  })
})
