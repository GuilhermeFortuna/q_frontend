import { describe, expect, it } from 'vitest'

import type { ReplayOverview, ReplayRun } from '@/types/replay'
import {
  buildReplayPlan,
  exchangeLocalToUtc,
  nextDay,
  parseSpeed,
  parseStepMarketMs,
  REPLAY_ACCOUNT_LOGIN,
  transportState,
  type ReplayForm,
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
    expect(exchangeLocalToUtc('2026-10-01 9:00')).toBe('2026-10-01T12:00:00Z')
    expect(exchangeLocalToUtc('2026-10-01 25:00')).toBeNull()
    expect(exchangeLocalToUtc('01/10/2026 09:00')).toBeNull()
  })
})

const FORM: ReplayForm = {
  symbol: 'WIN$N',
  startDay: '2026-10-01',
  endDay: '2026-10-02',
  initialCapital: '5000.00',
  pointValue: '0.20',
  priceTick: '5',
}

describe('buildReplayPlan', () => {
  it('derives the freeze and run requests from the simple form', () => {
    const { plan, errors } = buildReplayPlan(FORM)
    expect(errors).toEqual({})
    expect(plan?.datasetId).toBe('winn-20261001-20261002')
    expect(plan?.freeze).toEqual({
      symbol: 'WIN$N',
      start_day: '2026-10-01',
      end_day: '2026-10-02',
      symbol_spec: {
        description: 'WIN$N',
        point: 5,
        digits: 0,
        volume_min: 1,
        volume_step: 1,
        volume_max: 100,
        trade_contract_size: 0.2,
        margin_per_contract: '0',
        commission_per_contract: '0',
        slippage_ticks: 0,
      },
    })
    expect(plan?.run).toEqual({
      start_utc: '2026-10-01T03:00:00Z',
      end_utc: '2026-10-03T03:00:00Z',
      warmup_start_utc: null,
      initial_balance: '5000.00',
      account: { login: REPLAY_ACCOUNT_LOGIN, currency: 'BRL' },
      latency: {
        market_data_ms: 0,
        order_transport_ms: 0,
        broker_accept_ms: 0,
        broker_execution_ms: 0,
        broker_response_ms: 0,
      },
      rate: 1,
    })
  })

  it('takes the digits of the price tick from its decimals', () => {
    const { plan } = buildReplayPlan({ ...FORM, symbol: 'WDO$N', priceTick: '0.5' })
    expect(plan?.freeze.symbol_spec.point).toBe(0.5)
    expect(plan?.freeze.symbol_spec.digits).toBe(1)
  })

  it('reports each missing or invalid field', () => {
    const { plan, errors } = buildReplayPlan({
      ...FORM,
      symbol: '',
      startDay: '',
      initialCapital: '0',
      pointValue: 'x',
      priceTick: '',
    })
    expect(plan).toBeNull()
    expect(errors.symbol).toBeDefined()
    expect(errors.startDay).toBeDefined()
    expect(errors.initialCapital).toBeDefined()
    expect(errors.pointValue).toBeDefined()
    expect(errors.priceTick).toBeDefined()
  })

  it('refuses a last day before the first day and a span beyond the contract', () => {
    expect(buildReplayPlan({ ...FORM, endDay: '2026-09-30' }).errors.endDay).toMatch(/before/)
    expect(buildReplayPlan({ ...FORM, endDay: '2026-11-15' }).errors.endDay).toMatch(/at most/)
  })
})

describe('date helpers', () => {
  it('finds the next day across month ends', () => {
    expect(nextDay('2026-10-31')).toBe('2026-11-01')
    expect(nextDay('2026-02-28')).toBe('2026-03-01')
  })
})

describe('replay time display', () => {
  it('shows market time in exchange-local and UTC', () => {
    expect(formatExchangeTime('2026-10-01T12:00:00Z')).toBe('2026-10-01 09:00:00 BRT')
    expect(formatUtcTime('2026-10-01T12:00:00Z')).toBe('2026-10-01 12:00:00 UTC')
    expect(formatExchangeTime(null)).toBe('—')
  })
})
