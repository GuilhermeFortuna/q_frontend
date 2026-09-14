import type {
  CursorExpiredFrame,
  EpochChangedFrame,
  LaggingFrame,
  RejectedFrame,
  StreamEnvelope,
  SubscribedFrame,
} from '../../../contracts/stream'

export class StreamFrameError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StreamFrameError'
  }
}

export type InboundFrame =
  | { kind: 'subscribed'; frame: SubscribedFrame }
  | { kind: 'rejected'; frame: RejectedFrame }
  | { kind: 'lagging'; frame: LaggingFrame }
  | { kind: 'cursor_expired'; frame: CursorExpiredFrame }
  | { kind: 'epoch_changed'; frame: EpochChangedFrame }
  | { kind: 'entry'; envelope: StreamEnvelope }

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new StreamFrameError('stream frame is not a JSON object')
  }
}

export function parseTextFrame(data: string): InboundFrame {
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch (cause) {
    throw new StreamFrameError('malformed stream JSON', { cause })
  }

  assertRecord(parsed)

  if (!('type' in parsed)) {
    return { kind: 'entry', envelope: parsed as unknown as StreamEnvelope }
  }

  const type = parsed.type
  if (typeof type !== 'string') {
    throw new StreamFrameError('stream control frame type is not a string')
  }

  switch (type) {
    case 'subscribed':
      return { kind: 'subscribed', frame: parsed as unknown as SubscribedFrame }
    case 'rejected':
      return { kind: 'rejected', frame: parsed as unknown as RejectedFrame }
    case 'lagging':
      return { kind: 'lagging', frame: parsed as unknown as LaggingFrame }
    case 'cursor_expired':
      return { kind: 'cursor_expired', frame: parsed as unknown as CursorExpiredFrame }
    case 'epoch_changed':
      return { kind: 'epoch_changed', frame: parsed as unknown as EpochChangedFrame }
    default:
      throw new StreamFrameError(`unknown stream control frame type: ${type}`)
  }
}
