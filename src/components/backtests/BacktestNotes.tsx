import type { BacktestNote } from '../../../contracts/api'

type BacktestNotesProps = {
  notes?: BacktestNote[] | null
}

/** Run-level notes such as approximations; renders nothing when there are none. */
export function BacktestNotes({ notes }: BacktestNotesProps) {
  if (!notes || notes.length === 0) return null
  return (
    <section
      aria-label="Notes"
      className="border-carbon-600/50 text-silver-300 mb-3 rounded-lg border px-3 py-2 text-xs"
      data-testid="backtest-notes"
    >
      <h3 className="text-silver-100 mb-1 font-semibold">Notes</h3>
      <ul className="text-silver-400 list-disc space-y-1 pl-4">
        {notes.map((note, index) => (
          <li key={`${note.code}-${index}`}>{note.message}</li>
        ))}
      </ul>
    </section>
  )
}
