import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type {
  EvalRunRequest,
  FeatureEvalRun,
  FeatureEvalStartResponse,
  FeatureLeaderboardResponse,
  FeatureListResponse,
  FeaturePassport,
  FeatureStatus,
  FeatureStatusUpdateRequest,
} from '@/types/features'

export type FeatureListParams = {
  category?: string
  status?: string
}

export const featureKeys = {
  all: ['features'] as const,
  list: (params: FeatureListParams = {}) => [...featureKeys.all, 'list', params] as const,
  passport: (name: string) => [...featureKeys.all, 'passport', name] as const,
  leaderboard: () => [...featureKeys.all, 'leaderboard'] as const,
  evalRun: (runId: string) => [...featureKeys.all, 'evalRun', runId] as const,
}

export async function fetchFeatureList(
  params: FeatureListParams = {},
): Promise<FeatureListResponse> {
  const { data } = await apiClient.get<FeatureListResponse>('/api/v1/features', { params })
  return data
}

export async function fetchFeaturePassport(name: string): Promise<FeaturePassport> {
  const { data } = await apiClient.get<FeaturePassport>(`/api/v1/features/${name}`)
  return data
}

export async function fetchFeatureLeaderboard(): Promise<FeatureLeaderboardResponse> {
  const { data } = await apiClient.get<FeatureLeaderboardResponse>('/api/v1/features/leaderboard')
  return data
}

export async function fetchFeatureEvalRun(runId: string): Promise<FeatureEvalRun> {
  const { data } = await apiClient.get<FeatureEvalRun>(`/api/v1/feature-eval/${runId}`)
  return data
}

export async function setFeatureStatus(
  name: string,
  version: number,
  status: FeatureStatus,
): Promise<FeaturePassport> {
  const body: FeatureStatusUpdateRequest = { status }
  const { data } = await apiClient.post<FeaturePassport>(
    `/api/v1/features/${name}/${version}/status`,
    body,
  )
  return data
}

export async function startFeatureEval(request: EvalRunRequest): Promise<FeatureEvalStartResponse> {
  const { data } = await apiClient.post<FeatureEvalStartResponse>('/api/v1/feature-eval', request)
  return data
}

export function evalRunRefetchInterval(isRunning: boolean): number | false {
  return isRunning ? 2500 : false
}

export function useFeatureList(params: FeatureListParams = {}) {
  return useQuery({
    queryKey: featureKeys.list(params),
    queryFn: () => fetchFeatureList(params),
  })
}

export function useFeaturePassport(name: string | null) {
  return useQuery({
    queryKey: featureKeys.passport(name ?? ''),
    queryFn: () => fetchFeaturePassport(name as string),
    enabled: !!name,
  })
}

export function useFeatureLeaderboard() {
  return useQuery({
    queryKey: featureKeys.leaderboard(),
    queryFn: fetchFeatureLeaderboard,
  })
}

export function useFeatureEvalRun(runId: string | null, { isRunning }: { isRunning: boolean }) {
  return useQuery({
    queryKey: featureKeys.evalRun(runId ?? ''),
    queryFn: () => fetchFeatureEvalRun(runId as string),
    enabled: !!runId,
    staleTime: 1_000,
    refetchInterval: evalRunRefetchInterval(isRunning),
  })
}

type SetFeatureStatusContext = {
  previousPassport: FeaturePassport | undefined
}

export function useSetFeatureStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      name,
      version,
      status,
    }: {
      name: string
      version: number
      status: FeatureStatus
    }) => setFeatureStatus(name, version, status),
    onMutate: async (variables): Promise<SetFeatureStatusContext> => {
      const passportKey = featureKeys.passport(variables.name)
      await queryClient.cancelQueries({ queryKey: passportKey })
      const previousPassport = queryClient.getQueryData<FeaturePassport>(passportKey)
      if (previousPassport) {
        queryClient.setQueryData<FeaturePassport>(passportKey, {
          ...previousPassport,
          versions: previousPassport.versions.map((versionRow) =>
            versionRow.version === variables.version
              ? { ...versionRow, status: variables.status }
              : versionRow,
          ),
        })
      }
      return { previousPassport }
    },
    onError: (_error, variables, context) => {
      if (context?.previousPassport) {
        queryClient.setQueryData(featureKeys.passport(variables.name), context.previousPassport)
      }
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(featureKeys.passport(variables.name), data)
      queryClient.invalidateQueries({ queryKey: [...featureKeys.all, 'list'] })
      queryClient.invalidateQueries({ queryKey: featureKeys.leaderboard() })
    },
  })
}

export function useStartFeatureEval() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: startFeatureEval,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: featureKeys.leaderboard() })
      queryClient.setQueryData(featureKeys.evalRun(data.run_id), undefined)
    },
  })
}
