import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8')
const lazyWorkspacesSource = readFileSync(
  resolve(process.cwd(), 'src/app/lazyWorkspaces.tsx'),
  'utf8',
)

describe('lazy route workspaces', () => {
  it('declares lazy workspace chunks for major routes', () => {
    expect(lazyWorkspacesSource).toContain('LazyLauncherWorkspace')
    expect(lazyWorkspacesSource).toContain('LazyMarketDataWorkspace')
    expect(lazyWorkspacesSource).toContain('LazyStorageWorkspace')
    expect(lazyWorkspacesSource).toContain('LazySystemWorkspace')
    expect(lazyWorkspacesSource).toContain('LazyBacktestsWorkspace')
    expect(lazyWorkspacesSource).toContain('LazyDiscoverWorkspace')
    expect(lazyWorkspacesSource).toContain('LazyWalkForwardWorkspace')
    expect(lazyWorkspacesSource).toContain('LazyNewsReaderWorkspace')
    expect(lazyWorkspacesSource).toContain('LazyResearchWorkspace')
    expect(lazyWorkspacesSource).toContain('LazyExecutionWorkspace')
  })

  it('wraps routed workspaces in suspense boundaries', () => {
    expect(routerSource).toContain('LazyRouteBoundary')
    expect(routerSource).toContain('LazyBacktestsWorkspace')
    expect(routerSource).toContain('LazyDiscoverWorkspace')
    expect(routerSource).toContain('LazyResearchWorkspace')
    expect(routerSource).toContain('LazyExecutionWorkspace')
    expect(routerSource).not.toContain("from '@/workspaces/backtests/BacktestsWorkspace'")
  })

  it('documents bundle inspection workflow', () => {
    const doc = readFileSync(resolve(process.cwd(), 'docs/dev/bundle-splitting.md'), 'utf8')
    expect(doc).toContain('pnpm bundle:report')
    expect(doc).toContain('index-*.js')
  })
})
