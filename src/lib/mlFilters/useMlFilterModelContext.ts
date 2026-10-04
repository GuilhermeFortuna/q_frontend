import axios from 'axios'
import { useMemo } from 'react'

import { useBacktestRun } from '@/api/queries/backtests'
import { useMlFilterModel, useMlFilterModels } from '@/api/queries/mlFilters'
import type { MlFilterModelContext } from '@/lib/backtesting/mlFilterConfig'

export const ML_FILTER_MODEL_LIST_LIMIT = 200

function errorReason(error: unknown): { status: number | null; message: string } {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : detail && typeof detail === 'object' && 'message' in detail
          ? String((detail as { message: unknown }).message)
          : error.message
    return { status: error.response?.status ?? null, message }
  }
  return { status: null, message: error instanceof Error ? error.message : 'Unknown error' }
}

/**
 * Resolves the selected ML filter model into an explicit state. A selection is never
 * cleared or replaced here: loading, missing, corrupt and incompatible are all reported.
 */
export function useMlFilterModelContext(modelVersionId: string | null, enabled: boolean) {
  const modelsQuery = useMlFilterModels({ limit: ML_FILTER_MODEL_LIST_LIMIT }, { enabled })
  const detailQuery = useMlFilterModel(modelVersionId)
  const sourceRunId =
    typeof detailQuery.data?.provenance?.source_run_id === 'string'
      ? detailQuery.data.provenance.source_run_id
      : null
  const runQuery = useBacktestRun(sourceRunId)

  const models = useMemo(() => modelsQuery.data?.items ?? [], [modelsQuery.data])

  const context = useMemo<MlFilterModelContext>(() => {
    const summary = models.find((item) => item.model_version_id === modelVersionId) ?? null
    const baseline = (runQuery.data?.config as MlFilterModelContext['baseline']) ?? null
    const base = {
      summary,
      baseline,
      baselineLoading: Boolean(sourceRunId) && runQuery.isLoading,
    }
    if (!modelVersionId) return { ...base, status: 'none', reasons: [] }

    const detailError = detailQuery.isError ? errorReason(detailQuery.error) : null
    if (detailError?.status === 404) return { ...base, status: 'missing', reasons: [] }
    // The list already says why a version is unusable, so prefer it over a detail failure.
    if (summary && !summary.ready) {
      return { ...base, status: 'incompatible', reasons: summary.compatibility_reasons ?? [] }
    }
    if (detailError) return { ...base, status: 'corrupt', reasons: [detailError.message] }
    if (modelsQuery.isLoading || detailQuery.isLoading) {
      return { ...base, status: 'loading', reasons: [] }
    }
    if (modelsQuery.isError) {
      return { ...base, status: 'corrupt', reasons: [errorReason(modelsQuery.error).message] }
    }
    if (!summary) return { ...base, status: 'missing', reasons: [] }
    return { ...base, status: 'ready', reasons: [] }
  }, [
    models,
    modelVersionId,
    detailQuery.isError,
    detailQuery.error,
    detailQuery.isLoading,
    modelsQuery.isLoading,
    modelsQuery.isError,
    modelsQuery.error,
    runQuery.data,
    runQuery.isLoading,
    sourceRunId,
  ])

  return { context, models, modelsLoading: modelsQuery.isLoading }
}
