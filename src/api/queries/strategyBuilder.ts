import { useMutation, useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type {
  AiStrategyModelsResponse,
  AiStrategyResponse,
  CapabilityRegistry,
  CompileStrategySpecResponse,
  StrategyInterpretRequest,
  StrategySpec,
  ValidationResult,
} from '@/types/strategyBuilder'

// Local-model interpretation on CPU is slow (a 7.5B model takes ~80s+ for this
// prompt and varies with machine load). Keep this above the backend provider
// timeout (Q_AI_STRATEGY_TIMEOUT_SECONDS) so the backend's structured timeout
// error surfaces instead of a generic axios abort.
const INTERPRET_TIMEOUT_MS = 200_000
const MODELS_STALE_TIME_MS = 30_000

export const strategyBuilderKeys = {
  all: ['strategy-builder'] as const,
  capabilities: () => [...strategyBuilderKeys.all, 'capabilities'] as const,
  models: () => [...strategyBuilderKeys.all, 'models'] as const,
}

export async function fetchStrategyBuilderCapabilities(): Promise<CapabilityRegistry> {
  const { data } = await apiClient.get<CapabilityRegistry>('/api/v1/strategy-builder/capabilities')
  return data
}

export function useStrategyBuilderCapabilities(enabled = true) {
  return useQuery({
    queryKey: strategyBuilderKeys.capabilities(),
    queryFn: fetchStrategyBuilderCapabilities,
    staleTime: Infinity,
    enabled,
  })
}

export async function fetchStrategyBuilderModels(): Promise<AiStrategyModelsResponse> {
  const { data } = await apiClient.get<AiStrategyModelsResponse>('/api/v1/strategy-builder/models')
  return data
}

export function useStrategyBuilderModels(enabled = true) {
  return useQuery({
    queryKey: strategyBuilderKeys.models(),
    queryFn: fetchStrategyBuilderModels,
    staleTime: MODELS_STALE_TIME_MS,
    enabled,
  })
}

export async function interpretStrategyRequest(
  request: StrategyInterpretRequest,
): Promise<AiStrategyResponse> {
  const { data } = await apiClient.post<AiStrategyResponse>(
    '/api/v1/strategy-builder/interpret',
    request,
    { timeout: INTERPRET_TIMEOUT_MS },
  )
  return data
}

export function useInterpretStrategy() {
  return useMutation({
    mutationFn: interpretStrategyRequest,
  })
}

export async function validateStrategySpec(strategySpec: StrategySpec): Promise<ValidationResult> {
  const { data } = await apiClient.post<ValidationResult>('/api/v1/strategy-builder/validate', {
    strategy_spec: strategySpec,
  })
  return data
}

export function useValidateStrategySpec() {
  return useMutation({
    mutationFn: validateStrategySpec,
  })
}

export async function compileStrategySpec(
  strategySpec: StrategySpec,
): Promise<CompileStrategySpecResponse> {
  const { data } = await apiClient.post<CompileStrategySpecResponse>(
    '/api/v1/strategy-builder/compile',
    { strategy_spec: strategySpec },
  )
  return data
}

export function useCompileStrategySpec() {
  return useMutation({
    mutationFn: compileStrategySpec,
  })
}
