import { describe, expect, it } from 'vitest'

import type { JobSnapshotResponse } from '../../../../contracts/api'
import type {
  HistoryExpiredResponse,
  HistoryPageResponse,
  JobProgressPayload,
  JobTerminalPayload,
  StreamEnvelope,
  SubscribedFrame,
} from '../../../../contracts/stream'
import type { InboundFrame } from '@/lib/stream/framing'
import {
  initialState,
  onControl,
  onEntry,
  onHistory,
  onSnapshot,
  onSubscribed,
} from '@/lib/stream/reconciler'

const TERMINAL_EPOCH = 'term-epoch'
const PROGRESS_EPOCH = 'prog-epoch'

function subscribedFrame(): SubscribedFrame {
  return {
    type: 'subscribed',
    topics: {
      'jobs.terminal': { cursor: '0-0', epoch: TERMINAL_EPOCH, last_seq: 5 },
      'jobs.progress': { cursor: '0-0', epoch: PROGRESS_EPOCH, last_seq: 10 },
    },
  }
}

function envelope(
  topic: 'jobs.terminal' | 'jobs.progress',
  seq: number,
  payload: JobProgressPayload | JobTerminalPayload,
  epoch = topic === 'jobs.terminal' ? TERMINAL_EPOCH : PROGRESS_EPOCH,
): StreamEnvelope {
  return {
    topic,
    schema_major: 1,
    seq,
    epoch,
    producer_id: 'test',
    origin_ts: '2026-09-12T10:00:00.000000Z',
    payload_kind: 'control',
    payload_schema:
      topic === 'jobs.terminal'
        ? 'schema/stream/payloads/job-terminal.schema.json'
        : 'schema/stream/payloads/job-progress.schema.json',
    payload: payload as unknown as Record<string, unknown>,
    key: { kind: payload.kind, job_id: payload.job_id },
  }
}

function terminalPayload(jobId: string, seqHint?: number): JobTerminalPayload {
  return {
    kind: 'backtest',
    job_id: jobId,
    status: 'completed',
    finished_at: `2026-09-12T10:00:0${seqHint ?? 0}.000000Z`,
  }
}

function progressPayload(jobId: string, progress = 0.5): JobProgressPayload {
  return {
    kind: 'backtest',
    job_id: jobId,
    status: 'running',
    progress,
  }
}

function snapshot(overrides?: Partial<JobSnapshotResponse>): JobSnapshotResponse {
  return {
    jobs: [
      {
        job_id: 'A',
        kind: 'backtest',
        status: 'running',
        progress_seq: 10,
        progress_epoch: PROGRESS_EPOCH,
      },
    ],
    watermark: {
      'jobs.terminal': { epoch: TERMINAL_EPOCH, seq: 5 },
    },
    ...overrides,
  }
}

describe('reconciler', () => {
  it('requests a snapshot after subscribe', () => {
    const [, effects] = onSubscribed(initialState(), subscribedFrame())
    expect(effects).toEqual([{ type: 'fetchSnapshot' }])
  })

  it('discards buffered entries at or below the snapshot watermarks', () => {
    let state = initialState()
    ;[state] = onSubscribed(state, subscribedFrame())
    for (const seq of [4, 5, 6]) {
      ;[state] = onEntry(state, envelope('jobs.terminal', seq, terminalPayload('A', seq)))
    }
    ;[state] = onEntry(state, envelope('jobs.progress', 10, progressPayload('A')))

    const [, effects] = onSnapshot(state, snapshot())
    expect(effects).toEqual([
      {
        type: 'jobTerminal',
        key: 'backtest:A',
        payload: terminalPayload('A', 6),
      },
    ])
  })

  it('fills a terminal sequence gap from history before applying later events', () => {
    let state = initialState()
    ;[state] = onSubscribed(state, subscribedFrame())
    ;[state] = onSnapshot(
      state,
      snapshot({
        jobs: [],
        watermark: { 'jobs.terminal': { epoch: TERMINAL_EPOCH, seq: 6 } },
      }),
    )

    let effects
    ;[state, effects] = onEntry(state, envelope('jobs.terminal', 7, terminalPayload('A', 7)))
    expect(effects).toEqual([
      { type: 'jobTerminal', key: 'backtest:A', payload: terminalPayload('A', 7) },
    ])
    ;[state, effects] = onEntry(state, envelope('jobs.terminal', 9, terminalPayload('A', 9)))
    expect(effects).toEqual([
      { type: 'fetchHistory', topic: 'jobs.terminal', epoch: TERMINAL_EPOCH, fromSeq: 8 },
    ])
    expect(effects.some((e) => e.type === 'jobTerminal')).toBe(false)

    const page: HistoryPageResponse = {
      topic: 'jobs.terminal',
      epoch: TERMINAL_EPOCH,
      next_seq: null,
      entries: [envelope('jobs.terminal', 8, terminalPayload('A', 8))],
    }
    ;[, effects] = onHistory(state, page)
    expect(effects).toEqual([
      { type: 'jobTerminal', key: 'backtest:A', payload: terminalPayload('A', 8) },
      { type: 'jobTerminal', key: 'backtest:A', payload: terminalPayload('A', 9) },
    ])
  })

  it('resyncs when history has expired', () => {
    let state = initialState()
    ;[state] = onSubscribed(state, subscribedFrame())
    ;[state] = onSnapshot(
      state,
      snapshot({
        jobs: [],
        watermark: { 'jobs.terminal': { epoch: TERMINAL_EPOCH, seq: 6 } },
      }),
    )
    ;[state] = onEntry(state, envelope('jobs.terminal', 7, terminalPayload('A', 7)))
    ;[state] = onEntry(state, envelope('jobs.terminal', 9, terminalPayload('A', 9)))

    const expired: HistoryExpiredResponse = {
      topic: 'jobs.terminal',
      requested_from_seq: 8,
    }
    const [, effects] = onHistory(state, expired)
    expect(effects).toEqual([{ type: 'resync', reason: 'history_expired' }])
  })

  it('resyncs on epoch_changed, terminal lagging, cursor_expired, and stream_unavailable', () => {
    const cases: Array<
      [InboundFrame, 'epoch_changed' | 'lagging' | 'cursor_expired' | 'rejected']
    > = [
      [
        {
          kind: 'epoch_changed',
          frame: { type: 'epoch_changed', topic: 'jobs.terminal', new_epoch: 'e2' },
        },
        'epoch_changed',
      ],
      [
        {
          kind: 'lagging',
          frame: { type: 'lagging', topic: 'jobs.terminal', from_seq: 3 },
        },
        'lagging',
      ],
      [
        {
          kind: 'cursor_expired',
          frame: { type: 'cursor_expired', topic: 'jobs.terminal' },
        },
        'cursor_expired',
      ],
      [
        {
          kind: 'rejected',
          frame: { type: 'rejected', reason: 'stream_unavailable' },
        },
        'rejected',
      ],
    ]

    for (const [frame, reason] of cases) {
      const [, effects] = onControl(initialState(), frame)
      expect(effects, reason).toEqual([{ type: 'resync', reason }])
    }
  })

  it('ignores a duplicate terminal sequence', () => {
    let state = initialState()
    ;[state] = onSubscribed(state, subscribedFrame())
    ;[state] = onSnapshot(state, snapshot({ jobs: [] }))
    ;[state] = onEntry(state, envelope('jobs.terminal', 6, terminalPayload('A', 6)))

    const [, effects] = onEntry(state, envelope('jobs.terminal', 6, terminalPayload('A', 6)))
    expect(effects).toEqual([])
  })

  it('does not fetch history for a progress gap', () => {
    let state = initialState()
    ;[state] = onSubscribed(state, subscribedFrame())
    ;[state] = onSnapshot(state, snapshot({ jobs: [] }))

    let effects
    ;[state, effects] = onEntry(state, envelope('jobs.progress', 1, progressPayload('A', 0.1)))
    expect(effects).toEqual([
      { type: 'jobProgress', key: 'backtest:A', payload: progressPayload('A', 0.1) },
    ])
    ;[, effects] = onEntry(state, envelope('jobs.progress', 5, progressPayload('A', 0.5)))
    expect(effects).toEqual([
      { type: 'jobProgress', key: 'backtest:A', payload: progressPayload('A', 0.5) },
    ])
    expect(effects.some((e) => e.type === 'fetchHistory')).toBe(false)
  })
})
