import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { availableParallelism } from 'node:os'
import { defineConfig } from 'vitest/config'

const maxWorkers =
  Number(process.env.VITEST_MAX_WORKERS) ||
  Math.max(1, Math.min(10, Math.floor(availableParallelism() / 2)))

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths({
      projects: ['./tsconfig.app.json'],
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    testTimeout: 15000,
    // Vitest's default pool is `forks`, sized to every logical CPU. Each fork boots its own
    // jsdom (~400 MB), so uncapped that is ~30 processes and >15 GB, which starves the host
    // and makes waitFor-based tests time out. Cap at half the CPUs (max 10, the measured
    // sweet spot); override with VITEST_MAX_WORKERS.
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: maxWorkers,
        minForks: 1,
      },
    },
  },
})
