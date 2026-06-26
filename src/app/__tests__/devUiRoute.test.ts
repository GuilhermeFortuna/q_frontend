import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8')
const lazyDevSource = readFileSync(resolve(process.cwd(), 'src/app/lazyDev.tsx'), 'utf8')

describe('dev UI gallery route', () => {
  it('registers /dev/ui only behind import.meta.env.DEV', () => {
    expect(routerSource).toContain("path: '/dev/ui'")
    expect(routerSource).toContain('import.meta.env.DEV')
    expect(routerSource).toContain('LazyDevUiGallery')
    expect(routerSource).not.toMatch(/from '@\/app\/dev\/DevUiGallery'/)
  })

  it('lazy-loads the gallery chunk through lazyDev', () => {
    expect(lazyDevSource).toContain("import('@/app/dev/DevUiGallery')")
    expect(lazyDevSource).toContain('import.meta.env.DEV')
  })
})
