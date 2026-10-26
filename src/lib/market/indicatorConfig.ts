import type { IndicatorCatalogEntry } from '../../../contracts/api'

export type IndicatorLineStyle = 'solid' | 'dashed' | 'dotted'

export type IndicatorStyle = {
  color?: string
  strokeWidth?: number
  lineStyle?: IndicatorLineStyle
  showCloud?: boolean
  outputColors?: Record<string, string>
  /** RSI only: display levels, not sent to the backend. */
  overboughtLevel?: number
  oversoldLevel?: number
}

export const RSI_DEFAULT_LEVELS = { overbought: 70, oversold: 30 } as const

export type RsiLevels = { overbought: number; oversold: number }

/** RSI overbought and oversold levels, falling back to the standard 70 and 30. */
export function rsiLevels(config: IndicatorConfig): RsiLevels {
  return {
    overbought: config.style?.overboughtLevel ?? RSI_DEFAULT_LEVELS.overbought,
    oversold: config.style?.oversoldLevel ?? RSI_DEFAULT_LEVELS.oversold,
  }
}

/** Error per RSI level field. Levels must lie in [0, 100] with oversold below overbought. */
export function rsiLevelErrors(config: IndicatorConfig): Record<string, string> {
  const { overbought, oversold } = rsiLevels(config)
  const errors: Record<string, string> = {}
  if (!Number.isFinite(overbought) || overbought < 0 || overbought > 100)
    errors.overboughtLevel = 'Overbought level must be between 0 and 100.'
  if (!Number.isFinite(oversold) || oversold < 0 || oversold > 100)
    errors.oversoldLevel = 'Oversold level must be between 0 and 100.'
  if (!errors.overboughtLevel && !errors.oversoldLevel && oversold >= overbought)
    errors.oversoldLevel = 'Oversold level must be below the overbought level.'
  return errors
}

export type IndicatorConfig = {
  id: string
  enabled: boolean
  parameters: Record<string, number | string | boolean>
  style?: IndicatorStyle
}

type LegacyIndicator = {
  type: string
  enabled: boolean
  period?: number
  stdDev?: number
  fast?: number
  slow?: number
  signal?: number
  color?: string
  strokeWidth?: number
  lineStyle?: IndicatorLineStyle
  showCloud?: boolean
  macdColor?: string
  signalColor?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isLegacyIndicatorConfig(value: unknown): value is LegacyIndicator {
  if (!isRecord(value) || typeof value.type !== 'string') return false
  return !('id' in value)
}

export function migrateLegacyIndicatorConfig(raw: LegacyIndicator): IndicatorConfig {
  const style: IndicatorStyle = {
    color: raw.color,
    strokeWidth: raw.strokeWidth,
    lineStyle: raw.lineStyle,
    showCloud: raw.showCloud,
  }

  switch (raw.type) {
    case 'volumeMa':
      return {
        id: 'volume_ma',
        enabled: raw.enabled,
        parameters: { period: raw.period ?? 20 },
        style,
      }
    case 'bollinger':
      return {
        id: 'bollinger',
        enabled: raw.enabled,
        parameters: { period: raw.period ?? 20, num_std: raw.stdDev ?? 2 },
        style,
      }
    case 'macd':
      return {
        id: 'macd',
        enabled: raw.enabled,
        parameters: {
          fast_period: raw.fast ?? 12,
          slow_period: raw.slow ?? 26,
          signal_period: raw.signal ?? 9,
        },
        style: {
          outputColors: {
            line: raw.macdColor ?? '#6eb5ff',
            signal: raw.signalColor ?? '#c9a227',
          },
        },
      }
    case 'sma':
    case 'ema':
    case 'wma':
    case 'hma':
    case 'smma':
    case 'rsi':
    case 'donchian':
      return {
        id: raw.type,
        enabled: raw.enabled,
        parameters: { period: raw.period ?? (raw.type === 'rsi' ? 14 : 20) },
        style,
      }
    default:
      return {
        id: raw.type,
        enabled: raw.enabled,
        parameters: {},
        style,
      }
  }
}

export function normalizeIndicatorConfig(raw: unknown): IndicatorConfig {
  if (isLegacyIndicatorConfig(raw)) {
    return migrateLegacyIndicatorConfig(raw)
  }
  if (!isRecord(raw) || typeof raw.id !== 'string') {
    throw new Error('Invalid indicator configuration')
  }
  const parameters: Record<string, number | string | boolean> = {}
  if (isRecord(raw.parameters)) {
    for (const [key, value] of Object.entries(raw.parameters)) {
      if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        parameters[key] = value
      }
    }
  }
  const style = isRecord(raw.style)
    ? ({
        color: typeof raw.style.color === 'string' ? raw.style.color : undefined,
        strokeWidth: typeof raw.style.strokeWidth === 'number' ? raw.style.strokeWidth : undefined,
        lineStyle:
          raw.style.lineStyle === 'solid' ||
          raw.style.lineStyle === 'dashed' ||
          raw.style.lineStyle === 'dotted'
            ? raw.style.lineStyle
            : undefined,
        showCloud: typeof raw.style.showCloud === 'boolean' ? raw.style.showCloud : undefined,
        overboughtLevel:
          typeof raw.style.overboughtLevel === 'number' ? raw.style.overboughtLevel : undefined,
        oversoldLevel:
          typeof raw.style.oversoldLevel === 'number' ? raw.style.oversoldLevel : undefined,
        outputColors: isRecord(raw.style.outputColors)
          ? Object.fromEntries(
              Object.entries(raw.style.outputColors).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string',
              ),
            )
          : undefined,
      } satisfies IndicatorStyle)
    : undefined

  return {
    id: raw.id,
    enabled: raw.enabled === true,
    parameters,
    style,
  }
}

export function normalizeIndicatorConfigs(raw: unknown): IndicatorConfig[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => normalizeIndicatorConfig(entry))
}

export function defaultParametersForEntry(
  entry: IndicatorCatalogEntry,
): Record<string, number | string> {
  const params: Record<string, number | string> = {}
  for (const spec of entry.parameters) {
    const value = spec.default
    if (typeof value === 'number' || typeof value === 'string') {
      params[spec.name] = value
    }
  }
  return params
}

export function indicatorInstanceKey(config: IndicatorConfig): string {
  return `${config.id}:${JSON.stringify(config.parameters)}`
}

export function mergeIndicatorParameters(
  entry: IndicatorCatalogEntry,
  overrides: Record<string, number | string>,
): Record<string, number | string> {
  return { ...defaultParametersForEntry(entry), ...overrides }
}
