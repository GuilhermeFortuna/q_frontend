import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const addBreadcrumb = vi.hoisted(() => vi.fn())
vi.mock('@sentry/react', () => ({ addBreadcrumb }))

import { addQueryErrorBreadcrumb } from '@/lib/observability/queryBreadcrumbs'

describe('React Query Sentry breadcrumbs', () => {
  beforeEach(() => addBreadcrumb.mockClear())

  it('records only the query key and HTTP status', () => {
    const error = new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { prompt: 'must never leave this process' },
    })

    addQueryErrorBreadcrumb(error, ['strategy-builder', 'models'])

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'react-query',
      level: 'error',
      message: 'Query failed',
      data: { queryKey: ['strategy-builder', 'models'], status: 500 },
    })
    expect(JSON.stringify(addBreadcrumb.mock.calls)).not.toContain('must never leave')
  })
})
