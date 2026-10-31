import { http, HttpResponse } from 'msw'

import type { ReplayDataset, ReplayDatasetRequest, ReplayStartRequest } from '../../contracts/api'
import type { ReplayJournalRow, ReplayOverview, ReplayRun } from '@/types/replay'

/**
 * In-memory replay simulator for browser mode and tests. It follows the contract's transitions
 * (revision checks, step only while paused, speed range) without running any market data.
 */

const SESSION_DAYS = [
  '2026-09-01',
  '2026-09-02',
  '2026-09-03',
  '2026-09-04',
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-09-18',
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
]

type MockState = {
  phase: ReplayOverview['phase']
  run: ReplayRun | null
  datasets: ReplayDataset[]
  journal: ReplayJournalRow[]
  terminalRunning: boolean
  generations: number
}

function initialState(): MockState {
  return {
    phase: 'idle',
    run: null,
    datasets: [],
    journal: [],
    terminalRunning: false,
    generations: 0,
  }
}

let state: MockState = initialState()

export function resetMockReplayState() {
  state = initialState()
}

export function getMockReplayOverview(): ReplayOverview {
  return {
    phase: state.phase,
    run: state.run ? { ...state.run } : null,
    terminal_running: state.terminalRunning,
    last_error: null,
  }
}

const ACTIVE_STATES = new Set(['prepared', 'paused', 'running'])

function append(action: string, extra: Record<string, unknown> = {}) {
  const run = state.run
  if (!run) return
  state.journal.push({
    seq: state.journal.length,
    kind: 'command',
    market_time_utc: run.canonical_cursor_utc,
    payload_hash: `sha256:${'0'.repeat(64)}`,
    payload: { action, ...extra },
  })
}

function commandResult(commandId: string, accepted: boolean, reason: string | null) {
  const run = state.run
  return {
    command_id: commandId,
    accepted,
    reason,
    revision: run?.revision ?? 0,
    state: run?.state ?? 'stopped',
  }
}

type MockCommand = {
  command_id: string
  expected_revision: number
  action: 'pause' | 'resume' | 'speed' | 'step' | 'stop'
  rate?: number
  market_ms?: number
}

function applyCommand(body: MockCommand) {
  const run = state.run
  if (!run) return { status: 404, body: { message: 'no replay run exists', code: 'no_run' } }
  if (body.expected_revision !== run.revision) {
    return { status: 200, body: commandResult(body.command_id, false, 'stale_revision') }
  }
  const active = ACTIVE_STATES.has(run.state)
  let reason: string | null = null
  switch (body.action) {
    case 'resume':
      if (run.state === 'prepared' || run.state === 'paused') run.state = 'running'
      else reason = 'invalid_transition'
      break
    case 'pause':
      if (run.state === 'prepared' || run.state === 'running') run.state = 'paused'
      else reason = 'invalid_transition'
      break
    case 'speed':
      if (body.rate === undefined || body.rate < 0.1 || body.rate > 10) reason = 'invalid_rate'
      else if (!active) reason = 'run_not_active'
      else run.rate = body.rate
      break
    case 'step':
      if (run.state !== 'paused') reason = 'step_requires_pause'
      else {
        run.canonical_cursor_utc = new Date(
          Date.parse(run.canonical_cursor_utc) + (body.market_ms ?? 0),
        )
          .toISOString()
          .replace('.000Z', 'Z')
        run.visible_cursor_utc = run.canonical_cursor_utc
      }
      break
    case 'stop':
      if (!active) reason = 'run_not_active'
      else run.state = 'stopped'
      break
  }
  if (reason) return { status: 200, body: commandResult(body.command_id, false, reason) }
  run.revision += 1
  append(
    body.action,
    body.rate !== undefined
      ? { rate: body.rate }
      : body.market_ms !== undefined
        ? { market_ms: body.market_ms }
        : {},
  )
  return { status: 200, body: commandResult(body.command_id, true, null) }
}

export const replayHandlers = [
  http.get('*/api/v1/replay/overview', () => HttpResponse.json(getMockReplayOverview())),

  http.get('*/api/v1/replay/tickstore', () =>
    HttpResponse.json([{ symbol: 'WIN$N', days: SESSION_DAYS }]),
  ),

  http.get('*/api/v1/replay/datasets', () => HttpResponse.json(state.datasets)),

  http.post('*/api/v1/replay/datasets', async ({ request }) => {
    const body = (await request.json()) as ReplayDatasetRequest
    const datasetId = `${body.symbol.toLowerCase().replace(/[^a-z0-9]/g, '')}-${body.start_day.replace(/-/g, '')}-${body.end_day.replace(/-/g, '')}`
    if (state.datasets.some((dataset) => dataset.dataset_id === datasetId)) {
      return HttpResponse.json(
        { message: `dataset ${datasetId} already exists`, code: 'dataset_exists' },
        { status: 409 },
      )
    }
    const dataset: ReplayDataset = {
      dataset_id: datasetId,
      symbol: body.symbol,
      state: 'ready',
      start_day: body.start_day,
      end_day: body.end_day,
      coverage_start_utc: `${body.start_day}T03:00:00Z`,
      coverage_end_utc: `${body.end_day}T03:00:00Z`,
      manifest_path: 'manifest.json',
      error: null,
    }
    state.datasets = [...state.datasets, dataset]
    return HttpResponse.json(dataset, { status: 202 })
  }),

  http.post('*/api/v1/replay/runs', async ({ request }) => {
    const body = (await request.json()) as ReplayStartRequest
    const dataset = state.datasets.find((item) => item.dataset_id === body.dataset_id)
    if (!dataset) {
      return HttpResponse.json(
        { message: `dataset ${body.dataset_id} does not exist`, code: 'dataset_not_found' },
        { status: 404 },
      )
    }
    if (state.phase !== 'idle') {
      return HttpResponse.json(
        { message: `the replay stack is ${state.phase}`, code: 'stack_running' },
        { status: 409 },
      )
    }
    state.generations += 1
    state.journal = []
    state.run = {
      run_id: '0b8f1f0e-6a7e-4d59-9a4b-3f1c2a7e9d10',
      generation: `gen-mock-${state.generations}`,
      state: 'prepared',
      revision: 0,
      rate: body.rate ?? 1,
      canonical_cursor_utc: body.start_utc,
      visible_cursor_utc: body.start_utc,
      queue_depth: 0,
      lag_ms: 0,
      outstanding_intents: 0,
      config_hash: `sha256:${'a'.repeat(64)}`,
      dataset_checksums: [`sha256:${'b'.repeat(64)}`],
      last_error: null,
      fixed_latency: {
        market_data_ms: body.latency?.market_data_ms ?? 0,
        order_transport_ms: body.latency?.order_transport_ms ?? 0,
        broker_accept_ms: body.latency?.broker_accept_ms ?? 0,
        broker_execution_ms: body.latency?.broker_execution_ms ?? 0,
        broker_response_ms: body.latency?.broker_response_ms ?? 0,
      },
    }
    state.phase = 'ready'
    return HttpResponse.json(getMockReplayOverview(), { status: 202 })
  }),

  http.post('*/api/v1/replay/runs/current/commands', async ({ request }) => {
    const body = (await request.json()) as MockCommand
    const result = applyCommand(body)
    return HttpResponse.json(result.body, { status: result.status })
  }),

  http.get('*/api/v1/replay/runs/current/journal', ({ request }) => {
    if (!state.run) {
      return HttpResponse.json({ message: 'no replay run exists', code: 'no_run' }, { status: 409 })
    }
    const url = new URL(request.url)
    const afterSeq = Number(url.searchParams.get('after_seq') ?? '-1')
    const limit = Number(url.searchParams.get('limit') ?? '200')
    const entries = state.journal.filter((row) => row.seq > afterSeq).slice(0, limit)
    return HttpResponse.json({
      entries,
      next_after_seq: entries.length === limit ? entries[entries.length - 1].seq : null,
    })
  }),

  http.post('*/api/v1/replay/stack/stop', () => {
    state.phase = 'idle'
    state.run = null
    state.terminalRunning = false
    return HttpResponse.json(getMockReplayOverview(), { status: 202 })
  }),

  http.post('*/api/v1/replay/stack/terminal', () => {
    state.terminalRunning = true
    return HttpResponse.json(getMockReplayOverview(), { status: 202 })
  }),
]
