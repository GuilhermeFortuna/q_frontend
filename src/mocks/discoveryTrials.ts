import {
  deletedStrategySearchRunIds,
  getMockStrategySearchResults,
  getUpdatedStrategySearchJob,
} from '@/mocks/strategySearch'
import type { DiscoveryTrial, DiscoveryTrialPage } from '@/types/strategySearch'

export function discoveryTrialPage(
  runId: string,
  params: URLSearchParams,
): DiscoveryTrialPage | null {
  if (deletedStrategySearchRunIds.has(runId)) return null
  const job = getUpdatedStrategySearchJob(runId)
  const stored = getMockStrategySearchResults(runId)
  if (!job && !stored) return null
  const count =
    job && ['pending', 'running'].includes(job.status)
      ? Math.floor(Math.max(0, Date.now() - job.start_time - 800) / 100)
      : 160
  const rows: DiscoveryTrial[] = Array.from({ length: count }, (_, index) => ({
    candidate_id: ['MACrossover', 'VMA', 'RSIMeanReversion'][index % 3],
    generation: job?.is_genetic ? Math.floor(index / 40) : -1,
    window_index: Math.floor(index / 20) % 3,
    trial_number: index,
    state: index % 9 === 0 ? 'pruned' : 'completed',
    objective_value: index % 9 === 0 ? null : index * 17 - 200,
    parameters: { period: (index % 20) + 5, stop_loss_pct: index % 3 },
    metrics: { total_pnl: index * 17 - 200 },
    started_at: new Date((job?.start_time ?? 1_700_000_000_000) + index * 100).toISOString(),
    finished_at: new Date((job?.start_time ?? 1_700_000_000_000) + index * 100 + 90).toISOString(),
    error: null,
  }))
  const filtered = rows.filter((t) => {
    for (const key of ['candidate_id', 'generation', 'window_index', 'state'] as const) {
      if (params.has(key) && String(t[key]) !== params.get(key)) return false
    }
    if (
      params.has('objective_min') &&
      (t.objective_value == null || t.objective_value < Number(params.get('objective_min')))
    )
      return false
    if (
      params.has('objective_max') &&
      (t.objective_value == null || t.objective_value > Number(params.get('objective_max')))
    )
      return false
    if (
      params.get('q') &&
      !JSON.stringify(t.parameters).toLowerCase().includes(params.get('q')!.toLowerCase())
    )
      return false
    return true
  })
  const sort = (params.get('sort') ?? 'finished_at') as keyof DiscoveryTrial
  const descending = params.get('descending') !== 'false'
  filtered.sort((a, b) => {
    if (a[sort] == null) return 1
    if (b[sort] == null) return -1
    const result = a[sort]! < b[sort]! ? -1 : a[sort]! > b[sort]! ? 1 : 0
    return result * (descending ? -1 : 1)
  })
  const limit = Number(params.get('limit') ?? 100),
    offset = Number(params.get('offset') ?? 0)
  return { items: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset }
}
