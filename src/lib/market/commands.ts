import { parseTimeframeInput, type TimeframeCommand } from '@/lib/market/timeframeCommands'

export type ParsedCommand =
  | {
      kind: 'symbol-timeframe'
      symbolQuery: string
      timeframe: TimeframeCommand
    }
  | {
      kind: 'add-to-watchlist'
      symbolQuery: string
    }
  | {
      kind: 'remove-from-watchlist'
      symbolQuery: string
    }

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  const addMatch = trimmed.match(/^\+(?:\s+)?(.+)$/i)
  if (addMatch) {
    const symbolQuery = addMatch[1].trim()
    if (symbolQuery && !symbolQuery.startsWith('+')) {
      return { kind: 'add-to-watchlist', symbolQuery }
    }
    return null
  }

  const removeMatch = trimmed.match(/^-\s*(.+)$/i)
  if (removeMatch) {
    const symbolQuery = removeMatch[1].trim()
    return symbolQuery ? { kind: 'remove-from-watchlist', symbolQuery } : null
  }

  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    const timeframeToken = parts[parts.length - 1]
    const timeframe = parseTimeframeInput(timeframeToken)
    if (timeframe) {
      const symbolQuery = parts.slice(0, -1).join(' ').trim()
      if (symbolQuery) {
        return { kind: 'symbol-timeframe', symbolQuery, timeframe }
      }
    }
  }

  return null
}

export function commandSearchQuery(input: string, parsed: ParsedCommand | null): string {
  if (!parsed) {
    return input
  }

  switch (parsed.kind) {
    case 'add-to-watchlist':
    case 'remove-from-watchlist':
    case 'symbol-timeframe':
      return parsed.symbolQuery
    default: {
      const _exhaustive: never = parsed
      return _exhaustive
    }
  }
}

export function commandActionLabel(parsed: ParsedCommand): string {
  switch (parsed.kind) {
    case 'add-to-watchlist':
      return `Add ${parsed.symbolQuery} to watchlist`
    case 'remove-from-watchlist':
      return `Remove ${parsed.symbolQuery} from watchlist`
    case 'symbol-timeframe':
      return `Switch to ${parsed.symbolQuery} · ${parsed.timeframe.label.replace(/^Switch to /i, '')}`
    default: {
      const _exhaustive: never = parsed
      return _exhaustive
    }
  }
}
