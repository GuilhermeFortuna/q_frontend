import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolveManualChunk } from '@/lib/build/manualChunks'

const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8')
const backtestResultsSource = readFileSync(
  resolve(process.cwd(), 'src/components/backtests/BacktestResultsTabs.tsx'),
  'utf8',
)
const appShellSource = readFileSync(
  resolve(process.cwd(), 'src/components/layout/AppShell.tsx'),
  'utf8',
)

describe('bundle splitting guards', () => {
  it('wires manualChunks through vite config', () => {
    expect(viteConfig).toContain('resolveManualChunk')
    expect(viteConfig).toContain('manualChunks')
  })

  it('routes heavy vendors into deferred chunk groups', () => {
    expect(resolveManualChunk('/node_modules/recharts/es6/index.js')).toBe('vendor-charts')
    expect(resolveManualChunk('/node_modules/@visx/shape/esm/index.js')).toBe('vendor-charts')
    expect(resolveManualChunk('/node_modules/@react-three/drei/core/OrbitControls.js')).toBe(
      'vendor-drei',
    )
    expect(resolveManualChunk('/node_modules/three/build/three.module.js')).toBe('vendor-three')
    expect(resolveManualChunk('/node_modules/motion/dist/es/index.mjs')).toBe('vendor-motion')
    expect(resolveManualChunk('/node_modules/react/index.js')).toBe('vendor-react')
  })

  it('keeps backtest recharts and PDF export off the eager results tab path', () => {
    expect(backtestResultsSource).toContain('LazyBacktestPerformanceCharts')
    expect(backtestResultsSource).toContain('LazyBacktestMonthlyChart')
    expect(backtestResultsSource).toContain("import('@/lib/reports/backtestReport')")
    expect(backtestResultsSource).not.toMatch(/from '@\/components\/backtests\/EquityCurveChart'/)
    expect(backtestResultsSource).not.toMatch(/from '@\/lib\/reports\/backtestReport'/)
  })

  it('lazy-loads performance instrumentation in the shell', () => {
    expect(appShellSource).toContain('LazyPerformanceInstrumentation')
    expect(appShellSource).not.toMatch(
      /from '@\/components\/performance\/PerformanceInstrumentation'/,
    )
  })
})
