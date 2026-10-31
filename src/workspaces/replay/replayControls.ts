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

/**
 * Exchange-local wall time to a UTC ISO instant; null when malformed. Accepts `YYYY-MM-DD HH:mm`
 * (the form's format) or the ISO `T` separator, with optional seconds.
 */
export function exchangeLocalToUtc(local: string): string | null {
  const normalized = local.trim().replace(' ', 'T')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(normalized)) return null
  const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized
  const moment = new Date(`${withSeconds}${EXCHANGE_OFFSET}`)
  if (Number.isNaN(moment.getTime())) return null
  return moment.toISOString().replace('.000Z', 'Z')
}

export type FreezeForm = {
  symbol: string
  startDay: string
  endDay: string
  point: string
  digits: string
  volumeMin: string
  volumeStep: string
  volumeMax: string
  contractSize: string
  marginPerContract: string
  commissionPerContract: string
  description: string
}

export type FormErrors<T extends string> = Partial<Record<T | 'general', string>>

const MONEY = /^\d+(\.\d+)?$/

function positiveNumber(text: string): number | null {
  const value = Number(text.trim())
  return text.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null
}

export function buildFreezeRequest(form: FreezeForm): {
  body: ReplayDatasetRequest | null
  errors: FormErrors<keyof FreezeForm>
} {
  const errors: FormErrors<keyof FreezeForm> = {}
  const symbol = form.symbol.trim()
  if (!symbol) errors.symbol = 'Enter the TickStore symbol, for example WIN$N.'
  if (!form.startDay || !form.endDay) errors.startDay = 'Choose the first and last session days.'
  else if (form.endDay < form.startDay) errors.endDay = 'The last day is before the first day.'
  const point = positiveNumber(form.point)
  if (point === null) errors.point = 'Point must be a positive number.'
  const digits = Number(form.digits)
  if (!Number.isInteger(digits) || digits < 0 || digits > 12)
    errors.digits = 'Digits must be 0 to 12.'
  const volumeMin = positiveNumber(form.volumeMin)
  if (volumeMin === null) errors.volumeMin = 'Minimum volume must be positive.'
  const volumeStep = positiveNumber(form.volumeStep)
  if (volumeStep === null) errors.volumeStep = 'Volume step must be positive.'
  const volumeMax = positiveNumber(form.volumeMax)
  if (volumeMax === null) errors.volumeMax = 'Maximum volume must be positive.'
  const contractSize = positiveNumber(form.contractSize)
  if (contractSize === null) errors.contractSize = 'Contract size must be positive.'
  if (!MONEY.test(form.marginPerContract.trim())) {
    errors.marginPerContract = 'Margin is a decimal amount such as 1500.00.'
  }
  const commission = form.commissionPerContract.trim() || '0'
  if (!MONEY.test(commission)) errors.commissionPerContract = 'Commission is a decimal amount.'

  if (Object.keys(errors).length > 0) return { body: null, errors }
  return {
    body: {
      symbol,
      start_day: form.startDay,
      end_day: form.endDay,
      symbol_spec: {
        description: form.description.trim(),
        point: point as number,
        digits,
        volume_min: volumeMin as number,
        volume_step: volumeStep as number,
        volume_max: volumeMax as number,
        trade_contract_size: contractSize as number,
        margin_per_contract: form.marginPerContract.trim(),
        commission_per_contract: commission,
        slippage_ticks: 0,
      },
    },
    errors,
  }
}

export type RunForm = {
  datasetId: string
  startLocal: string
  endLocal: string
  warmupLocal: string
  initialBalance: string
  login: string
  currency: string
  marketDataMs: string
  orderTransportMs: string
  brokerAcceptMs: string
  brokerExecutionMs: string
  brokerResponseMs: string
  rate: string
}

function latencyValue(text: string): number | null {
  const trimmed = text.trim() === '' ? '0' : text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

export function buildStartRequest(form: RunForm): {
  body: ReplayStartRequest | null
  errors: FormErrors<keyof RunForm>
} {
  const errors: FormErrors<keyof RunForm> = {}
  if (!form.datasetId) errors.datasetId = 'Choose a ready dataset or freeze one first.'
  const start = exchangeLocalToUtc(form.startLocal)
  if (!start) errors.startLocal = 'Enter the start as YYYY-MM-DD HH:mm (exchange time).'
  const end = exchangeLocalToUtc(form.endLocal)
  if (!end) errors.endLocal = 'Enter the end as YYYY-MM-DD HH:mm (exchange time).'
  if (start && end && Date.parse(end) <= Date.parse(start)) {
    errors.endLocal = 'The end must be after the start (the interval excludes the end).'
  }
  let warmup: string | null = null
  if (form.warmupLocal.trim() !== '') {
    warmup = exchangeLocalToUtc(form.warmupLocal.trim())
    if (!warmup) errors.warmupLocal = 'Enter the warmup start as YYYY-MM-DD HH:mm (exchange time).'
    else if (start && Date.parse(warmup) >= Date.parse(start)) {
      errors.warmupLocal = 'Warmup must begin before the start.'
    }
  }
  if (!MONEY.test(form.initialBalance.trim()) || Number(form.initialBalance) <= 0) {
    errors.initialBalance = 'Initial balance is a positive decimal amount.'
  }
  const login = Number(form.login)
  if (!/^\d+$/.test(form.login.trim()) || login < 1)
    errors.login = 'Account login is a positive whole number.'
  if (!/^[A-Z]{3}$/.test(form.currency.trim()))
    errors.currency = 'Currency is a three-letter code such as BRL.'
  const latency = {
    market_data_ms: latencyValue(form.marketDataMs),
    order_transport_ms: latencyValue(form.orderTransportMs),
    broker_accept_ms: latencyValue(form.brokerAcceptMs),
    broker_execution_ms: latencyValue(form.brokerExecutionMs),
    broker_response_ms: latencyValue(form.brokerResponseMs),
  }
  if (Object.values(latency).some((value) => value === null)) {
    errors.marketDataMs = 'Latencies are whole milliseconds, zero or more.'
  }
  const rate = parseSpeed(form.rate)
  if (rate === null) errors.rate = `Initial speed is between ${SPEED_MIN} and ${SPEED_MAX}.`

  if (Object.keys(errors).length > 0 || !start || !end || rate === null)
    return { body: null, errors }
  return {
    body: {
      dataset_id: form.datasetId,
      start_utc: start,
      end_utc: end,
      warmup_start_utc: warmup,
      initial_balance: form.initialBalance.trim(),
      account: { login, currency: form.currency.trim() },
      latency: {
        market_data_ms: latency.market_data_ms as number,
        order_transport_ms: latency.order_transport_ms as number,
        broker_accept_ms: latency.broker_accept_ms as number,
        broker_execution_ms: latency.broker_execution_ms as number,
        broker_response_ms: latency.broker_response_ms as number,
      },
      rate,
    },
    errors,
  }
}
