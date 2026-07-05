import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { env } from '@/lib/env'
import { AppErrorBoundary } from '@/app/AppErrorBoundary'
import {
  addMutationErrorBreadcrumb,
  addQueryErrorBreadcrumb,
} from '@/lib/observability/queryBreadcrumbs'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => addQueryErrorBreadcrumb(error, query.queryKey),
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) =>
            addMutationErrorBreadcrumb(error, mutation.options.mutationKey),
        }),
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {children}
        {env.isDev ? (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        ) : null}
      </QueryClientProvider>
    </AppErrorBoundary>
  )
}
