import type { JobSnapshotResponse } from '../../../contracts/api'
import type {
  HistoryExpiredResponse,
  HistoryPageResponse,
  JobProgressPayload,
  JobTerminalPayload,
  StreamEnvelope,
  SubscribedFrame,
} from '../../../contracts/stream'
import type { InboundFrame } from '@/lib/stream/framing'

export type JobKind = JobProgressPayload['kind']
export type JobKey = `${JobKind}:${string}`

export type JobProgressEffect = {
  type: 'jobProgress'
  key: JobKey
  payload: JobProgressPayload
}

export type JobTerminalEffect = {
  type: 'jobTerminal'
  key: JobKey
  payload: JobTerminalPayload
}

export type ReconcilerEffect =
  | { type: 'fetchSnapshot' }
  | { type: 'fetchHistory'; topic: 'jobs.terminal'; epoch: string; fromSeq: number }
  | JobProgressEffect
  | JobTerminalEffect
  | {
      type: 'resync'
      reason: 'epoch_changed' | 'lagging' | 'cursor_expired' | 'history_expired' | 'rejected'
    }

type TopicWatermark = { epoch: string; seq: number }

export interface ReconcilerState {
  phase: 'idle' | 'buffering' | 'live' | 'awaiting_history'
  buffer: StreamEnvelope[]
  held: StreamEnvelope[]
  watermarks: Record<string, TopicWatermark>
  lastSeq: Record<string, number>
  epochs: Record<string, string>
  progressWatermark: Record<string, TopicWatermark>
}

export function initialState(): ReconcilerState {
  return {
    phase: 'idle',
    buffer: [],
    held: [],
    watermarks: {},
    lastSeq: {},
    epochs: {},
    progressWatermark: {},
  }
}

function clone(state: ReconcilerState): ReconcilerState {
  return {
    phase: state.phase,
    buffer: [...state.buffer],
    held: [...state.held],
    watermarks: { ...state.watermarks },
    lastSeq: { ...state.lastSeq },
    epochs: { ...state.epochs },
    progressWatermark: { ...state.progressWatermark },
  }
}

function jobKey(kind: JobKind, jobId: string): JobKey {
  return `${kind}:${jobId}`
}

function topicWatermark(raw: unknown): TopicWatermark | null {
  if (raw === null || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  if (typeof value.epoch !== 'string' || typeof value.seq !== 'number') return null
  return { epoch: value.epoch, seq: value.seq }
}

function isHistoryExpired(
  page: HistoryPageResponse | HistoryExpiredResponse,
): page is HistoryExpiredResponse {
  return 'requested_from_seq' in page && !('entries' in page)
}

function payloadRecord(envelope: StreamEnvelope): Record<string, unknown> | null {
  if (envelope.payload === null || typeof envelope.payload !== 'object') return null
  return envelope.payload as Record<string, unknown>
}

function progressFrom(envelope: StreamEnvelope): JobProgressPayload | null {
  const payload = payloadRecord(envelope)
  if (!payload) return null
  if (typeof payload.kind !== 'string' || typeof payload.job_id !== 'string') return null
  if (payload.status !== 'queued' && payload.status !== 'running') return null
  return payload as unknown as JobProgressPayload
}

function terminalFrom(envelope: StreamEnvelope): JobTerminalPayload | null {
  const payload = payloadRecord(envelope)
  if (!payload) return null
  if (typeof payload.kind !== 'string' || typeof payload.job_id !== 'string') return null
  if (
    payload.status !== 'completed' &&
    payload.status !== 'failed' &&
    payload.status !== 'cancelled'
  ) {
    return null
  }
  return payload as unknown as JobTerminalPayload
}

function resync(
  reason: Extract<ReconcilerEffect, { type: 'resync' }>['reason'],
): [ReconcilerState, ReconcilerEffect[]] {
  return [initialState(), [{ type: 'resync', reason }]]
}

export function onSubscribed(
  _state: ReconcilerState,
  _frame: SubscribedFrame,
): [ReconcilerState, ReconcilerEffect[]] {
  const next = initialState()
  next.phase = 'buffering'
  return [next, [{ type: 'fetchSnapshot' }]]
}

function applyProgress(
  state: ReconcilerState,
  envelope: StreamEnvelope,
  effects: ReconcilerEffect[],
): 'ok' | 'resync' {
  const payload = progressFrom(envelope)
  if (!payload) return 'ok'

  const key = jobKey(payload.kind, payload.job_id)
  const watermark = state.progressWatermark[key]
  if (watermark && envelope.epoch !== watermark.epoch) {
    return 'resync'
  }

  effects.push({ type: 'jobProgress', key, payload })
  state.progressWatermark[key] = { epoch: envelope.epoch, seq: envelope.seq }
  state.epochs[envelope.topic] = envelope.epoch
  state.lastSeq[envelope.topic] = envelope.seq
  return 'ok'
}

function applyTerminal(
  state: ReconcilerState,
  envelope: StreamEnvelope,
  effects: ReconcilerEffect[],
): 'ok' | 'resync' | 'gap' {
  const payload = terminalFrom(envelope)
  if (!payload) return 'ok'

  const storedEpoch = state.epochs['jobs.terminal'] ?? state.watermarks['jobs.terminal']?.epoch
  if (storedEpoch && envelope.epoch !== storedEpoch) {
    return 'resync'
  }

  const lastSeq = state.lastSeq['jobs.terminal']
  if (lastSeq !== undefined && envelope.seq <= lastSeq) {
    return 'ok'
  }

  const expected = lastSeq === undefined ? envelope.seq : lastSeq + 1
  if (envelope.seq > expected) {
    effects.push({
      type: 'fetchHistory',
      topic: 'jobs.terminal',
      epoch: envelope.epoch,
      fromSeq: expected,
    })
    return 'gap'
  }

  effects.push({
    type: 'jobTerminal',
    key: jobKey(payload.kind, payload.job_id),
    payload,
  })
  state.lastSeq['jobs.terminal'] = envelope.seq
  state.epochs['jobs.terminal'] = envelope.epoch
  return 'ok'
}

function applyEnvelope(
  state: ReconcilerState,
  envelope: StreamEnvelope,
  effects: ReconcilerEffect[],
): 'ok' | 'resync' | 'gap' {
  if (envelope.topic === 'jobs.progress') {
    return applyProgress(state, envelope, effects)
  }
  if (envelope.topic === 'jobs.terminal') {
    return applyTerminal(state, envelope, effects)
  }
  return 'ok'
}

function discardAgainstSnapshot(
  state: ReconcilerState,
  envelope: StreamEnvelope,
): boolean | 'resync' {
  if (envelope.topic === 'jobs.terminal') {
    const watermark = state.watermarks['jobs.terminal']
    if (!watermark) return false
    if (envelope.epoch !== watermark.epoch) return 'resync'
    return envelope.seq <= watermark.seq
  }
  if (envelope.topic === 'jobs.progress') {
    const payload = progressFrom(envelope)
    if (!payload) return true
    const watermark = state.progressWatermark[jobKey(payload.kind, payload.job_id)]
    if (!watermark) return false
    if (envelope.epoch !== watermark.epoch) return 'resync'
    return envelope.seq <= watermark.seq
  }
  return true
}

export function onEntry(
  state: ReconcilerState,
  envelope: StreamEnvelope,
): [ReconcilerState, ReconcilerEffect[]] {
  const next = clone(state)

  if (next.phase === 'buffering' || next.phase === 'idle') {
    next.phase = 'buffering'
    next.buffer.push(envelope)
    return [next, []]
  }

  if (next.phase === 'awaiting_history') {
    if (envelope.topic === 'jobs.progress') {
      const effects: ReconcilerEffect[] = []
      if (applyProgress(next, envelope, effects) === 'resync') {
        return resync('epoch_changed')
      }
      return [next, effects]
    }
    next.held.push(envelope)
    return [next, []]
  }

  const effects: ReconcilerEffect[] = []
  const result = applyEnvelope(next, envelope, effects)
  if (result === 'resync') return resync('epoch_changed')
  if (result === 'gap') {
    next.phase = 'awaiting_history'
    next.held.push(envelope)
  }
  return [next, effects]
}

export function onSnapshot(
  state: ReconcilerState,
  snap: JobSnapshotResponse,
): [ReconcilerState, ReconcilerEffect[]] {
  const next = clone(state)
  const terminal = topicWatermark(snap.watermark['jobs.terminal'])
  if (terminal) {
    next.watermarks['jobs.terminal'] = terminal
    next.lastSeq['jobs.terminal'] = terminal.seq
    next.epochs['jobs.terminal'] = terminal.epoch
  }

  for (const job of snap.jobs) {
    if (job.progress_seq == null || job.progress_epoch == null) continue
    next.progressWatermark[jobKey(job.kind as JobKind, job.job_id)] = {
      epoch: job.progress_epoch,
      seq: job.progress_seq,
    }
  }

  const buffered = next.buffer
  next.buffer = []
  next.phase = 'live'

  const keep: StreamEnvelope[] = []
  for (const envelope of buffered) {
    const discard = discardAgainstSnapshot(next, envelope)
    if (discard === 'resync') return resync('epoch_changed')
    if (!discard) keep.push(envelope)
  }

  keep.sort((a, b) => a.seq - b.seq || a.topic.localeCompare(b.topic))

  const effects: ReconcilerEffect[] = []
  for (const envelope of keep) {
    if (next.phase === 'awaiting_history') {
      next.held.push(envelope)
      continue
    }
    const result = applyEnvelope(next, envelope, effects)
    if (result === 'resync') return resync('epoch_changed')
    if (result === 'gap') {
      next.phase = 'awaiting_history'
      next.held.push(envelope)
    }
  }
  return [next, effects]
}

function drainHeld(state: ReconcilerState, effects: ReconcilerEffect[]): 'ok' | 'resync' | 'gap' {
  const queued = [...state.held].sort((a, b) => a.seq - b.seq)
  state.held = []
  let gap = false

  for (const envelope of queued) {
    if (gap) {
      state.held.push(envelope)
      continue
    }
    const result = applyEnvelope(state, envelope, effects)
    if (result === 'resync') return 'resync'
    if (result === 'gap') {
      gap = true
      state.phase = 'awaiting_history'
      state.held.push(envelope)
      continue
    }
  }

  if (gap) return 'gap'
  state.phase = 'live'
  return 'ok'
}

export function onHistory(
  state: ReconcilerState,
  page: HistoryPageResponse | HistoryExpiredResponse,
): [ReconcilerState, ReconcilerEffect[]] {
  if (isHistoryExpired(page)) {
    return resync('history_expired')
  }

  const next = clone(state)
  const effects: ReconcilerEffect[] = []
  const entries = [...page.entries].sort((a, b) => a.seq - b.seq)
  for (const envelope of entries) {
    const result = applyEnvelope(next, envelope, effects)
    if (result === 'resync') return resync('epoch_changed')
    if (result === 'gap') {
      next.phase = 'awaiting_history'
      next.held.push(envelope)
      return [next, effects]
    }
  }

  const drain = drainHeld(next, effects)
  if (drain === 'resync') return resync('epoch_changed')
  return [next, effects]
}

export function onControl(
  state: ReconcilerState,
  frame: InboundFrame,
): [ReconcilerState, ReconcilerEffect[]] {
  switch (frame.kind) {
    case 'subscribed':
      return onSubscribed(state, frame.frame)
    case 'entry':
      return onEntry(state, frame.envelope)
    case 'epoch_changed':
      return resync('epoch_changed')
    case 'lagging':
      if (frame.frame.topic === 'jobs.terminal') {
        return resync('lagging')
      }
      return [clone(state), []]
    case 'cursor_expired':
      return resync('cursor_expired')
    case 'rejected':
      return resync('rejected')
    default: {
      const _exhaustive: never = frame
      throw new Error(`unhandled inbound frame: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
