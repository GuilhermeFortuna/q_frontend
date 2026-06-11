import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const host = process.env.TAURI_DEV_HOST

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  const port = parseInt(env.PORT || env.VITE_PORT || '1420', 10)

  return {
    plugins: [
      react(),
      tailwindcss(),
      tsconfigPaths({
        projects: ['./tsconfig.app.json'],
      }),
    ],
    resolve: {
      alias: [{ find: /^lodash\/(.*)$/, replacement: 'lodash-es/$1.js' }],
    },
    clearScreen: false,
    server: {
      port: port,
      strictPort: true,
      host: host ?? false,
      hmr: host
        ? {
            protocol: 'ws',
            host,
            port: port + 1,
          }
        : undefined,
      watch: {
        ignored: ['**/src-tauri/**'],
      },
    },
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
      target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
      minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
  }
})
