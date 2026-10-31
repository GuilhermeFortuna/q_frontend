import type { ReplayDatasetRequest, ReplayStartRequest } from '../../../contracts/api'
import type { ReplayOverview } from '@/types/replay'

export const SPEED_MIN = 0.1
export const SPEED_MAX = 10
export const STEP_MAX_MINUTES = 1440

/**
 * Brazil has observed UTC-3 without daylight saving since 2019, so exchange-local wall time is
 * converted with that fixed offset. Replay times are exchange-local in the form and UTC on the wire.
 */
export const EXCHANGE_OFFSET = '-03:00'
export const EXCHANGE_TIMEZONE = 'America/Sao_Paulo'

/**
 * Login of the simulated demo account. The simulator reports it to the terminal and the launcher
 * allowlists it for execution, so the operator does not choose it.
 */
export const REPLAY_ACCOUNT_LOGIN = 900001

/** Largest span of session days one dataset can cover (the contract allows 32 inclusive days). */
const MAX_SPAN_DAYS = 31

export type TransportState = {
  pause: boolean
  resume: boolean
  speed: boolean
  step: boolean
  endRun: boolean
  shutdown: boolean
  openTerminal: boolean
}

/**
 * Which controls may be used now. Run commands need a ready stack; a failed or completed run stays
 * on screen with only shutdown and the terminal available. Nothing runs while the stack is starting
 * or stopping.
 */
export function transportState(overview: ReplayOverview): TransportState {
  const busy = overview.phase === 'starting' || overview.phase === 'stopping'
  const ready = overview.phase === 'ready' && !busy
  const run = overview.run
  const state = run?.state
  return {
    pause: ready && (state === 'prepared' || state === 'running'),
    resume: ready && (state === 'prepared' || state === 'paused'),
    speed: ready && (state === 'prepared' || state === 'paused' || state === 'running'),
    step: ready && state === 'paused',
    endRun: ready && (state === 'prepared' || state === 'paused' || state === 'running'),
    shutdown: overview.phase !== 'idle' && !busy,
    openTerminal: ready && !overview.terminal_running,
  }
}

/** Parses a speed typed by the operator; null when it is not a finite rate in the simulator range. */
export function parseSpeed(text: string): number | null {
  const value = Number(text.trim())
  if (text.trim() === '' || !Number.isFinite(value)) return null
  if (value < SPEED_MIN || value > SPEED_MAX) return null
  return value
}

/** Parses a step in whole market minutes into market milliseconds; null when out of range. */
export function parseStepMarketMs(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const minutes = Number(trimmed)
  if (minutes < 1 || minutes > STEP_MAX_MINUTES) return null
  return minutes * 60_000
}

/** Exchange-local wall time to a UTC ISO instant; null when malformed. */
export function exchangeLocalToUtc(local: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim())
  if (!match) return null
  const [, day, hour, minute, second = '00'] = match
  const moment = new Date(`${day}T${hour.padStart(2, '0')}:${minute}:${second}${EXCHANGE_OFFSET}`)
  if (Number.isNaN(moment.getTime())) return null
  return moment.toISOString().replace('.000Z', 'Z')
}

/** The day after an ISO calendar day, as `YYYY-MM-DD`. */
export function nextDay(day: string): string {
  const moment = new Date(`${day}T00:00:00Z`)
  moment.setUTCDate(moment.getUTCDate() + 1)
  return moment.toISOString().slice(0, 10)
}

/** Dataset identifier the Research API derives from symbol and session days. */
export function datasetIdFor(symbol: string, startDay: string, endDay: string): string {
  const clean = symbol.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${clean}-${startDay.replace(/-/g, '')}-${endDay.replace(/-/g, '')}`
}

export type ReplayForm = {
  symbol: string
  startDay: string
  endDay: string
  initialCapital: string
  pointValue: string
  priceTick: string
}

export const EMPTY_REPLAY_FORM: ReplayForm = {
  symbol: 'WIN$N',
  startDay: '',
  endDay: '',
  initialCapital: '100000.00',
  pointValue: '',
  priceTick: '',
}

export type ReplayPlan = {
  /** Freezes the TickStore range; the dataset is reused when it already exists. */
  freeze: ReplayDatasetRequest
  /** Run request without the dataset identifier, which comes from the freeze. */
  run: Omit<ReplayStartRequest, 'dataset_id'>
  datasetId: string
}

export type FormErrors = Partial<Record<keyof ReplayForm, string>>

const MONEY = /^\d+(\.\d+)?$/

function positive(text: string): number | null {
  const value = Number(text.trim())
  return text.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Turns the form into the two requests the Research API needs. The instrument specification the
 * simulator requires is derived here: the point value is the contract size, the price tick sets
 * the digits, and margin, commission and slippage are zero.
 */
export function buildReplayPlan(form: ReplayForm): { plan: ReplayPlan | null; errors: FormErrors } {
  const errors: FormErrors = {}
  const symbol = form.symbol.trim()
  if (!symbol) errors.symbol = 'Enter the TickStore symbol, for example WIN$N.'
  if (!form.startDay) errors.startDay = 'Choose the first day.'
  if (!form.endDay) errors.endDay = 'Choose the last day.'
  if (form.startDay && form.endDay) {
    if (form.endDay < form.startDay) errors.endDay = 'The last day is before the first day.'
    else if (
      Math.round((Date.parse(form.endDay) - Date.parse(form.startDay)) / 86_400_000) > MAX_SPAN_DAYS
    ) {
      errors.endDay = `Choose at most ${MAX_SPAN_DAYS + 1} days.`
    }
  }
  if (!MONEY.test(form.initialCapital.trim()) || Number(form.initialCapital) <= 0) {
    errors.initialCapital = 'Initial capital is a positive amount, such as 100000.00.'
  }
  const pointValue = positive(form.pointValue)
  if (pointValue === null) errors.pointValue = 'Point value is a positive number (R$ per point).'
  const tick = positive(form.priceTick)
  if (tick === null) errors.priceTick = 'Price tick is a positive number (the smallest price step).'
  const digits = tick === null ? 0 : (String(form.priceTick).trim().split('.')[1] ?? '').length
  if (digits > 12) errors.priceTick = 'Price tick has too many decimal places.'

  if (Object.keys(errors).length > 0 || pointValue === null || tick === null) {
    return { plan: null, errors }
  }
  const start = exchangeLocalToUtc(`${form.startDay}T00:00`)
  const end = exchangeLocalToUtc(`${nextDay(form.endDay)}T00:00`)
  if (!start || !end) return { plan: null, errors: { startDay: 'The dates are not valid.' } }

  const datasetId = datasetIdFor(symbol, form.startDay, form.endDay)
  return {
    errors,
    plan: {
      datasetId,
      freeze: {
        symbol,
        start_day: form.startDay,
        end_day: form.endDay,
        symbol_spec: {
          description: symbol,
          point: tick,
          digits,
          volume_min: 1,
          volume_step: 1,
          volume_max: 100,
          trade_contract_size: pointValue,
          margin_per_contract: '0',
          commission_per_contract: '0',
          slippage_ticks: 0,
        },
      },
      run: {
        start_utc: start,
        end_utc: end,
        warmup_start_utc: null,
        initial_balance: form.initialCapital.trim(),
        account: { login: REPLAY_ACCOUNT_LOGIN, currency: 'BRL' },
        latency: {
          market_data_ms: 0,
          order_transport_ms: 0,
          broker_accept_ms: 0,
          broker_execution_ms: 0,
          broker_response_ms: 0,
        },
        rate: 1,
      },
    },
  }
}
