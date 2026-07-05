import * as Sentry from '@sentry/react'
import type { QueryKey } from '@tanstack/react-query'
import axios from 'axios'

function httpStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}

export function addQueryErrorBreadcrumb(error: unknown, queryKey: QueryKey) {
  Sentry.addBreadcrumb({
    category: 'react-query',
    level: 'error',
    message: 'Query failed',
    data: { queryKey, status: httpStatus(error) },
  })
}

export function addMutationErrorBreadcrumb(error: unknown, mutationKey?: unknown) {
  Sentry.addBreadcrumb({
    category: 'react-query',
    level: 'error',
    message: 'Mutation failed',
    data: { mutationKey, status: httpStatus(error) },
  })
}
