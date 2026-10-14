import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type {
  ResearchStudyListResponse,
  ResearchStudyMetadata,
  ResearchStudySeriesResponse,
} from '../../../contracts/api'

export const researchStudyKeys = {
  all: ['research-studies'] as const,
  list: (symbol: string) => [...researchStudyKeys.all, 'list', symbol] as const,
  /** The revision is part of the key, so a replaced study refetches its values. */
  series: (studyId: string, revision: number, start: string, end: string) =>
    [...researchStudyKeys.all, 'series', studyId, revision, start, end] as const,
}

export async function fetchResearchStudies(symbol: string): Promise<ResearchStudyListResponse> {
  const { data } = await apiClient.get<ResearchStudyListResponse>('/api/v1/research/studies', {
    params: { symbol },
  })
  return data
}

export async function fetchResearchStudySeries(
  studyId: string,
  start: string,
  end: string,
): Promise<ResearchStudySeriesResponse> {
  const { data } = await apiClient.get<ResearchStudySeriesResponse>(
    `/api/v1/research/studies/${encodeURIComponent(studyId)}/series`,
    { params: { start, end } },
  )
  return data
}

export async function renameResearchStudy(
  studyId: string,
  name: string,
): Promise<ResearchStudyMetadata> {
  const { data } = await apiClient.patch<ResearchStudyMetadata>(
    `/api/v1/research/studies/${encodeURIComponent(studyId)}`,
    { name },
  )
  return data
}

export async function deleteResearchStudy(studyId: string): Promise<void> {
  await apiClient.delete(`/api/v1/research/studies/${encodeURIComponent(studyId)}`)
}

/**
 * The studies of one symbol. Refetched when the menu mounts and when the window regains
 * focus, so a study published from a terminal appears without a reload. Nothing is kept
 * from another symbol, so a symbol switch shows no studies until its own list arrives.
 */
export function useResearchStudyList(symbol: string) {
  return useQuery({
    queryKey: researchStudyKeys.list(symbol),
    queryFn: () => fetchResearchStudies(symbol),
    enabled: symbol.length > 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    staleTime: 0,
  })
}

/** Values of one study over the loaded bars; keyed by study id and revision. */
export function useResearchStudySeriesQueries(
  studies: ResearchStudyMetadata[],
  range: { start: string; end: string } | null,
) {
  return useQueries({
    queries: studies.map((study) => ({
      queryKey: researchStudyKeys.series(
        study.studyId,
        study.revision,
        range?.start ?? '',
        range?.end ?? '',
      ),
      queryFn: () => fetchResearchStudySeries(study.studyId, range?.start ?? '', range?.end ?? ''),
      enabled: range !== null,
      staleTime: 30_000,
    })),
  })
}

export function useRenameResearchStudy(symbol: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studyId, name }: { studyId: string; name: string }) =>
      renameResearchStudy(studyId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: researchStudyKeys.list(symbol) }),
  })
}

export function useDeleteResearchStudy(symbol: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (studyId: string) => deleteResearchStudy(studyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: researchStudyKeys.list(symbol) }),
  })
}
