import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const monorepoRoot = path.resolve(frontendRoot, '..')
const composeFile = path.join(monorepoRoot, 'docker-compose.yml')
const backendRoot = path.join(monorepoRoot, 'q_backend')

const containerized = process.argv.includes('--containerized')
const rebuild = process.argv.includes('--build')

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve(undefined)
        return
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 1}`))
    })
  })
}

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      ...options,
    })
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 1))
  })
}

async function waitForPostgres(retries = 30) {
  for (let i = 0; i < retries; i += 1) {
    const code = await runCapture('docker', [
      'compose',
      '-f',
      composeFile,
      'exec',
      '-T',
      'postgres',
      'pg_isready',
      '-U',
      'q',
      '-d',
      'q',
    ])
    if (code === 0) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('Postgres did not become ready in time.')
}

async function main() {
  if (!fs.existsSync(composeFile)) {
    throw new Error(`Expected docker compose file at ${composeFile}`)
  }

  if (containerized) {
    console.log('Starting full containerized stack (no live MetaTrader5)...')
    const composeArgs = ['compose', '-f', composeFile, '--profile', 'containerized', 'up', '-d']
    if (rebuild) {
      composeArgs.push('--build')
    }
    await run('docker', composeArgs, { cwd: monorepoRoot })
  } else {
    console.log('Stopping containerized backend/worker (if any)...')
    await runCapture('docker', [
      'compose',
      '-f',
      composeFile,
      '--profile',
      'containerized',
      'stop',
      'backend',
      'worker',
    ])

    console.log('Starting Postgres and Redis in Docker...')
    await run('docker', ['compose', '-f', composeFile, 'up', '-d', 'postgres', 'redis'], {
      cwd: monorepoRoot,
    })
    await waitForPostgres()

    console.log('Running database migrations...')
    await run('uv', ['run', 'alembic', 'upgrade', 'head'], { cwd: backendRoot })

    console.log('Starting native backend and worker (MetaTrader5 requires Windows)...')
    console.log('Open two terminals and run:')
    console.log(`  cd ${backendRoot}`)
    console.log('  uv run dev')
    console.log('  uv run worker')
    console.log('')
    console.log('Or use .\\dev.ps1 from the monorepo root to start them automatically.')
  }

  console.log('')
  console.log('API: http://localhost:8000')
  console.log('Launching Tauri desktop app...')
  console.log('')

  await run('node', ['tauri-dev.js'], { cwd: frontendRoot })
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
