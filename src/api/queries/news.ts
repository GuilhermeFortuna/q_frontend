import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type { NewsArticle } from '@/types/api'

export const newsKeys = {
  all: ['news'] as const,
  list: () => [...newsKeys.all, 'list'] as const,
  detail: (id: string) => [...newsKeys.all, 'detail', id] as const,
}

async function fetchNewsList(): Promise<NewsArticle[]> {
  const { data } = await apiClient.get<NewsArticle[]>('/api/v1/news')
  return data
}

async function fetchNewsDetail(id: string): Promise<NewsArticle> {
  const { data } = await apiClient.get<NewsArticle>(`/api/v1/news/${id}`)
  return data
}

export function useNewsList() {
  return useQuery({
    queryKey: newsKeys.list(),
    queryFn: fetchNewsList,
    staleTime: 10_000,
    refetchInterval: 30_000, // poll news every 30 seconds
  })
}

export function useNewsDetail(id: string) {
  return useQuery({
    queryKey: newsKeys.detail(id),
    queryFn: () => fetchNewsDetail(id),
    enabled: id.length > 0,
    staleTime: 60_000,
  })
}
