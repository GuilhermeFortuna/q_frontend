import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

// Read .env file
let port = '1420'
try {
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const portMatch = envContent.match(/^(PORT|VITE_PORT)\s*=\s*(\d+)/m)
    if (portMatch) {
      port = portMatch[2]
    }
  }
} catch (e) {
  console.error('Error reading .env file:', e)
}

console.log(`Starting Tauri dev on port ${port}...`)

const configObj = {
  build: {
    devUrl: `http://localhost:${port}`,
  },
}

// Escape quotes for Windows cmd.exe shell execution
let configStr = JSON.stringify(configObj)
if (process.platform === 'win32') {
  configStr = configStr.replace(/"/g, '\\"')
}

// Find local tauri CLI binary
const tauriBin =
  process.platform === 'win32'
    ? path.resolve(process.cwd(), 'node_modules', '.bin', 'tauri.cmd')
    : path.resolve(process.cwd(), 'node_modules', '.bin', 'tauri')

const args = ['dev', '--config', configStr]

// Windows batch (.cmd) files require shell: true in modern Node.js
const isWin = process.platform === 'win32'
const child = spawn(tauriBin, args, {
  stdio: 'inherit',
  shell: isWin,
})

child.on('close', (code) => {
  process.exit(code ?? 0)
})
