/**
 * Playwright runner for perf-smoke.mjs (WO101).
 */
import { parseArgs } from 'node:util'
import process from 'node:process'

import {
  classifyConsoleMessage,
  evaluateRouteSample,
  parsePerfConsoleLine,
  ROUTE_SMOKE_PATHS,
  summarizeSmokeRun,
  type RouteSample,
} from '@/lib/performance/perfSmokeLib'

const { values } = parseArgs({
  allowPositionals: true,
  options: {
    'base-url': {
      type: 'string',
      default: process.env.PERF_SMOKE_BASE_URL ?? 'http://127.0.0.1:1420',
    },
    'settle-ms': { type: 'string', default: '2000' },
    hud: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (values.help) {
  console.log(`Usage: pnpm perf:smoke [--base-url URL] [--settle-ms MS] [--hud] [--json]

Opens ${ROUTE_SMOKE_PATHS.map((r) => r.path).join(', ')} in headless Chromium.`)
  process.exit(0)
}

const baseUrl = values['base-url']!.replace(/\/$/, '')
const settleMs = Number.parseInt(values['settle-ms']!, 10)

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    console.error(`playwright is not installed.

  pnpm add -D playwright
  pnpm exec playwright install chromium

Then retry: pnpm perf:smoke`)
    process.exit(2)
  }
}

async function probeServer(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    return res.ok || res.status === 304
  } catch {
    return false
  }
}

async function waitForSettle(page: import('playwright').Page, ms: number) {
  await page.waitForTimeout(ms)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
}

async function readDomPerf(page: import('playwright').Page) {
  return page.evaluate(() => {
    const hud = document.querySelector('[data-testid="performance-hud"]')
    const snapshotFn = window.__Q_PERF_SNAPSHOT__
    const snapshot = typeof snapshotFn === 'function' ? snapshotFn() : null
    return {
      canvasCount: document.querySelectorAll('canvas').length,
      pathname: window.location.pathname,
      hudVisible: Boolean(hud),
      snapshot,
      hasVisible3dWorkspace: Boolean(
        document.querySelector(
          '[data-testid="optimization-terrain-3d"], [data-testid="discover-swarm-3d"]',
        ),
      ),
    }
  })
}

async function run() {
  if (!(await probeServer(baseUrl))) {
    console.error(`Dev server not reachable at ${baseUrl}

Start one of:
  ./dev.sh --web
  ./dev.sh --mocks
  cd q_frontend && pnpm dev`)
    process.exit(1)
  }

  const { chromium } = await loadPlaywright()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const consoleEvents: ReturnType<typeof classifyConsoleMessage>[] = []
  let lastPerfLog: Record<string, unknown> | null = null

  page.on('console', (msg) => {
    const entry = classifyConsoleMessage(msg.text(), msg.type())
    consoleEvents.push(entry)
    const perf = parsePerfConsoleLine(msg.text())
    if (perf) lastPerfLog = perf
  })

  page.on('pageerror', (err) => {
    consoleEvents.push(classifyConsoleMessage(String(err), 'error'))
  })

  const samples: RouteSample[] = []

  for (const route of ROUTE_SMOKE_PATHS) {
    lastPerfLog = null
    const started = Date.now()
    await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const navigationMs = Date.now() - started
    await waitForSettle(page, settleMs)

    const dom = await readDomPerf(page)
    const perf = lastPerfLog ?? (dom.snapshot as Record<string, unknown> | null) ?? {}

    const num = (key: string, fallback: number | null) => {
      const v = perf[key]
      return typeof v === 'number' ? v : fallback
    }

    samples.push({
      path: route.path,
      label: route.label,
      workspace: route.workspace,
      navigationMs,
      settleMs: num('routeSettleMs', dom.snapshot?.routeSettleMs ?? null),
      canvasCount: num('canvases', dom.canvasCount) ?? dom.canvasCount,
      animationLoops: num('animationLoops', dom.snapshot?.animationLoopCount ?? 0) ?? 0,
      routeMountQueries: num('routeMountQueries', dom.snapshot?.routeMountQueryCount ?? 0) ?? 0,
      fps: num('fps', dom.snapshot?.fps ?? null),
      longTasks: num('longTasks', dom.snapshot?.longTaskCount ?? 0) ?? 0,
      hudVisible: dom.hudVisible,
      hasVisible3dWorkspace: dom.hasVisible3dWorkspace,
      consoleErrors: consoleEvents.filter((e) => e.bucket === 'error').map((e) => e.text),
      gpuWarnings: consoleEvents.filter((e) => e.bucket === 'gpu').map((e) => e.text),
    })
  }

  await browser.close()

  const results = samples.map((sample) => evaluateRouteSample(sample))
  const summary = summarizeSmokeRun(results)
  const gpuWarnings = [
    ...new Set(consoleEvents.filter((e) => e.bucket === 'gpu').map((e) => e.text)),
  ]

  if (values.json) {
    console.log(JSON.stringify({ baseUrl, settleMs, summary, samples, gpuWarnings }, null, 2))
  } else {
    console.log(`\nPerf smoke — ${baseUrl}`)
    console.log('─'.repeat(60))
    for (const sample of samples) {
      const evalResult = results.find((r) => r.path === sample.path)
      const status = evalResult?.ok ? 'OK' : 'FAIL'
      console.log(
        `${status} ${sample.path.padEnd(14)} nav=${sample.navigationMs}ms canvas=${sample.canvasCount} fps=${sample.fps ?? '—'} queries=${sample.routeMountQueries}`,
      )
      for (const w of evalResult?.warnings ?? []) console.log(`     warn: ${w}`)
      for (const i of evalResult?.issues ?? []) console.log(`     issue: ${i}`)
    }
    if (gpuWarnings.length > 0) {
      console.log('\nGPU / compositor console lines:')
      for (const line of gpuWarnings.slice(0, 8)) console.log(`  - ${line}`)
    }
    if (!samples.some((s) => s.hudVisible) && values.hud) {
      console.log('\nNote: HUD not visible — start dev server with VITE_PERF_HUD=true')
    }
    console.log(`\n${summary.failed} failed, ${summary.warned} warned, ${summary.routes} routes`)
  }

  process.exit(summary.ok ? 0 : 1)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
