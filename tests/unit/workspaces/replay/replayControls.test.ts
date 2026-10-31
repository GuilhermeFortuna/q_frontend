import { describe, expect, it } from 'vitest'

import type { ReplayOverview, ReplayRun } from '@/types/replay'
import {
  buildFreezeRequest,
  buildStartRequest,
  exchangeLocalToUtc,
  parseSpeed,
  parseStepMarketMs,
  transportState,
  type FreezeForm,
  type RunForm,
} from '@/workspaces/replay/replayControls'
import { formatExchangeTime, formatUtcTime } from '@/workspaces/replay/replayTime'

function run(state: ReplayRun['state'], revision = 3): ReplayRun {
  return {
    run_id: '0b8f1f0e-6a7e-4d59-9a4b-3f1c2a7e9d10',
    generation: 'gen-test',
    state,
    revision,
    rate: 1,
    canonical_cursor_utc: '2026-10-01T12:00:00Z',
    visible_cursor_utc: '2026-10-01T12:00:00Z',
    queue_depth: 0,
    lag_ms: 0,
    outstanding_intents: 0,
    config_hash: `sha256:${'a'.repeat(64)}`,
    dataset_checksums: [],
    last_error: null,
  }
}

function overview(phase: ReplayOverview['phase'], state?: ReplayRun['state']): ReplayOverview {
  return {
    phase,
    run: state ? run(state) : null,
    terminal_running: false,
    last_error: null,
  }
}

describe('transportState', () => {
  it('a prepared run can resume or pause, but step waits for pause', () => {
    const controls = transportState(overview('ready', 'prepared'))
    expect(controls.resume).toBe(true)
    expect(controls.pause).toBe(true)
    expect(controls.step).toBe(false)
    expect(controls.speed).toBe(true)
  })

  it('a paused run allows step and resume, not pause', () => {
    const controls = transportState(overview('ready', 'paused'))
    expect(controls.step).toBe(true)
    expect(controls.resume).toBe(true)
    expect(controls.pause).toBe(false)
  })

  it('a running run allows pause only', () => {
    const controls = transportState(overview('ready', 'running'))
    expect(controls.pause).toBe(true)
    expect(controls.resume).toBe(false)
    expect(controls.step).toBe(false)
  })

  it('a completed or failed run stays readable: only shutdown and terminal remain', () => {
    const controls = transportState(overview('ready', 'completed'))
    expect(controls.resume).toBe(false)
    expect(controls.pause).toBe(false)
    expect(controls.speed).toBe(false)
    expect(controls.endRun).toBe(false)
    expect(controls.shutdown).toBe(true)
    expect(controls.openTerminal).toBe(true)
  })

  it('nothing runs while the stack is starting or stopping', () => {
    for (const phase of ['starting', 'stopping'] as const) {
      const controls = transportState(overview(phase, 'paused'))
      expect(Object.values(controls).every((enabled) => enabled === false)).toBe(true)
    }
  })

  it('a failed stack keeps only shutdown; run commands need a ready stack', () => {
    const controls = transportState(overview('failed', 'paused'))
    expect(controls.resume).toBe(false)
    expect(controls.shutdown).toBe(true)
    expect(controls.openTerminal).toBe(false)
  })

  it('an idle stack offers nothing to shut down', () => {
    expect(transportState(overview('idle')).shutdown).toBe(false)
  })
})

describe('input parsing', () => {
  it('accepts speeds only within the simulator range', () => {
    expect(parseSpeed('1')).toBe(1)
    expect(parseSpeed(' 10 ')).toBe(10)
    expect(parseSpeed('0.1')).toBe(0.1)
    expect(parseSpeed('0.05')).toBeNull()
    expect(parseSpeed('11')).toBeNull()
    expect(parseSpeed('')).toBeNull()
    expect(parseSpeed('fast')).toBeNull()
  })

  it('converts step minutes to market milliseconds', () => {
    expect(parseStepMarketMs('5')).toBe(300_000)
    expect(parseStepMarketMs('1440')).toBe(86_400_000)
    expect(parseStepMarketMs('0')).toBeNull()
    expect(parseStepMarketMs('1441')).toBeNull()
    expect(parseStepMarketMs('1.5')).toBeNull()
  })

  it('reads exchange-local wall time as UTC-3', () => {
    expect(exchangeLocalToUtc('2026-10-01T09:00')).toBe('2026-10-01T12:00:00Z')
    expect(exchangeLocalToUtc('2026-10-01T09:00:30')).toBe('2026-10-01T12:00:30Z')
    expect(exchangeLocalToUtc('2026-10-01 09:00')).toBe('2026-10-01T12:00:00Z')
    expect(exchangeLocalToUtc(' 2026-10-01T09:00 ')).toBe('2026-10-01T12:00:00Z')
    expect(exchangeLocalToUtc('2026-10-01 9:00')).toBeNull()
    expect(exchangeLocalToUtc('01/10/2026 09:00')).toBeNull()
  })
})

const RUN_FORM: RunForm = {
  datasetId: 'wdon-20261001-20261001',
  startLocal: '2026-10-01T09:00',
  endLocal: '2026-10-01T10:00',
  warmupLocal: '',
  initialBalance: '100000.00',
  login: '900001',
  currency: 'BRL',
  marketDataMs: '0',
  orderTransportMs: '50',
  brokerAcceptMs: '0',
  brokerExecutionMs: '0',
  brokerResponseMs: '0',
  rate: '1',
}

describe('buildStartRequest', () => {
  it('builds the contract body with UTC times and integer latency', () => {
    const { body, errors } = buildStartRequest(RUN_FORM)
    expect(errors).toEqual({})
    expect(body).toEqual({
      dataset_id: 'wdon-20261001-20261001',
      start_utc: '2026-10-01T12:00:00Z',
      end_utc: '2026-10-01T13:00:00Z',
      warmup_start_utc: null,
      initial_balance: '100000.00',
      account: { login: 900001, currency: 'BRL' },
      latency: {
        market_data_ms: 0,
        order_transport_ms: 50,
        broker_accept_ms: 0,
        broker_execution_ms: 0,
        broker_response_ms: 0,
      },
      rate: 1,
    })
  })

  it('refuses an end before the start and a missing dataset with reasons', () => {
    const { body, errors } = buildStartRequest({
      ...RUN_FORM,
      datasetId: '',
      endLocal: '2026-10-01T08:00',
    })
    expect(body).toBeNull()
    expect(errors.datasetId).toMatch(/dataset/i)
    expect(errors.endLocal).toMatch(/after the start/)
  })

  it('refuses a malformed login, currency and out-of-range speed', () => {
    const { body, errors } = buildStartRequest({
      ...RUN_FORM,
      login: '0',
      currency: 'real',
      rate: '12',
    })
    expect(body).toBeNull()
    expect(errors.login).toBeDefined()
    expect(errors.currency).toBeDefined()
    expect(errors.rate).toBeDefined()
  })

  it('requires warmup to begin before the start', () => {
    const { errors } = buildStartRequest({ ...RUN_FORM, warmupLocal: '2026-10-01T09:30' })
    expect(errors.warmupLocal).toMatch(/before the start/)
  })
})

const FREEZE_FORM: FreezeForm = {
  symbol: 'WIN$N',
  startDay: '2026-10-01',
  endDay: '2026-10-01',
  point: '5',
  digits: '0',
  volumeMin: '1',
  volumeStep: '1',
  volumeMax: '100',
  contractSize: '1',
  marginPerContract: '1500.00',
  commissionPerContract: '',
  description: 'mini index',
}

describe('buildFreezeRequest', () => {
  it('builds the freeze body with the instrument specification', () => {
    const { body, errors } = buildFreezeRequest(FREEZE_FORM)
    expect(errors).toEqual({})
    expect(body?.symbol_spec.point).toBe(5)
    expect(body?.symbol_spec.commission_per_contract).toBe('0')
    expect(body?.start_day).toBe('2026-10-01')
  })

  it('reports an inverted day range and a non-positive point', () => {
    const { body, errors } = buildFreezeRequest({
      ...FREEZE_FORM,
      endDay: '2026-09-30',
      point: '0',
    })
    expect(body).toBeNull()
    expect(errors.endDay).toMatch(/before/)
    expect(errors.point).toBeDefined()
  })
})

describe('replay time display', () => {
  it('shows market time in exchange-local and UTC', () => {
    expect(formatExchangeTime('2026-10-01T12:00:00Z')).toBe('2026-10-01 09:00:00 BRT')
    expect(formatUtcTime('2026-10-01T12:00:00Z')).toBe('2026-10-01 12:00:00 UTC')
    expect(formatExchangeTime(null)).toBe('—')
  })
})
