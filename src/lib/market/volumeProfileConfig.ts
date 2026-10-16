import type { IndicatorConfig } from '@/lib/market/indicatorConfig'

export const VOLUME_PROFILE_INDICATOR_ID = 'volume_profile'

export type VolumeProfileSegmentMode = 'session' | 'visibleRange'

export type VolumeProfileOverlaySettings = {
  segment: VolumeProfileSegmentMode
  rowTicks: number
  valueArea: number
  splitBuySell: boolean
  widthPercent: number
}

export const DEFAULT_VOLUME_PROFILE_SETTINGS: VolumeProfileOverlaySettings = {
  segment: 'session',
  rowTicks: 1,
  valueArea: 0.7,
  splitBuySell: true,
  widthPercent: 25,
}

const OVERLAY_ONLY_INDICATOR_IDS = new Set<string>([VOLUME_PROFILE_INDICATOR_ID])

export function isOverlayOnlyIndicator(id: string): boolean {
  return OVERLAY_ONLY_INDICATOR_IDS.has(id)
}

export function volumeProfileFromIndicators(indicators: IndicatorConfig[]): {
  enabled: boolean
  settings: VolumeProfileOverlaySettings
} {
  const entry = indicators.find((item) => item.id === VOLUME_PROFILE_INDICATOR_ID)
  if (!entry?.enabled) {
    return { enabled: false, settings: DEFAULT_VOLUME_PROFILE_SETTINGS }
  }
  const params = entry.parameters
  const segmentRaw = params.segment
  const segment: VolumeProfileSegmentMode =
    segmentRaw === 'visibleRange' || segmentRaw === 'session' ? segmentRaw : 'session'
  const rowTicks =
    typeof params.rowTicks === 'number' && params.rowTicks >= 1
      ? Math.min(1000, Math.floor(params.rowTicks))
      : DEFAULT_VOLUME_PROFILE_SETTINGS.rowTicks
  const valueArea =
    typeof params.valueArea === 'number' && params.valueArea >= 0.05 && params.valueArea <= 1
      ? params.valueArea
      : DEFAULT_VOLUME_PROFILE_SETTINGS.valueArea
  const splitBuySell =
    typeof params.splitBuySell === 'boolean'
      ? params.splitBuySell
      : params.splitBuySell === 'true'
        ? true
        : params.splitBuySell === 'false'
          ? false
          : DEFAULT_VOLUME_PROFILE_SETTINGS.splitBuySell
  const widthPercent =
    typeof params.widthPercent === 'number' && params.widthPercent >= 5 && params.widthPercent <= 50
      ? params.widthPercent
      : DEFAULT_VOLUME_PROFILE_SETTINGS.widthPercent

  return {
    enabled: true,
    settings: { segment, rowTicks, valueArea, splitBuySell, widthPercent },
  }
}

export function defaultVolumeProfileIndicatorConfig(enabled = false): IndicatorConfig {
  return {
    id: VOLUME_PROFILE_INDICATOR_ID,
    enabled,
    parameters: {
      segment: DEFAULT_VOLUME_PROFILE_SETTINGS.segment,
      rowTicks: DEFAULT_VOLUME_PROFILE_SETTINGS.rowTicks,
      valueArea: DEFAULT_VOLUME_PROFILE_SETTINGS.valueArea,
      splitBuySell: DEFAULT_VOLUME_PROFILE_SETTINGS.splitBuySell,
      widthPercent: DEFAULT_VOLUME_PROFILE_SETTINGS.widthPercent,
    },
  }
}

/** Calendar session key in America/Sao_Paulo, aligned with the tick store session day. */
export function sessionDayKey(timestamp: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp))
}
