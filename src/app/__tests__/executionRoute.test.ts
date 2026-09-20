import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { WORKSPACE_PATH_ORDER } from '@/app/router'

const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8')
const appSource = readFileSync(resolve(process.cwd(), 'src/app/App.tsx'), 'utf8')
const dockSource = readFileSync(resolve(process.cwd(), 'src/components/dock/AppDock.tsx'), 'utf8')
const workspaceTypesSource = readFileSync(resolve(process.cwd(), 'src/types/api.ts'), 'utf8')

describe('execution route retirement', () => {
  it('registers /execution as the moved-to-terminal notice', () => {
    expect(routerSource).toContain("path: '/execution'")
    expect(routerSource).toContain('<MovedToTerminalNotice context="workspace" />')
    expect(routerSource).not.toContain('LazyExecutionWorkspace')
    expect(routerSource).not.toContain("syncWorkspace('execution')")
  })

  it('redirects persisted activeWorkspace execution to the notice route', () => {
    expect(routerSource).toMatch(/active as string\) === 'execution'/)
    expect(routerSource).toMatch(
      /active as string\) === 'execution'[\s\S]*throw redirect\(\{ to: '\/execution' \}\)/,
    )
  })

  it('omits /execution from workspace path order', () => {
    expect(WORKSPACE_PATH_ORDER).not.toContain('/execution')
  })

  it('removes execution from WorkspaceId and the dock', () => {
    expect(workspaceTypesSource).not.toMatch(/\|\s*'execution'/)
    expect(dockSource).not.toContain("id: 'execution'")
    expect(dockSource).not.toContain("to: '/execution'")
  })

  it('shows the monitor notice for deployment_id windows', () => {
    expect(appSource).toContain('deployment_id')
    expect(appSource).toContain('<MovedToTerminalNotice context="monitor" />')
    expect(appSource).not.toContain('LazyExecutionLiveWorkspace')
  })
})
