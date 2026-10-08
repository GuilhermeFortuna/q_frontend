import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const loadersSource = readFileSync(resolve(process.cwd(), 'src/app/workspaceLoaders.ts'), 'utf8')
const lazyWorkspacesSource = readFileSync(
  resolve(process.cwd(), 'src/app/lazyWorkspaces.tsx'),
  'utf8',
)

const DOCK_LOADERS = [
  'loadLauncherWorkspace',
  'loadMarketDataWorkspace',
  'loadStorageWorkspace',
  'loadBacktestsWorkspace',
  'loadStrategyBuilderWorkspace',
  'loadDiscoverWorkspace',
  'loadResearchWorkspace',
  'loadSystemWorkspace',
]

describe('workspace chunk preloading', () => {
  it('builds each lazy dock workspace from the loader that preloading uses', () => {
    for (const loader of DOCK_LOADERS) {
      expect(loadersSource).toContain(`export const ${loader} = () =>`)
      expect(lazyWorkspacesSource).toContain(`lazy(${loader})`)
    }
  })

  it('exposes targeted preloading for dock interactions', () => {
    expect(loadersSource).toContain('export async function preloadWorkspace(')
  })
})
