import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { apiClient } from '@/api/client'
import type {
  AuditEventListResponse,
  DecisionListResponse,
  DeploymentActionRequest,
  DeploymentActionResponse,
  DeploymentChart,
  DeploymentCreateRequest,
  DeploymentDetail,
  DeploymentListResponse,
  ExecutionHealth,
  FillListResponse,
  KillSwitchState,
  KillSwitchUpdateRequest,
  KillSwitchUpdateResponse,
  LedgerListResponse,
  OrderListResponse,
  PaperAccountCreateRequest,
  PaperAccountListResponse,
  PositionListResponse,
  RiskEventListResponse,
} from '@/types/execution'

export const EXECUTION_POLL_MS = 5_000
export const EXECUTION_PAGE_SIZE = 25
export const EXECUTION_CHART_BARS = 200
/** Markers only need the most recent activity; the chart window is bounded anyway. */
export const EXECUTION_CHART_MARKER_LIMIT = 100

export const executionKeys = {
  all: ['execution'] as const,
  health: () => [...executionKeys.all, 'health'] as const,
  killSwitch: () => [...executionKeys.all, 'kill-switch'] as const,
  accounts: (limit: number, offset: number) =>
    [...executionKeys.all, 'accounts', { limit, offset }] as const,
  deployments: (params: DeploymentListParams) =>
    [...executionKeys.all, 'deployments', params] as const,
  deployment: (id: string) => [...executionKeys.all, 'deployment', id] as const,
  chart: (deploymentId: string, bars: number) =>
    [...executionKeys.all, 'chart', deploymentId, { bars }] as const,
  decisions: (deploymentId: string, limit: number, offset: number) =>
    [...executionKeys.all, 'decisions', deploymentId, { limit, offset }] as const,
  orders: (deploymentId: string, limit: number, offset: number) =>
    [...executionKeys.all, 'orders', deploymentId, { limit, offset }] as const,
  fills: (deploymentId: string, limit: number, offset: number) =>
    [...executionKeys.all, 'fills', deploymentId, { limit, offset }] as const,
  positions: (deploymentId: string, limit: number, offset: number) =>
    [...executionKeys.all, 'positions', deploymentId, { limit, offset }] as const,
  ledger: (accountId: string, limit: number, offset: number) =>
    [...executionKeys.all, 'ledger', accountId, { limit, offset }] as const,
  riskEvents: (deploymentId: string, limit: number, offset: number) =>
    [...executionKeys.all, 'risk-events', deploymentId, { limit, offset }] as const,
  auditEvents: (limit: number, offset: number, deploymentId?: string) =>
    [...executionKeys.all, 'audit-events', { limit, offset, deploymentId }] as const,
}

export type DeploymentListParams = {
  paper_account_id?: string
  lifecycle?: string
  symbol?: string
  limit?: number
  offset?: number
}

type PollingOptions = {
  enabled?: boolean
}

function pollingInterval(enabled: boolean | undefined): number | false {
  return enabled === false ? false : EXECUTION_POLL_MS
}

export async function fetchExecutionHealth(): Promise<ExecutionHealth> {
  const { data } = await apiClient.get<ExecutionHealth>('/api/v1/execution/health')
  return data
}

export async function fetchKillSwitch(): Promise<KillSwitchState> {
  const { data } = await apiClient.get<KillSwitchState>('/api/v1/execution/kill-switch')
  return data
}

export async function fetchPaperAccounts(
  limit = 50,
  offset = 0,
): Promise<PaperAccountListResponse> {
  const { data } = await apiClient.get<PaperAccountListResponse>('/api/v1/execution/accounts', {
    params: { limit, offset },
  })
  return data
}

export async function createPaperAccount(
  body: PaperAccountCreateRequest,
): Promise<PaperAccountListResponse['items'][number]> {
  const { data } = await apiClient.post<PaperAccountListResponse['items'][number]>(
    '/api/v1/execution/accounts',
    body,
  )
  return data
}

export async function fetchDeployments(
  params: DeploymentListParams = {},
): Promise<DeploymentListResponse> {
  const { data } = await apiClient.get<DeploymentListResponse>('/api/v1/execution/deployments', {
    params,
  })
  return data
}

export async function fetchDeployment(deploymentId: string): Promise<DeploymentDetail> {
  const { data } = await apiClient.get<DeploymentDetail>(
    `/api/v1/execution/deployments/${deploymentId}`,
  )
  return data
}

export async function fetchDeploymentChart(
  deploymentId: string,
  bars = EXECUTION_CHART_BARS,
): Promise<DeploymentChart> {
  const { data } = await apiClient.get<DeploymentChart>(
    `/api/v1/execution/deployments/${deploymentId}/chart`,
    { params: { bars } },
  )
  return data
}

export async function createDeployment(body: DeploymentCreateRequest): Promise<DeploymentDetail> {
  const { data } = await apiClient.post<DeploymentDetail>('/api/v1/execution/deployments', body)
  return data
}

export async function postDeploymentAction(
  deploymentId: string,
  body: DeploymentActionRequest,
): Promise<DeploymentActionResponse> {
  const { data } = await apiClient.post<DeploymentActionResponse>(
    `/api/v1/execution/deployments/${deploymentId}/actions`,
    body,
  )
  return data
}

export async function updateKillSwitch(
  body: KillSwitchUpdateRequest,
): Promise<KillSwitchUpdateResponse> {
  const { data } = await apiClient.put<KillSwitchUpdateResponse>(
    '/api/v1/execution/kill-switch',
    body,
  )
  return data
}

export async function fetchDecisions(
  deploymentId: string,
  limit = EXECUTION_PAGE_SIZE,
  offset = 0,
): Promise<DecisionListResponse> {
  const { data } = await apiClient.get<DecisionListResponse>(
    `/api/v1/execution/deployments/${deploymentId}/decisions`,
    { params: { limit, offset } },
  )
  return data
}

export async function fetchOrders(
  deploymentId: string,
  limit = EXECUTION_PAGE_SIZE,
  offset = 0,
): Promise<OrderListResponse> {
  const { data } = await apiClient.get<OrderListResponse>(
    `/api/v1/execution/deployments/${deploymentId}/orders`,
    { params: { limit, offset } },
  )
  return data
}

export async function fetchFills(
  deploymentId: string,
  limit = EXECUTION_PAGE_SIZE,
  offset = 0,
): Promise<FillListResponse> {
  const { data } = await apiClient.get<FillListResponse>(
    `/api/v1/execution/deployments/${deploymentId}/fills`,
    { params: { limit, offset } },
  )
  return data
}

export async function fetchPositions(
  deploymentId: string,
  limit = EXECUTION_PAGE_SIZE,
  offset = 0,
): Promise<PositionListResponse> {
  const { data } = await apiClient.get<PositionListResponse>('/api/v1/execution/positions', {
    params: { deployment_id: deploymentId, limit, offset },
  })
  return data
}

export async function fetchLedger(
  paperAccountId: string,
  limit = EXECUTION_PAGE_SIZE,
  offset = 0,
): Promise<LedgerListResponse> {
  const { data } = await apiClient.get<LedgerListResponse>(
    `/api/v1/execution/accounts/${paperAccountId}/ledger`,
    { params: { limit, offset } },
  )
  return data
}

export async function fetchRiskEvents(
  deploymentId: string,
  limit = EXECUTION_PAGE_SIZE,
  offset = 0,
): Promise<RiskEventListResponse> {
  const { data } = await apiClient.get<RiskEventListResponse>(
    `/api/v1/execution/deployments/${deploymentId}/risk-events`,
    { params: { limit, offset } },
  )
  return data
}

export async function fetchAuditEvents(
  limit = EXECUTION_PAGE_SIZE,
  offset = 0,
  deploymentId?: string,
): Promise<AuditEventListResponse> {
  const { data } = await apiClient.get<AuditEventListResponse>('/api/v1/execution/audit-events', {
    params: { limit, offset, deployment_id: deploymentId },
  })
  return data
}

export function useExecutionHealth(options?: PollingOptions) {
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: executionKeys.health(),
    queryFn: fetchExecutionHealth,
    enabled,
    staleTime: 2_000,
    refetchInterval: pollingInterval(enabled),
  })
}

export function useKillSwitch(options?: PollingOptions) {
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: executionKeys.killSwitch(),
    queryFn: fetchKillSwitch,
    enabled,
    staleTime: 2_000,
    refetchInterval: pollingInterval(enabled),
  })
}

export function usePaperAccounts(options?: PollingOptions & { limit?: number; offset?: number }) {
  const enabled = options?.enabled ?? true
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  return useQuery({
    queryKey: executionKeys.accounts(limit, offset),
    queryFn: () => fetchPaperAccounts(limit, offset),
    enabled,
    staleTime: 5_000,
    refetchInterval: pollingInterval(enabled),
  })
}

export function useDeployments(params: DeploymentListParams = {}, options?: PollingOptions) {
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: executionKeys.deployments(params),
    queryFn: () => fetchDeployments(params),
    enabled,
    staleTime: 2_000,
    refetchInterval: pollingInterval(enabled),
  })
}

export function useDeployment(deploymentId: string | null, options?: PollingOptions) {
  const enabled = (options?.enabled ?? true) && !!deploymentId
  return useQuery({
    queryKey: executionKeys.deployment(deploymentId ?? ''),
    queryFn: () => fetchDeployment(deploymentId as string),
    enabled,
    staleTime: 2_000,
    refetchInterval: pollingInterval(enabled),
  })
}

export function useDeploymentChart(
  deploymentId: string | null,
  bars = EXECUTION_CHART_BARS,
  options?: PollingOptions,
) {
  const enabled = (options?.enabled ?? true) && !!deploymentId
  return useQuery({
    queryKey: executionKeys.chart(deploymentId ?? '', bars),
    queryFn: () => fetchDeploymentChart(deploymentId as string, bars),
    enabled,
    // The backend serves a new-bar cache, so a full chart refetch is bounded to the
    // execution cadence — the forming-bar quote poll is the only faster loop.
    staleTime: EXECUTION_POLL_MS,
    refetchInterval: pollingInterval(enabled),
    // On a 503 (market data down) keep the last good chart so the panel can show a
    // stale note instead of an error wall. A 404 (pre-WO175 backend) must not retry.
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      if (isAxiosError(error) && error.response?.status === 404) return false
      return failureCount < 1
    },
  })
}

export function useDecisions(
  deploymentId: string | null,
  offset: number,
  options?: PollingOptions,
) {
  const enabled = (options?.enabled ?? true) && !!deploymentId
  return useQuery({
    queryKey: executionKeys.decisions(deploymentId ?? '', EXECUTION_PAGE_SIZE, offset),
    queryFn: () => fetchDecisions(deploymentId as string, EXECUTION_PAGE_SIZE, offset),
    enabled,
    staleTime: 2_000,
    refetchInterval: pollingInterval(enabled),
  })
}

export function useOrders(deploymentId: string | null, offset: number, options?: PollingOptions) {
  const enabled = (options?.enabled ?? true) && !!deploymentId
  return useQuery({
    queryKey: executionKeys.orders(deploymentId ?? '', EXECUTION_PAGE_SIZE, offset),
    queryFn: () => fetchOrders(deploymentId as string, EXECUTION_PAGE_SIZE, offset),
    enabled,
    staleTime: 2_000,
    refetchInterval: pollingInterval(enabled),
  })
}

export function useFills(deploymentId: string | null, offset: number, options?: PollingOptions) {
  const enabled = (options?.enabled ?? true) && !!deploymentId
  return useQuery({
    queryKey: executionKeys.fills(deploymentId ?? '', EXECUTION_PAGE_SIZE, offset),
    queryFn: () => fetchFills(deploymentId as string, EXECUTION_PAGE_SIZE, offset),
    enabled,
    staleTime: 2_000,
    refetchInterval: pollingInterval(enabled),
  })
}

export function useLedger(accountId: string | null, offset: number, options?: PollingOptions) {
  const enabled = (options?.enabled ?? true) && !!accountId
  return useQuery({
    queryKey: executionKeys.ledger(accountId ?? '', EXECUTION_PAGE_SIZE, offset),
    queryFn: () => fetchLedger(accountId as string, EXECUTION_PAGE_SIZE, offset),
    enabled,
    staleTime: 2_000,
    refetchInterval: pollingInterval(enabled),
  })
}

export function useRiskEvents(
  deploymentId: string | null,
  offset: number,
  options?: PollingOptions,
) {
  const enabled = (options?.enabled ?? true) && !!deploymentId
  return useQuery({
    queryKey: executionKeys.riskEvents(deploymentId ?? '', EXECUTION_PAGE_SIZE, offset),
    queryFn: () => fetchRiskEvents(deploymentId as string, EXECUTION_PAGE_SIZE, offset),
    enabled,
    staleTime: 2_000,
    refetchInterval: pollingInterval(enabled),
  })
}

export function useCreatePaperAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPaperAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: executionKeys.all })
    },
  })
}

export function useCreateDeployment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createDeployment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: executionKeys.all })
      queryClient.setQueryData(executionKeys.deployment(data.id), data)
    },
  })
}

export function useDeploymentAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deploymentId, body }: { deploymentId: string; body: DeploymentActionRequest }) =>
      postDeploymentAction(deploymentId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: executionKeys.all })
      queryClient.invalidateQueries({
        queryKey: executionKeys.deployment(variables.deploymentId),
      })
    },
  })
}

export function useUpdateKillSwitch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateKillSwitch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: executionKeys.all })
    },
  })
}
