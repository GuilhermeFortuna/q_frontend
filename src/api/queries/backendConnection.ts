/* eslint-disable react-hooks/rules-of-hooks -- env.enableMsw is a build-time constant; mock mode short-circuits without registering a query */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { apiClient } from '@/api/client'
import {
  type BackendConnection,
  classifyHealth,
  retryDelayMs,
} from '@/lib/backend/connectionStatus'
import { env } from '@/lib/env'
import type { SystemHealthResponse } from '../../../contracts/api'

export const backendConnectionKeys = {
  all: ['system'] as const,
  status: () => [...backendConnectionKeys.all, 'backend-connection'] as const,
}

async function fetchSystemHealth(): Promise<SystemHealthResponse> {
  const { data } = await apiClient.get<SystemHealthResponse>('/api/v1/system/health')
  return data
}

export function useBackendConnection(): BackendConnection {
  if (env.enableMsw) {
    return { state: 'mocked' }
  }

  const queryClient = useQueryClient()
  const wasOfflineRef = useRef(false)
  const offlineSinceRef = useRef<number | null>(null)

  const query = useQuery({
    queryKey: backendConnectionKeys.status(),
    queryFn: fetchSystemHealth,
    retry: false,
    refetchIntervalInBackground: true,
    refetchInterval: (q) => {
      if (q.state.status === 'error') {
        const attempt = Math.max(0, q.state.errorUpdateCount - 1)
        return retryDelayMs(attempt)
      }
      if (q.state.status === 'success') {
        return 60_000
      }
      return false
    },
  })

  useEffect(() => {
    if (query.isError) {
      wasOfflineRef.current = true
    } else if (query.isSuccess && wasOfflineRef.current) {
      wasOfflineRef.current = false
      void queryClient.invalidateQueries({
        predicate: (q) =>
          !(
            q.queryKey[0] === backendConnectionKeys.status()[0] &&
            q.queryKey[1] === backendConnectionKeys.status()[1]
          ),
      })
    }
  }, [query.isError, query.isSuccess, queryClient])

  if (query.isSuccess && query.data) {
    offlineSinceRef.current = null
    return classifyHealth(query.data)
  }

  const internalQuery = queryClient.getQueryCache().find({
    queryKey: backendConnectionKeys.status(),
  })
  const errorUpdateCount = internalQuery?.state.errorUpdateCount ?? (query.isError ? 1 : 0)
  const errorUpdatedAt = internalQuery?.state.errorUpdatedAt ?? query.errorUpdatedAt

  if (offlineSinceRef.current === null) {
    offlineSinceRef.current = errorUpdatedAt || Date.now()
  }

  const attempt = Math.max(0, errorUpdateCount - 1)
  const nextRetryMs = retryDelayMs(attempt)

  return {
    state: 'offline',
    apiBaseUrl: env.apiBaseUrl,
    nextRetryMs,
    since: offlineSinceRef.current,
  }
}
