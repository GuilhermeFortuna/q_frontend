import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'

import { apiClient } from '@/api/client'
import type {
  ReplayDataset,
  ReplayDatasetRequest,
  ReplayStartRequest,
} from '../../../contracts/api'
import type {
  ReplayCommandAction,
  ReplayCommandResult,
  ReplayJournalPageView,
  ReplayJournalRow,
  ReplayOverview,
} from '@/types/replay'

export const REPLAY_JOURNAL_PAGE = 200

export const replayKeys = {
  all: ['replay'] as const,
  overview: () => [...replayKeys.all, 'overview'] as const,
  datasets: () => [...replayKeys.all, 'datasets'] as const,
}

/** True when the Research API does not serve replay routes (live API, or container mode). */
export function isReplayUnavailable(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404
}

/** Human-readable reason for a failed replay request, from the API's `message` when present. */
export function replayErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) return 'The Research API did not answer. Check that it is running.'
    const data = error.response.data as { message?: unknown; detail?: unknown } | undefined
    if (typeof data?.message === 'string' && data.message.length > 0) return data.message
    if (typeof data?.detail === 'string' && data.detail.length > 0) return data.detail
    return `The request failed with HTTP ${error.response.status}.`
  }
  return error instanceof Error ? error.message : 'Unexpected replay error.'
}

async function fetchOverview(): Promise<ReplayOverview> {
  const { data } = await apiClient.get<ReplayOverview>('/api/v1/replay/overview')
  return data
}

async function fetchDatasets(): Promise<ReplayDataset[]> {
  const { data } = await apiClient.get<ReplayDataset[]>('/api/v1/replay/datasets')
  return data
}

async function fetchJournalPage(afterSeq: number, limit: number): Promise<ReplayJournalPageView> {
  const { data } = await apiClient.get<ReplayJournalPageView>(
    '/api/v1/replay/runs/current/journal',
    {
      params: { after_seq: afterSeq, limit },
    },
  )
  return data
}

/** Poll faster while a stack exists, so the page reflects CLI changes within one interval. */
export function replayOverviewPollMs(phase: ReplayOverview['phase'] | undefined): number {
  return phase === undefined || phase === 'idle' ? 5000 : 1000
}

export function useReplayOverview() {
  return useQuery({
    queryKey: replayKeys.overview(),
    queryFn: fetchOverview,
    retry: (failureCount, error) => !isReplayUnavailable(error) && failureCount < 2,
    refetchInterval: (query) => replayOverviewPollMs(query.state.data?.phase),
  })
}

/** Pause between dataset status checks while a TickStore range is being frozen. */
const FREEZE_POLL_MS = 1000
/** Longest wait for a freeze before the page reports that it did not finish. */
const FREEZE_TIMEOUT_MS = 10 * 60 * 1000

/**
 * Makes sure the dataset exists and is ready. A dataset that already exists (409) is reused; a
 * freeze in progress is waited for; a failed freeze throws its reason.
 */
async function ensureReadyDataset(body: ReplayDatasetRequest, datasetId: string): Promise<void> {
  try {
    await apiClient.post<ReplayDataset>('/api/v1/replay/datasets', body)
  } catch (error) {
    if (!(isAxiosError(error) && error.response?.status === 409)) throw error
  }
  const deadline = Date.now() + FREEZE_TIMEOUT_MS
  for (;;) {
    const dataset = (await fetchDatasets()).find((item) => item.dataset_id === datasetId)
    if (dataset?.state === 'ready') return
    if (dataset?.state === 'failed') {
      throw new Error(
        `The TickStore range could not be frozen: ${dataset.error ?? 'unknown reason'}`,
      )
    }
    if (Date.now() > deadline) throw new Error('Freezing the TickStore range took too long.')
    await new Promise((resolve) => window.setTimeout(resolve, FREEZE_POLL_MS))
  }
}

export type ReplayStartPhase = 'freezing' | 'starting'

/**
 * Starts a replay from the simple form: freezes the TickStore range when needed, then starts the
 * paused run on it. onPhase reports progress for the page.
 */
export function useStartReplay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      freeze: ReplayDatasetRequest
      datasetId: string
      run: Omit<ReplayStartRequest, 'dataset_id'>
      onPhase?: (phase: ReplayStartPhase) => void
    }) => {
      input.onPhase?.('freezing')
      await ensureReadyDataset(input.freeze, input.datasetId)
      input.onPhase?.('starting')
      const { data } = await apiClient.post<ReplayOverview>('/api/v1/replay/runs', {
        ...input.run,
        dataset_id: input.datasetId,
      })
      return data
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: replayKeys.overview() })
      void queryClient.invalidateQueries({ queryKey: replayKeys.datasets() })
    },
  })
}

export type ReplayCommandInput = {
  action: ReplayCommandAction
  /** Revision of the run the operator is looking at; the simulator refuses a stale one. */
  expectedRevision: number
  rate?: number
  marketMs?: number
}

/**
 * Forwards one command. Each call sends a fresh command_id, so a repeated click is a new command
 * and a retried request with the same id returns the recorded result on the server.
 */
export function useReplayCommand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ReplayCommandInput): Promise<ReplayCommandResult> => {
      const body: Record<string, unknown> = {
        command_id: globalThis.crypto.randomUUID(),
        expected_revision: input.expectedRevision,
        action: input.action,
      }
      if (input.action === 'speed') body.rate = input.rate
      if (input.action === 'step') body.market_ms = input.marketMs
      const { data } = await apiClient.post<ReplayCommandResult>(
        '/api/v1/replay/runs/current/commands',
        body,
      )
      return data
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: replayKeys.overview() })
    },
  })
}

export function useStopReplayStack() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ReplayOverview>('/api/v1/replay/stack/stop')
      return data
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: replayKeys.overview() })
    },
  })
}

export function useOpenReplayTerminal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ReplayOverview>('/api/v1/replay/stack/terminal')
      return data
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: replayKeys.overview() })
    },
  })
}

/**
 * Journal of the current run, accumulated page by page in ascending seq order. It restarts when the
 * run generation changes and stops polling when there is no run.
 */
export function useReplayJournal(generation: string | null, pollMs: number) {
  const [rows, setRows] = useState<ReplayJournalRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRows([])
    setError(null)
  }, [generation])

  useEffect(() => {
    if (generation === null) return undefined
    let cancelled = false
    let inFlight = false
    let cursor = -1

    const poll = async () => {
      if (inFlight) return
      inFlight = true
      try {
        for (;;) {
          const page = await fetchJournalPage(cursor, REPLAY_JOURNAL_PAGE)
          if (cancelled) return
          if (page.entries.length > 0) {
            cursor = page.entries[page.entries.length - 1].seq
            setRows((previous) => [...previous, ...page.entries])
          }
          if (page.entries.length < REPLAY_JOURNAL_PAGE) break
        }
        setError(null)
      } catch (cause) {
        if (!cancelled) setError(replayErrorMessage(cause))
      } finally {
        inFlight = false
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), pollMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [generation, pollMs])

  return { rows, error }
}
