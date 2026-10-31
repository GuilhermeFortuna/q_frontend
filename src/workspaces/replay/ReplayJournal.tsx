import { useMemo } from 'react'

import type { ReplayJournalRow } from '@/types/replay'
import { formatExchangeTime } from '@/workspaces/replay/replayTime'

type ReplayJournalProps = {
  rows: ReplayJournalRow[]
  error: string | null
}

function describe(row: ReplayJournalRow): string {
  const payload = row.payload
  const action = typeof payload.action === 'string' ? payload.action : null
  if (row.kind === 'command' && action) {
    const extra =
      typeof payload.rate === 'number'
        ? ` to ${payload.rate}×`
        : typeof payload.market_ms === 'number'
          ? ` by ${Math.round(payload.market_ms / 60000)} min`
          : ''
    return `Command: ${action}${extra}`
  }
  return row.kind
}

/** Journal entries of the current run, newest first. */
export function ReplayJournal({ rows, error }: ReplayJournalProps) {
  const newestFirst = useMemo(() => [...rows].reverse(), [rows])

  return (
    <div className="space-y-2">
      {error ? (
        <p role="alert" className="text-sm text-rose-300">
          The journal could not be refreshed: {error}
        </p>
      ) : null}
      {newestFirst.length === 0 ? (
        <p className="text-silver-400 text-sm">No journal entries yet.</p>
      ) : (
        <ol className="max-h-80 space-y-1 overflow-y-auto text-xs" aria-label="Replay journal">
          {newestFirst.map((row) => (
            <li
              key={row.seq}
              className="border-silver-700/20 grid grid-cols-[4rem_1fr] gap-x-3 border-b py-1 sm:grid-cols-[4rem_12rem_1fr]"
            >
              <span className="text-silver-400 font-mono">#{row.seq}</span>
              <span className="text-silver-300 font-mono">
                {formatExchangeTime(row.market_time_utc)}
              </span>
              <span className="text-silver-200 col-span-2 sm:col-span-1">{describe(row)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
