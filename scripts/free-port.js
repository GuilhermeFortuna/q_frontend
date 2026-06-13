import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export function readDevPort(cwd = process.cwd()) {
  let port = 1420
  try {
    const envPath = path.resolve(cwd, '.env')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      const portMatch = envContent.match(/^(PORT|VITE_PORT)\s*=\s*(\d+)/m)
      if (portMatch) {
        port = Number.parseInt(portMatch[2], 10)
      }
    }
  } catch (error) {
    console.error('Error reading .env file:', error)
  }
  return port
}

export function freePort(port) {
  const parsed = Number.parseInt(String(port), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return []
  }

  if (process.platform === 'win32') {
    return freePortWindows(parsed)
  }

  try {
    execSync(`lsof -ti tcp:${parsed} | xargs kill -9 2>/dev/null`, {
      shell: true,
      stdio: 'ignore',
    })
  } catch {
    // Nothing was listening.
  }
  return []
}

function freePortWindows(port) {
  const stopped = []
  try {
    const output = execSync('netstat -ano', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const pids = new Set()
    const pattern = new RegExp(`:${port}\\s`)

    for (const line of output.split('\n')) {
      if (!line.includes('LISTENING') || !pattern.test(line)) {
        continue
      }
      const pid = line.trim().split(/\s+/).at(-1)
      if (pid && /^\d+$/.test(pid) && pid !== '0') {
        pids.add(pid)
      }
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
        stopped.push(Number.parseInt(pid, 10))
        console.log(`Stopped process ${pid} that was listening on port ${port}`)
      } catch {
        // Process may have already exited.
      }
    }
  } catch {
    // netstat failed; nothing to do.
  }
  return stopped
}
