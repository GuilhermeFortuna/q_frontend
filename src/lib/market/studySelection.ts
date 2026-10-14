import { useMemo, useSyncExternalStore } from 'react'

/** Enabled study ids per symbol. Kept apart from chart profiles, which are global. */
export const MARKET_STUDIES_STORAGE_KEY = 'quant:market-studies'
const CHANGE_EVENT = 'quant:market-studies-changed'

type StoredSelections = Record<string, string[]>

function readSelections(): StoredSelections {
  try {
    const raw = window.localStorage.getItem(MARKET_STUDIES_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const selections: StoredSelections = {}
    for (const [symbol, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(ids))
        selections[symbol] = ids.filter((id): id is string => typeof id === 'string')
    }
    return selections
  } catch {
    // Storage can be blocked or hold invalid JSON; the chart then starts with nothing enabled.
    return {}
  }
}

/** The enabled ids for one symbol, as a JSON string so the store compares by value. */
function readEnabledRaw(symbol: string): string {
  return JSON.stringify(readSelections()[symbol] ?? [])
}

export function writeEnabledStudyIds(symbol: string, ids: string[]): void {
  try {
    const selections = readSelections()
    selections[symbol] = [...new Set(ids)]
    window.localStorage.setItem(MARKET_STUDIES_STORAGE_KEY, JSON.stringify(selections))
  } catch {
    // Storage unavailable: the selection still works for this session through the event below.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** Enabled study ids for a symbol, live across every component that reads them. */
export function useEnabledStudyIds(symbol: string): string[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readEnabledRaw(symbol),
    () => '[]',
  )
  return useMemo(() => JSON.parse(raw) as string[], [raw])
}

/** Keep only the stored ids that still name a study in the list. */
export function pruneEnabledStudyIds(enabled: string[], existingIds: string[]): string[] {
  const existing = new Set(existingIds)
  return enabled.filter((id) => existing.has(id))
}
