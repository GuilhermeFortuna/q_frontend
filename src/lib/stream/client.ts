import type { JobSnapshotResponse } from '../../../contracts/api'
import type { HistoryExpiredResponse, HistoryPageResponse } from '../../../contracts/stream'
import { parseTextFrame, StreamFrameError } from '@/lib/stream/framing'
import {
  initialState,
  onControl,
  onHistory,
  onSnapshot,
  type JobProgressEffect,
  type JobTerminalEffect,
  type ReconcilerEffect,
  type ReconcilerState,
} from '@/lib/stream/reconciler'

export type StreamStatus = 'disabled' | 'connecting' | 'live' | 'unavailable'

export interface StreamClientDeps {
  socketFactory: (url: string) => WebSocket
  fetchSnapshot: () => Promise<JobSnapshotResponse>
  fetchHistory: (
    topic: string,
    epoch: string,
    fromSeq: number,
  ) => Promise<HistoryPageResponse | HistoryExpiredResponse>
  now: () => number
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (h: unknown) => void
}

export const MAX_BACKOFF_MS = 30_000
const JOB_TOPICS = ['jobs.progress', 'jobs.terminal'] as const

export function backoffDelay(attempt: number): number {
  const cap = Math.min(MAX_BACKOFF_MS, 500 * 2 ** attempt)
  return Math.random() * cap
}

export class JobStreamClient {
  private readonly url: string
  private readonly deps: StreamClientDeps
  private readonly disabled: boolean
  private refs = 0
  private attempt = 0
  private socket: WebSocket | null = null
  private reconnectTimer: unknown = null
  private intentionalClose = false
  private chain: Promise<void> = Promise.resolve()
  private state: ReconcilerState = initialState()
  private currentStatus: StreamStatus
  private readonly statusListeners = new Set<(status: StreamStatus) => void>()
  private readonly jobListeners = new Set<(event: JobProgressEffect | JobTerminalEffect) => void>()

  constructor(url: string, deps: StreamClientDeps) {
    this.url = url
    this.deps = deps
    this.disabled = url.length === 0
    this.currentStatus = this.disabled ? 'disabled' : 'unavailable'
  }

  retain(): () => void {
    if (this.disabled) return () => {}
    this.refs += 1
    if (this.refs === 1) this.open()
    let released = false
    return () => {
      if (released) return
      released = true
      this.refs -= 1
      if (this.refs === 0) this.shutdown()
    }
  }

  status(): StreamStatus {
    return this.currentStatus
  }

  onStatus(fn: (status: StreamStatus) => void): () => void {
    this.statusListeners.add(fn)
    return () => {
      this.statusListeners.delete(fn)
    }
  }

  onJobEvent(fn: (event: JobProgressEffect | JobTerminalEffect) => void): () => void {
    this.jobListeners.add(fn)
    return () => {
      this.jobListeners.delete(fn)
    }
  }

  private setStatus(status: StreamStatus) {
    if (this.currentStatus === status) return
    this.currentStatus = status
    for (const listener of this.statusListeners) listener(status)
  }

  private enqueue(work: () => Promise<void>) {
    this.chain = this.chain.then(work).catch((error: unknown) => {
      console.error('job stream client error', error)
    })
  }

  private open() {
    this.clearReconnect()
    this.intentionalClose = false
    this.state = initialState()
    this.setStatus('connecting')
    const socket = this.deps.socketFactory(this.url)
    this.socket = socket
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return
      this.sendSubscribe()
    })
    socket.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (this.socket !== socket) return
      this.enqueue(() => this.handleMessage(event.data))
    })
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return
      this.handleClose()
    })
    socket.addEventListener('error', () => {
      /* close handler drives reconnect */
    })
  }

  private sendSubscribe() {
    this.socket?.send(JSON.stringify({ topics: [...JOB_TOPICS] }))
  }

  private async handleMessage(data: unknown) {
    if (typeof data !== 'string') {
      console.warn('ignored unexpected binary stream frame')
      return
    }
    let inbound
    try {
      inbound = parseTextFrame(data)
    } catch (error) {
      if (error instanceof StreamFrameError) {
        console.warn(error.message)
        return
      }
      throw error
    }
    const [next, effects] = onControl(this.state, inbound)
    this.state = next
    await this.dispatch(effects)
  }

  private async dispatch(effects: ReconcilerEffect[]) {
    for (const effect of effects) {
      switch (effect.type) {
        case 'fetchSnapshot':
          await this.runSnapshot()
          break
        case 'fetchHistory':
          await this.runHistory(effect.topic, effect.epoch, effect.fromSeq)
          break
        case 'jobProgress':
        case 'jobTerminal':
          for (const listener of this.jobListeners) listener(effect)
          break
        case 'resync':
          this.handleResync()
          break
        default: {
          const _exhaustive: never = effect
          throw new Error(`unhandled reconciler effect: ${JSON.stringify(_exhaustive)}`)
        }
      }
    }
  }

  private async runSnapshot() {
    const snap = await this.deps.fetchSnapshot()
    if (this.refs === 0) return
    const [next, effects] = onSnapshot(this.state, snap)
    this.state = next
    const resyncs = effects.filter((effect) => effect.type === 'resync')
    if (resyncs.length === 0) {
      this.setStatus('live')
      this.attempt = 0
    }
    await this.dispatch(effects)
  }

  private async runHistory(topic: string, epoch: string, fromSeq: number) {
    const page = await this.deps.fetchHistory(topic, epoch, fromSeq)
    if (this.refs === 0) return
    const [next, effects] = onHistory(this.state, page)
    this.state = next
    await this.dispatch(effects)
  }

  private handleResync() {
    this.state = initialState()
    this.setStatus('connecting')
    this.sendSubscribe()
  }

  private handleClose() {
    this.socket = null
    if (this.intentionalClose) return
    this.setStatus('unavailable')
    this.scheduleReconnect()
  }

  private scheduleReconnect() {
    if (this.refs <= 0) return
    this.clearReconnect()
    const delay = backoffDelay(this.attempt)
    this.attempt += 1
    this.reconnectTimer = this.deps.setTimer(() => {
      this.reconnectTimer = null
      if (this.refs > 0) this.open()
    }, delay)
  }

  private clearReconnect() {
    if (this.reconnectTimer == null) return
    this.deps.clearTimer(this.reconnectTimer)
    this.reconnectTimer = null
  }

  private shutdown() {
    this.intentionalClose = true
    this.clearReconnect()
    this.socket?.close()
    this.socket = null
    this.state = initialState()
    this.setStatus(this.disabled ? 'disabled' : 'unavailable')
  }
}
