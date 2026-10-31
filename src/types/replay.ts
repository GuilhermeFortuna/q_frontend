import type { ReplayRunState } from '../../contracts/api'

/** Lifecycle of the replay stack as the Research API reports it (api/replay/overview). */
export type ReplayPhase = 'idle' | 'starting' | 'ready' | 'stopping' | 'failed'

export type ReplayRunLatency = {
  market_data_ms: number
  order_transport_ms: number
  broker_accept_ms: number
  broker_execution_ms: number
  broker_response_ms: number
}

/** Run state plus the latency the run was created with. */
export type ReplayRun = ReplayRunState & {
  fixed_latency?: ReplayRunLatency | null
}

export type ReplayOverview = {
  phase: ReplayPhase
  run: ReplayRun | null
  terminal_running: boolean
  last_error: string | null
}

export type ReplayCommandAction = 'pause' | 'resume' | 'speed' | 'step' | 'stop'

export type ReplayCommandResult = {
  command_id: string
  accepted: boolean
  reason: string | null
  revision: number
  state: ReplayRunState['state']
}

export type ReplayJournalRow = {
  seq: number
  kind: string
  market_time_utc: string
  payload_hash: string
  payload: Record<string, unknown>
}

export type ReplayJournalPageView = {
  entries: ReplayJournalRow[]
  next_after_seq: number | null
}
