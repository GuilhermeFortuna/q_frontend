#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const rootDir = process.argv[2] ? resolve(process.argv[2]) : process.cwd()

const SIBLING_REPOS = '(?:q_backend|q_contracts|q_core|q_frontend|q_terminal)'
const CROSS_REPO_PATTERN = new RegExp(`(?:\\.\\.\\/)+${SIBLING_REPOS}\\b`)
const MD_LINK_PATTERN = new RegExp(
  `(?:\\[[^\\]]*\\]\\((?:\\.\\.\\/)+${SIBLING_REPOS}\\b|<(?:\\.\\.\\/)+${SIBLING_REPOS}\\b|(?:href|src)=["'](?:\\.\\.\\/)+${SIBLING_REPOS}\\b)`,
)

let output = ''
try {
  output = execSync('git ls-files', { cwd: rootDir, encoding: 'utf8' })
} catch (err) {
  console.error(`Failed to list tracked files in ${rootDir}:`, err.message)
  process.exit(1)
}

const files = output.trim().split('\n').filter(Boolean)
const violations = []

for (const file of files) {
  let content = ''
  try {
    content = readFileSync(resolve(rootDir, file), 'utf8')
  } catch {
    continue
  }

  const isMarkdown = extname(file).toLowerCase() === '.md'
  const lines = content.split('\n')
  let inFencedBlock = false

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]

    if (isMarkdown) {
      if (line.trim().startsWith('```')) {
        inFencedBlock = !inFencedBlock
        continue
      }
      if (inFencedBlock) {
        continue
      }

      const stripped = line.replace(/`[^`]*`/g, '')
      if (
        MD_LINK_PATTERN.test(stripped) ||
        (CROSS_REPO_PATTERN.test(stripped) && !line.includes('`'))
      ) {
        violations.push(`${file}:${i + 1}`)
      }
    } else {
      if (CROSS_REPO_PATTERN.test(line)) {
        violations.push(`${file}:${i + 1}`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Forbidden relative paths into sibling repositories found:')
  for (const v of violations) {
    console.error(v)
  }
  process.exit(1)
}

process.exit(0)
