#!/usr/bin/env node
/**
 * Browser runtime performance smoke (WO101).
 * Implementation lives in perf-smoke-run.ts; launched via tsx for TS imports.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const runner = path.join(dir, 'perf-smoke-run.ts')
const result = spawnSync(
  'pnpm',
  ['exec', 'tsx', '--tsconfig', 'tsconfig.app.json', runner, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    cwd: path.resolve(dir, '..'),
  },
)
process.exit(result.status ?? 1)
