import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC_ROOT = resolve(process.cwd(), 'src')

const FORBIDDEN_DECL =
  /^\s*(?:export\s+)?(?:interface|type)\s+(?<name>\w*Frame|StreamEnvelope|JobProgressPayload|JobTerminalPayload|HistoryPage|JobSnapshotResponse)\b/gm

const ALLOWED_LOCAL_NAMES = new Set(['InboundFrame'])

function walkSource(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...walkSource(full))
      continue
    }
    if (full.endsWith('.ts') || full.endsWith('.tsx')) files.push(full)
  }
  return files
}

function localStreamTypeDeclarations() {
  const hits: { file: string; name: string }[] = []
  for (const file of walkSource(SRC_ROOT)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(FORBIDDEN_DECL)) {
      const name = match.groups?.name
      if (!name || ALLOWED_LOCAL_NAMES.has(name)) continue
      hits.push({ file: relative(process.cwd(), file), name })
    }
  }
  return hits
}

describe('stream contract types', () => {
  it('does not redeclare vendored stream frame types under src/', () => {
    expect(localStreamTypeDeclarations()).toEqual([])
  })
})
