import { execSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT_PATH = resolve(process.cwd(), 'scripts/check-cross-repo-paths.mjs')
const SIBLING_PATH = ['..', '..', 'q_backend'].join('/')

describe('check-cross-repo-paths script', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'q-cross-repo-test-'))
    execSync('git init', { cwd: tempDir, stdio: 'ignore' })
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' })
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' })
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('exits 1 and prints docs/a.md:1 when a tracked file has a relative sibling link', () => {
    mkdirSync(join(tempDir, 'docs'), { recursive: true })
    writeFileSync(join(tempDir, 'docs/a.md'), `[x](${SIBLING_PATH}/README.md)\n`)
    execSync('git add docs/a.md', { cwd: tempDir, stdio: 'ignore' })

    const result = spawnSync('node', [SCRIPT_PATH, tempDir], {
      cwd: tempDir,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    const output = `${result.stdout}\n${result.stderr}`
    expect(output).toContain('docs/a.md:1')
  })

  it('exits 0 when links are within the repository', () => {
    mkdirSync(join(tempDir, 'docs'), { recursive: true })
    writeFileSync(join(tempDir, 'docs/a.md'), '[x](../local.md)\n')
    execSync('git add docs/a.md', { cwd: tempDir, stdio: 'ignore' })

    const result = spawnSync('node', [SCRIPT_PATH, tempDir], {
      cwd: tempDir,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
  })

  it('exits 0 when a markdown file contains inline code description of a path', () => {
    mkdirSync(join(tempDir, 'docs'), { recursive: true })
    writeFileSync(
      join(tempDir, 'docs/a.md'),
      `Mentions \`${SIBLING_PATH}\` in inline code description\n`,
    )
    execSync('git add docs/a.md', { cwd: tempDir, stdio: 'ignore' })

    const result = spawnSync('node', [SCRIPT_PATH, tempDir], {
      cwd: tempDir,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
  })

  it('exits 1 when a non-markdown file contains relative path to sibling', () => {
    writeFileSync(join(tempDir, 'config.json'), `{"path": "${SIBLING_PATH}"}\n`)
    execSync('git add config.json', { cwd: tempDir, stdio: 'ignore' })

    const result = spawnSync('node', [SCRIPT_PATH, tempDir], {
      cwd: tempDir,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    const output = `${result.stdout}\n${result.stderr}`
    expect(output).toContain('config.json:1')
  })
})
