#!/usr/bin/env node
/**
 * Summarize production chunk sizes and gate the main index budget (WO106).
 *
 * Usage:
 *   pnpm bundle:report          # build + report
 *   pnpm bundle:report --skip-build
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const distAssets = join(root, 'dist/assets')
const skipBuild = process.argv.includes('--skip-build')

/** Practical next budget from WO106 — minified bytes, not gzip. */
const INDEX_BUDGET_BYTES = 1_024 * 1024

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

function collectJsChunks() {
  const files = readdirSync(distAssets)
    .filter((name) => name.endsWith('.js'))
    .map((name) => {
      const bytes = statSync(join(distAssets, name)).size
      return { name, bytes }
    })
    .sort((a, b) => b.bytes - a.bytes)

  return files
}

function runBuild() {
  const result = spawnSync('pnpm', ['exec', 'vite', 'build'], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function main() {
  if (!skipBuild) {
    runBuild()
  }

  const chunks = collectJsChunks()
  const indexChunk = chunks.find((chunk) => /^index-.*\.js$/.test(chunk.name))
  const startupRelated = chunks.filter((chunk) =>
    /^(index-|vendor-react-|vendor-router-|vendor-query-|vendor-three-|vendor-motion-).*\.js$/.test(
      chunk.name,
    ),
  )

  console.log('\nBundle report (WO106)')
  console.log('─'.repeat(72))
  for (const chunk of chunks.slice(0, 20)) {
    const tags = []
    if (/^index-/.test(chunk.name)) tags.push('startup entry')
    if (/^vendor-/.test(chunk.name)) tags.push('vendor split')
    const suffix = tags.length > 0 ? `  ← ${tags.join(', ')}` : ''
    console.log(`${formatKb(chunk.bytes).padStart(12)}  ${chunk.name}${suffix}`)
  }

  const startupBytes = startupRelated.reduce((sum, chunk) => sum + chunk.bytes, 0)

  console.log('\nStartup-related chunks (index + core vendors):')
  for (const chunk of startupRelated) {
    console.log(`  ${formatKb(chunk.bytes).padStart(10)}  ${chunk.name}`)
  }
  console.log(`  ${formatKb(startupBytes).padStart(10)}  total`)

  if (indexChunk) {
    const withinBudget = indexChunk.bytes <= INDEX_BUDGET_BYTES
    console.log(
      `\nMain index budget: ${formatKb(indexChunk.bytes)} / ${formatKb(INDEX_BUDGET_BYTES)} minified — ${
        withinBudget ? 'within budget' : 'over budget (track reduction in follow-up PRs)'
      }`,
    )
  }

  console.log(
    '\nInspect deferred chunks: vendor-charts, vendor-drei, workspace route chunks, and feature islands.',
  )
}

main()
