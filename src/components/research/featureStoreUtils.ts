import type { FeatureListItem, FeatureStatus } from '@/types/features'
import { cn } from '@/lib/utils'

export type FeatureStoreSortColumn = 'feature' | 'type' | 'version' | 'status' | 'usage' | 'score'

export type FeatureStoreSortDirection = 'asc' | 'desc'

export const FEATURE_STORE_DEFAULT_SORT: {
  column: FeatureStoreSortColumn
  direction: FeatureStoreSortDirection
} = {
  column: 'score',
  direction: 'desc',
}

export function formatFeatureScore(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return '—'
  }
  return score.toFixed(2)
}

export function statusChipClass(status: FeatureStatus): string {
  const base =
    'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase'

  switch (status) {
    case 'production':
      return cn(base, 'accent-state text-gold-400')
    case 'candidate':
      return cn(base, 'bg-brass-500/10 text-brass-300')
    case 'experimental':
    default:
      return cn(base, 'bg-silver-500/10 text-silver-400')
  }
}

export function sortFeatureList(
  features: FeatureListItem[],
  column: FeatureStoreSortColumn,
  direction: FeatureStoreSortDirection,
): FeatureListItem[] {
  return [...features].sort((left, right) => {
    if (column === 'score') {
      return compareScores(left.score, right.score, direction)
    }
    const comparison = compareFeatureRows(left, right, column)
    return direction === 'asc' ? comparison : -comparison
  })
}

function compareFeatureRows(
  left: FeatureListItem,
  right: FeatureListItem,
  column: FeatureStoreSortColumn,
): number {
  switch (column) {
    case 'feature':
      return left.name.localeCompare(right.name)
    case 'type':
      return left.category.localeCompare(right.category)
    case 'version':
      return left.latest_version - right.latest_version
    case 'status':
      return left.status.localeCompare(right.status)
    case 'usage':
      return left.usage_count - right.usage_count
    case 'score':
      return compareScores(left.score, right.score, 'asc')
    default:
      return 0
  }
}

function compareScores(
  left: number | null,
  right: number | null,
  direction: FeatureStoreSortDirection,
): number {
  if (left === null && right === null) {
    return 0
  }
  if (left === null) {
    return 1
  }
  if (right === null) {
    return -1
  }
  return direction === 'desc' ? right - left : left - right
}

export function categoryLabel(category: string): string {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
