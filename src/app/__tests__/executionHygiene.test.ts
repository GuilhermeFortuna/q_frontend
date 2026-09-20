import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC_ROOT = resolve(process.cwd(), 'src')

const FORBIDDEN_IMPORT_PATTERNS = [
  /from ['"]@\/api\/queries\/execution['"]/,
  /from ['"]@\/types\/execution['"]/,
  /from ['"]@\/workspaces\/execution(?:\/[^'"]+)?['"]/,
  /from ['"]@\/components\/execution(?:\/[^'"]+)?['"]/,
  /from ['"]@\/mocks\/execution['"]/,
]

function walkSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...walkSourceFiles(fullPath))
      continue
    }
    if (/\.(ts|tsx)$/.test(entry) && !fullPath.includes('/__tests__/')) {
      files.push(fullPath)
    }
  }

  return files
}

describe('execution surface hygiene', () => {
  it('has no imports from removed execution modules', () => {
    const offenders: string[] = []

    for (const filePath of walkSourceFiles(SRC_ROOT)) {
      const source = readFileSync(filePath, 'utf8')
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(source)) {
          offenders.push(`${filePath.replace(`${SRC_ROOT}/`, '')} -> ${pattern}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
