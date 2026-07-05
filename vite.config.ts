import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { sentryVitePlugin } from '@sentry/vite-plugin'

import { execSync } from 'child_process'

import { resolveManualChunk } from './src/lib/build/manualChunks'

const host = process.env.TAURI_DEV_HOST

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  const port = parseInt(env.PORT || env.VITE_PORT || '1420', 10)
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN
  const sentryRelease = env.SENTRY_RELEASE || env.VITE_SENTRY_RELEASE || env.GITHUB_SHA

  let gitSha = 'unknown'
  try {
    gitSha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    // no git available — release falls back to "unknown"
  }

  return {
    define: {
      __GIT_SHA__: JSON.stringify(gitSha),
    },
    plugins: [
      react(),
      tailwindcss(),
      tsconfigPaths({
        projects: ['./tsconfig.app.json'],
      }),
      ...(sentryAuthToken
        ? [
            sentryVitePlugin({
              authToken: sentryAuthToken,
              org: env.SENTRY_ORG,
              project: env.SENTRY_PROJECT,
              release: sentryRelease ? { name: sentryRelease } : undefined,
              sourcemaps: {
                assets: './dist/**',
                filesToDeleteAfterUpload: './dist/**/*.map',
              },
              telemetry: false,
              silent: true,
            }),
          ]
        : []),
    ],
    resolve: {
      alias: [{ find: /^lodash\/(.*)$/, replacement: 'lodash-es/$1.js' }],
    },
    clearScreen: false,
    server: {
      port: port,
      strictPort: true,
      // Bind dual-stack ('::' accepts both ::1 and 127.0.0.1 when bindv6only=0) so
      // lazy-loaded chunks resolve whether the client uses the IPv6 or IPv4 loopback.
      // TAURI_DEV_HOST still wins when set (LAN dev on a physical device).
      host: host ?? '::',
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
      sourcemap: sentryAuthToken ? 'hidden' : !!process.env.TAURI_ENV_DEBUG,
      rollupOptions: {
        output: {
          manualChunks(id) {
            return resolveManualChunk(id)
          },
        },
      },
    },
    worker: {
      plugins: () => [
        tsconfigPaths({
          projects: ['./tsconfig.app.json'],
        }),
      ],
    },
  }
})
