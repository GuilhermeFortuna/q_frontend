import { describe, expect, it } from 'vitest'

import { parseTextFrame, StreamFrameError } from '@/lib/stream/framing'

describe('parseTextFrame', () => {
  it('parses a subscribed control frame by type', () => {
    const raw = JSON.stringify({
      type: 'subscribed',
      topics: {
        'jobs.terminal': { cursor: '0-0', epoch: 'e1', last_seq: 5 },
      },
    })

    expect(parseTextFrame(raw)).toEqual({
      kind: 'subscribed',
      frame: {
        type: 'subscribed',
        topics: {
          'jobs.terminal': { cursor: '0-0', epoch: 'e1', last_seq: 5 },
        },
      },
    })
  })

  it('parses a jobs.terminal envelope without type as an entry', () => {
    const envelope = {
      topic: 'jobs.terminal',
      schema_major: 1,
      seq: 205,
      epoch: 'outbox-epoch-42',
      producer_id: 'execution-service-prod',
      origin_ts: '2026-09-12T10:00:01.500000Z',
      payload_kind: 'control',
      payload_schema: 'schema/stream/payloads/job-terminal.schema.json',
      payload: {
        kind: 'backtest',
        job_id: 'job-backtest-20260912-002',
        status: 'completed',
        finished_at: '2026-09-12T10:00:01.500000Z',
      },
    }

    expect(parseTextFrame(JSON.stringify(envelope))).toEqual({
      kind: 'entry',
      envelope,
    })
  })

  it('throws StreamFrameError for an unknown type', () => {
    expect(() => parseTextFrame(JSON.stringify({ type: 'unknown' }))).toThrow(StreamFrameError)
  })

  it('throws StreamFrameError for malformed JSON', () => {
    expect(() => parseTextFrame('{not json')).toThrow(StreamFrameError)
  })
})
