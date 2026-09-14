import { createContext, useContext, useEffect, useState } from 'react'

import type { JobStreamClient, StreamStatus } from '@/lib/stream/client'

export const JobStreamContext = createContext<JobStreamClient | null>(null)

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
