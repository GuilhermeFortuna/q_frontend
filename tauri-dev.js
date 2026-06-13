import { spawn } from 'child_process'
import path from 'path'
import { freePort, readDevPort } from './scripts/free-port.js'

const port = String(readDevPort())
const hmrPort = String(Number.parseInt(port, 10) + 1)

console.log(`Starting Tauri dev on port ${port}...`)

for (const devPort of [port, hmrPort]) {
  freePort(devPort)
}

const configObj = {
  build: {
    devUrl: `http://localhost:${port}`,
  },
}

const tauriCli = path.resolve(process.cwd(), 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
const args = ['dev', '--config', JSON.stringify(configObj)]

const child = spawn(process.execPath, [tauriCli, ...args], {
  stdio: 'inherit',
})

child.on('close', (code) => {
  process.exit(code ?? 0)
})
