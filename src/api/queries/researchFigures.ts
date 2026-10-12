import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type { BulkDeleteResponse } from '../../../contracts/api'
import { env } from '@/lib/env'
import type {
  ResearchFigureBulkDelete,
  ResearchFigureListPage,
  ResearchFigure,
  ResearchFigurePlotly,
} from '@/types/researchFigures'

export const RESEARCH_FIGURE_PAGE_SIZE = 100
export const RESEARCH_FIGURE_POLL_INTERVAL_MS = 2_000

export const researchFigureKeys = {
  all: ['research-figures'] as const,
  lists: () => [...researchFigureKeys.all, 'list'] as const,
  list: (collection: string | null) => [...researchFigureKeys.lists(), { collection }] as const,
  metadata: (figureId: string) => [...researchFigureKeys.all, 'metadata', figureId] as const,
  plotly: (figureId: string, revision: number) =>
    [...researchFigureKeys.all, 'plotly', figureId, revision] as const,
}

/**
 * Content URL for an image figure. The revision is part of the URL so a replaced
 * figure gets a new address and the browser never shows the previous image. The
 * backend ignores the parameter and sends the revision back as its ETag.
 */
export function researchFigureContentUrl(figureId: string, revision: number): string {
  return `${env.apiBaseUrl}/api/v1/research/figures/${encodeURIComponent(figureId)}/content?rev=${revision}`
}

/**
 * Poll while the document is visible. TanStack pauses interval refetches in
 * background tabs already; returning `false` here keeps the rule explicit.
 */
export function researchFigurePollInterval(): number | false {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false
  return RESEARCH_FIGURE_POLL_INTERVAL_MS
}

export async function fetchResearchFigures({
  collection,
  offset = 0,
  limit = RESEARCH_FIGURE_PAGE_SIZE,
}: {
  collection?: string | null
  offset?: number
  limit?: number
}): Promise<ResearchFigureListPage> {
  const params: Record<string, string | number> = { offset, limit }
  if (collection) params.collection = collection
  const { data } = await apiClient.get<ResearchFigureListPage>('/api/v1/research/figures', {
    params,
  })
  return data
}

export async function fetchResearchFigure(figureId: string): Promise<ResearchFigure> {
  const { data } = await apiClient.get<ResearchFigure>(
    `/api/v1/research/figures/${encodeURIComponent(figureId)}`,
  )
  return data
}

export async function fetchResearchFigurePlotly(
  figureId: string,
  revision: number,
): Promise<ResearchFigurePlotly> {
  const { data } = await apiClient.get<ResearchFigurePlotly>(
    `/api/v1/research/figures/${encodeURIComponent(figureId)}/content`,
    { params: { rev: revision } },
  )
  return data
}

export async function deleteResearchFigure(figureId: string): Promise<void> {
  await apiClient.delete(`/api/v1/research/figures/${encodeURIComponent(figureId)}`)
}

export async function bulkDeleteResearchFigures(
  request: ResearchFigureBulkDelete,
): Promise<BulkDeleteResponse> {
  const { data } = await apiClient.post<BulkDeleteResponse>(
    '/api/v1/research/figures/bulk-delete',
    request,
  )
  return data
}

/** Offset of the next page, or `undefined` once every figure in the page's total is loaded. */
export function nextResearchFigurePageOffset(page: ResearchFigureListPage): number | undefined {
  const loaded = page.offset + page.items.length
  return loaded < page.total ? loaded : undefined
}

export function useResearchFigureList({ collection }: { collection: string | null }) {
  return useInfiniteQuery({
    queryKey: researchFigureKeys.list(collection),
    queryFn: ({ pageParam }) => fetchResearchFigures({ collection, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: nextResearchFigurePageOffset,
    refetchInterval: researchFigurePollInterval,
    refetchIntervalInBackground: false,
  })
}

export function useResearchFigure(figureId: string | null) {
  return useQuery({
    queryKey: researchFigureKeys.metadata(figureId ?? ''),
    queryFn: () => fetchResearchFigure(figureId as string),
    enabled: !!figureId,
    retry: false,
  })
}

export function useResearchFigurePlotly(
  figure: { figureId: string; revision: number } | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: researchFigureKeys.plotly(figure?.figureId ?? '', figure?.revision ?? 0),
    queryFn: () => fetchResearchFigurePlotly(figure?.figureId ?? '', figure?.revision ?? 0),
    enabled: enabled && !!figure,
    staleTime: Infinity,
    retry: false,
  })
}

export function useDeleteResearchFigure() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (figureId: string) => deleteResearchFigure(figureId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: researchFigureKeys.all })
    },
  })
}

export function useBulkDeleteResearchFigures() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ResearchFigureBulkDelete) => bulkDeleteResearchFigures(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: researchFigureKeys.all })
    },
  })
}
