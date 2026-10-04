import type { QueryClient } from '@tanstack/react-query'

import { backtestKeys, fetchBacktestRun } from '@/api/queries/backtests'
import { fetchMlFilterModel, fetchMlFilterModels, mlFilterKeys } from '@/api/queries/mlFilters'
import {
  DEFAULT_ML_FILTER_THRESHOLD,
  buildMlFilterBacktestConfig,
} from '@/lib/backtesting/mlFilterConfig'
import type { BacktestRequest } from '@/types/backtesting'

/**
 * Builds the variant setup for a saved model: its pinned baseline run (MA, exits, costs,
 * sizing, day-trade) with an evaluation range at or after the training end. Throws with an
 * actionable message instead of ever substituting another model.
 */
export async function prepareMlFilterBacktest(
  queryClient: QueryClient,
  modelVersionId: string,
  threshold = DEFAULT_ML_FILTER_THRESHOLD,
): Promise<BacktestRequest> {
  const detail = await queryClient.fetchQuery({
    queryKey: mlFilterKeys.model(modelVersionId),
    queryFn: () => fetchMlFilterModel(modelVersionId),
    staleTime: 30_000,
  })
  const sourceRunId =
    typeof detail.provenance?.source_run_id === 'string' ? detail.provenance.source_run_id : null
  if (!sourceRunId) {
    throw new Error('The model version does not record its source backtest.')
  }

  const list = await queryClient.fetchQuery({
    queryKey: mlFilterKeys.models({ dataset_id: detail.dataset_id }),
    queryFn: () => fetchMlFilterModels({ dataset_id: detail.dataset_id }),
    staleTime: 30_000,
  })
  const summary = list.items.find((item) => item.model_version_id === modelVersionId)
  if (!summary?.train_end) {
    throw new Error('The model version does not record its training end.')
  }
  if (!summary.ready) {
    throw new Error(
      `The model version is not usable: ${(summary.compatibility_reasons ?? []).join(' ') || 'artifact unavailable'}`,
    )
  }

  const run = await queryClient.fetchQuery({
    queryKey: backtestKeys.run(sourceRunId),
    queryFn: () => fetchBacktestRun(sourceRunId),
    staleTime: Infinity,
  })
  return buildMlFilterBacktestConfig({
    source: run.config as BacktestRequest,
    trainEnd: summary.train_end,
    modelVersionId,
    threshold,
  })
}
