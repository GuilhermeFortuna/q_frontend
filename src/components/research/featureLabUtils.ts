import { formatISO } from 'date-fns'

import type { EvalRunFeatureRequest, EvalRunRequest, FeatureListItem } from '@/types/features'

export const TARGET_FAMILY_OPTIONS = [
  { value: 'fwd_return', label: 'Forward return' },
  { value: 'fwd_log_return', label: 'Forward log return' },
  { value: 'fwd_vol_adj_return', label: 'Vol-adjusted return' },
  { value: 'fwd_direction', label: 'Forward direction' },
] as const

export type TargetFamily = (typeof TARGET_FAMILY_OPTIONS)[number]['value']

export type FeatureLabConfigSnapshot = {
  symbol: string
  timeframe: string
  startDate: Date
  endDate: Date
  targetName: TargetFamily
  horizon: number
  featureNames: string[]
}

export type FeatureLabFormState = {
  symbol: string
  timeframe: string
  startDate: Date
  endDate: Date
  targetName: TargetFamily
  horizon: number
  selectedFeatures: Set<string>
}

export function groupFeaturesByCategory(
  features: FeatureListItem[],
): Map<string, FeatureListItem[]> {
  const grouped = new Map<string, FeatureListItem[]>()
  for (const feature of features) {
    const bucket = grouped.get(feature.category) ?? []
    bucket.push(feature)
    grouped.set(feature.category, bucket)
  }
  return grouped
}

export function isFeatureLabConfigValid(state: FeatureLabFormState): boolean {
  return (
    state.symbol.trim().length > 0 &&
    state.startDate < state.endDate &&
    state.horizon >= 1 &&
    state.selectedFeatures.size >= 1
  )
}

export function buildEvalRunRequest(
  state: FeatureLabFormState,
  featureList: FeatureListItem[],
): EvalRunRequest {
  const features: EvalRunFeatureRequest[] = [...state.selectedFeatures].map((name) => {
    const item = featureList.find((feature) => feature.name === name)
    return {
      name,
      version: item?.latest_version,
    }
  })

  return {
    symbol: state.symbol.trim().toUpperCase(),
    timeframe: state.timeframe,
    start: formatISO(state.startDate),
    end: formatISO(state.endDate),
    target: {
      name: state.targetName,
      horizon: state.horizon,
    },
    features,
  }
}

export function snapshotFromFormState(state: FeatureLabFormState): FeatureLabConfigSnapshot {
  return {
    symbol: state.symbol,
    timeframe: state.timeframe,
    startDate: state.startDate,
    endDate: state.endDate,
    targetName: state.targetName,
    horizon: state.horizon,
    featureNames: [...state.selectedFeatures].sort(),
  }
}

export function evalRunLabel(snapshot: FeatureLabConfigSnapshot): string {
  return `${snapshot.symbol} ${snapshot.timeframe} · ${snapshot.featureNames.length} features`
}
