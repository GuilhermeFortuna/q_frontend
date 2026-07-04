import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { WorkspaceId } from '@/types/api'

const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8')
const dockSource = readFileSync(resolve(process.cwd(), 'src/components/dock/AppDock.tsx'), 'utf8')
const workspaceTypesSource = readFileSync(resolve(process.cwd(), 'src/types/api.ts'), 'utf8')

describe('retire standalone strategy page', () => {
  it('redirects /strategy to /strategy-builder without mounting StrategyWorkspace', () => {
    expect(routerSource).toContain("path: '/strategy'")
    expect(routerSource).toMatch(
      /strategyRoute[\s\S]*throw redirect\(\{ to: '\/strategy-builder' \}\)/,
    )
    expect(routerSource).not.toContain('StrategyWorkspace')
  })

  it('migrates persisted activeWorkspace strategy to strategy-builder on initial load', () => {
    expect(routerSource).toMatch(/active as string\) === 'strategy'/)
    expect(routerSource).toMatch(
      /active as string\) === 'strategy'[\s\S]*setActiveWorkspace\('strategy-builder'\)[\s\S]*throw redirect\(\{ to: '\/strategy-builder' \}\)/,
    )
  })

  it('removes strategy from WorkspaceId', () => {
    expect(workspaceTypesSource).not.toMatch(/\|\s*'strategy'/)
  })

  it('does not render a Strategy dock item', () => {
    expect(dockSource).not.toContain("label: 'Strategy'")
    expect(dockSource).not.toContain("to: '/strategy'")
    expect(dockSource).toContain("id: 'backtests'")

    const workspaceIds = [...dockSource.matchAll(/id: '([^']+)'/g)].map((match) => match[1])
    expect(workspaceIds).not.toContain('strategy')
    expect(workspaceIds as WorkspaceId[]).toContain('backtests')
  })

  it('retains shared exit modules for StrategyStudio', () => {
    const exitModules = [
      'src/components/backtests/setup/ExitStrategyCards.tsx',
      'src/workspaces/strategy/exitRuleSemantics.ts',
      'src/workspaces/strategy/exitWorkbenchGroups.ts',
    ]

    for (const modulePath of exitModules) {
      expect(() => readFileSync(resolve(process.cwd(), modulePath), 'utf8')).not.toThrow()
    }
  })
})
