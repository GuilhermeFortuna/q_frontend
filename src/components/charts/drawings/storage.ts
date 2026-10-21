import {
  ANCHOR_COUNT,
  DRAWING_LINE_STYLES,
  DRAWING_WIDTHS,
  PLACEMENT_FOR_TYPE,
  defaultOptionsFor,
  defaultStyleFor,
  type DrawingAnchor,
  type DrawingObject,
  type DrawingType,
} from '@/components/charts/drawings/model'

/**
 * Local persistence for drawings: one versioned entry per symbol, `quant:drawings:v2:<symbol>`.
 * Entries from the previous per-timeframe layout (`quant:drawings:<symbol>:<timeframe>`, bar
 * timestamps as anchors) are converted on first read and removed once the v2 entry is written.
 */

export const DRAWINGS_VERSION = 2
const LEGACY_PREFIX = 'quant:drawings:'
const V2_PREFIX = 'quant:drawings:v2:'

export type DrawingStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

export function drawingsStorageKey(symbol: string): string {
  return `${V2_PREFIX}${symbol}`
}

/** The browser's local storage, or null when the browser denies access to it. */
export function browserDrawingStorage(): DrawingStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export type LoadedDrawings = {
  drawings: DrawingObject[]
  /** Human-readable problems to show once, such as entries dropped as malformed. */
  notices: string[]
  /** Set when migrated legacy entries could not be written and are kept for the next attempt. */
  migrationPending: boolean
}

export type SaveResult = { ok: true } | { ok: false; reason: string }

export function loadSymbolDrawings(storage: DrawingStorage | null, symbol: string): LoadedDrawings {
  const notices: string[] = []
  if (!storage) return { drawings: [], notices, migrationPending: false }

  const byId = new Map<string, DrawingObject>()
  const v2Key = drawingsStorageKey(symbol)
  const legacyKeys = listLegacyKeys(storage, symbol)

  const current = readEntry(storage, v2Key)
  if (current.status === 'malformed') {
    notices.push(`Saved drawings for ${symbol} could not be read and were dropped.`)
  }
  let droppedDrawings = 0
  for (const raw of current.items) {
    const drawing = parseDrawing(raw)
    if (drawing) {
      byId.set(drawing.id, drawing)
    } else {
      droppedDrawings += 1
    }
  }

  let migrationPending = false
  if (legacyKeys.length > 0) {
    let migrated = false
    for (const key of legacyKeys) {
      const legacy = readEntry(storage, key)
      if (legacy.status === 'malformed') {
        notices.push(`Saved drawings for ${symbol} could not be read and were dropped.`)
      }
      for (const raw of legacy.items) {
        const drawing = migrateLegacyDrawing(raw)
        if (drawing) {
          migrated = true
          if (!byId.has(drawing.id)) byId.set(drawing.id, drawing)
        } else {
          droppedDrawings += 1
        }
      }
    }
    const drawings = [...byId.values()]
    const written =
      migrated || drawings.length > 0
        ? saveSymbolDrawings(storage, symbol, drawings)
        : { ok: true as const }
    if (written.ok) {
      for (const key of legacyKeys) storage.removeItem(key)
    } else {
      migrationPending = true
      notices.push(`Drawings for ${symbol} were moved to a new format but could not be saved.`)
    }
  }

  if (droppedDrawings > 0) {
    notices.push(
      `${droppedDrawings} saved ${droppedDrawings === 1 ? 'drawing' : 'drawings'} for ${symbol} could not be read and ${droppedDrawings === 1 ? 'was' : 'were'} dropped.`,
    )
  }
  return { drawings: [...byId.values()], notices, migrationPending }
}

export function saveSymbolDrawings(
  storage: DrawingStorage | null,
  symbol: string,
  drawings: readonly DrawingObject[],
): SaveResult {
  if (!storage) return { ok: false, reason: 'Browser storage is unavailable.' }
  try {
    storage.setItem(
      drawingsStorageKey(symbol),
      JSON.stringify({ version: DRAWINGS_VERSION, drawings }),
    )
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Browser storage rejected the write.',
    }
  }
}

function listLegacyKeys(storage: DrawingStorage, symbol: string): string[] {
  const prefix = `${LEGACY_PREFIX}${symbol}:`
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || key.startsWith(V2_PREFIX) || !key.startsWith(prefix)) continue
    if (key.slice(prefix.length).includes(':')) continue
    keys.push(key)
  }
  return keys
}

type ReadEntry = { status: 'missing' | 'ok' | 'malformed'; items: unknown[] }

function readEntry(storage: DrawingStorage, key: string): ReadEntry {
  const raw = storage.getItem(key)
  if (raw === null) return { status: 'missing', items: [] }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return { status: 'ok', items: parsed }
    if (isRecord(parsed) && parsed.version === DRAWINGS_VERSION && Array.isArray(parsed.drawings)) {
      return { status: 'ok', items: parsed.drawings }
    }
  } catch {
    // Fall through to the malformed result.
  }
  return { status: 'malformed', items: [] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseAnchor(value: unknown): DrawingAnchor | null {
  if (!isRecord(value) || !isFiniteNumber(value.time) || !isFiniteNumber(value.price)) return null
  return { time: value.time, price: value.price }
}

const DRAWING_TYPES = Object.keys(ANCHOR_COUNT) as DrawingType[]

/** Validates one stored drawing; returns null when it cannot be drawn safely. */
export function parseDrawing(value: unknown): DrawingObject | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return null
  const type = value.type
  if (typeof type !== 'string' || !DRAWING_TYPES.includes(type as DrawingType)) return null
  const drawingType = type as DrawingType

  if (!Array.isArray(value.anchors) || value.anchors.length !== ANCHOR_COUNT[drawingType]) {
    return null
  }
  const anchors = value.anchors.map(parseAnchor)
  if (anchors.some((anchor) => anchor === null)) return null

  const style = parseStyle(drawingType, value.style)
  const options = parseOptions(drawingType, value.options)
  return {
    id: value.id,
    type: drawingType,
    anchors: anchors as DrawingAnchor[],
    style,
    locked: value.locked === true,
    hidden: value.hidden === true,
    options,
  } as DrawingObject
}

function parseStyle(type: DrawingType, value: unknown): DrawingObject['style'] {
  const defaults = defaultStyleFor(PLACEMENT_FOR_TYPE[type])
  if (!isRecord(value)) return defaults
  const width = DRAWING_WIDTHS.find((candidate) => candidate === value.width) ?? defaults.width
  const lineStyle =
    DRAWING_LINE_STYLES.find((candidate) => candidate === value.lineStyle) ?? defaults.lineStyle
  const color = typeof value.color === 'string' && value.color ? value.color : defaults.color
  return { color, width, lineStyle }
}

/** Keeps the stored options whose keys and types match the tool's defaults; the rest default. */
function parseOptions(type: DrawingType, value: unknown): DrawingObject['options'] {
  const defaults = defaultOptionsFor(PLACEMENT_FOR_TYPE[type]) as Record<string, unknown>
  const stored = isRecord(value) ? value : {}
  const result: Record<string, unknown> = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const fallback = defaults[key]
    const candidate = stored[key]
    if (Array.isArray(fallback)) {
      if (Array.isArray(candidate)) {
        result[key] = candidate.filter(isFiniteNumber)
      }
    } else if (typeof candidate === typeof fallback) {
      result[key] = candidate
    }
  }
  if (type === 'position') {
    result.side = stored.side === 'short' ? 'short' : 'long'
  }
  return result as DrawingObject['options']
}

/**
 * Converts a drawing from the per-timeframe layout. Bar timestamps become epoch milliseconds,
 * and a horizontal line keeps only its price (its time is never drawn).
 */
export function migrateLegacyDrawing(value: unknown): DrawingObject | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') {
    return null
  }
  const legacyPoint = (point: unknown): DrawingAnchor | null => {
    if (!isRecord(point) || typeof point.timestamp !== 'string' || !isFiniteNumber(point.price)) {
      return null
    }
    const time = Date.parse(point.timestamp)
    return Number.isFinite(time) ? { time, price: point.price } : null
  }

  let converted: unknown = null
  if (value.type === 'trendline' || value.type === 'fibo') {
    const first = legacyPoint(value.p1)
    const second = legacyPoint(value.p2)
    if (first && second) {
      converted = {
        id: value.id,
        type: value.type === 'fibo' ? 'fib' : 'trendline',
        anchors: [first, second],
      }
    }
  } else if (value.type === 'horizontal') {
    if (isFiniteNumber(value.price)) {
      converted = { id: value.id, type: 'hline', anchors: [{ time: 0, price: value.price }] }
    }
  } else if (value.type === 'text') {
    const point = legacyPoint(value.point)
    if (point && typeof value.label === 'string') {
      converted = {
        id: value.id,
        type: 'text',
        anchors: [point],
        options: { text: value.label },
      }
    }
  }
  return converted === null ? null : parseDrawing(converted)
}
