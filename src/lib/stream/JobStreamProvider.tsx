/* eslint-disable react-refresh/only-export-components -- hooks share the provider module */
import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import { apiClient } from '@/api/client'
import type { JobSnapshotResponse } from '../../../contracts/api'
import type { HistoryExpiredResponse, HistoryPageResponse } from '../../../contracts/stream'
import { env } from '@/lib/env'
import { JobStreamClient, type StreamClientDeps, type StreamStatus } from '@/lib/stream/client'
import { connectJobStreamToQueryClient } from '@/lib/stream/jobQueryBridge'

const JobStreamContext = createContext<JobStreamClient | null>(null)

function streamUrl(): string {
  return `${env.apiBaseUrl.replace(/^http/i, 'ws')}/api/v1/stream`
}

function productionDeps(): StreamClientDeps {
  return {
    socketFactory: (url) => new WebSocket(url),
    fetchSnapshot: async () => {
      const { data } = await apiClient.get<JobSnapshotResponse>('/api/v1/stream/jobs/snapshot')
      return data
    },
    fetchHistory: async (topic, epoch, fromSeq) => {
      try {
        const { data } = await apiClient.get<HistoryPageResponse>(
          `/api/v1/stream/${encodeURIComponent(topic)}/history`,
          { params: { epoch, from_seq: fromSeq } },
        )
        return data
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 410) {
          return error.response.data as HistoryExpiredResponse
        }
        throw error
      }
    },
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>)
    },
  }
}

function createDefaultClient(): JobStreamClient {
  if (!env.enableStream) {
    return new JobStreamClient('', productionDeps())
  }
  return new JobStreamClient(streamUrl(), productionDeps())
}

export function JobStreamProvider({
  children,
  client: injected,
}: {
  children: ReactNode
  client?: JobStreamClient
}) {
  const queryClient = useQueryClient()
  const clientRef = useRef<JobStreamClient | null>(null)
  if (clientRef.current === null) {
    clientRef.current = injected ?? createDefaultClient()
  }
  const client = clientRef.current

  useEffect(() => connectJobStreamToQueryClient(client, queryClient), [client, queryClient])

  return <JobStreamContext.Provider value={client}>{children}</JobStreamContext.Provider>
}

export function useJobStream(): JobStreamClient {
  const client = useContext(JobStreamContext)
  if (!client) {
    throw new Error('useJobStream must be used within JobStreamProvider')
  }
  useEffect(() => client.retain(), [client])
  return client
}

export function useStreamStatus(): StreamStatus {
  const client = useContext(JobStreamContext)
  if (!client) {
    throw new Error('useStreamStatus must be used within JobStreamProvider')
  }
  const [status, setStatus] = useState(() => client.status())
  useEffect(() => {
    setStatus(client.status())
    return client.onStatus(setStatus)
  }, [client])
  return status
}
