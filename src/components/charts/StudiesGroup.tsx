import { useEffect, useState } from 'react'

import { indicatorRequestErrorMessage } from '@/api/queries/marketIndicators'
import {
  useDeleteResearchStudy,
  useRenameResearchStudy,
  useResearchStudyList,
} from '@/api/queries/researchStudies'
import { Button } from '@/components/ui/button'
import { toApiTimeframe } from '@/lib/market/timeframes'
import {
  pruneEnabledStudyIds,
  useEnabledStudyIds,
  writeEnabledStudyIds,
} from '@/lib/market/studySelection'

type StudiesGroupProps = {
  symbol: string
  /** The chart's timeframe, as the toolbar names it. */
  timeframe: string
}

/**
 * The studies published for the chart's symbol. Studies on another timeframe are listed
 * but disabled. Delete asks for confirmation inside the app, never with a browser dialog.
 */
export function StudiesGroup({ symbol, timeframe }: StudiesGroupProps) {
  const listQuery = useResearchStudyList(symbol)
  const enabledIds = useEnabledStudyIds(symbol)
  const rename = useRenameResearchStudy(symbol)
  const remove = useDeleteResearchStudy(symbol)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const items = listQuery.data?.items
  const apiTimeframe = toApiTimeframe(timeframe)

  // A stored id that no longer names a study is dropped once the list is known.
  useEffect(() => {
    if (!items) return
    const pruned = pruneEnabledStudyIds(
      enabledIds,
      items.map((study) => study.studyId),
    )
    if (pruned.length !== enabledIds.length) writeEnabledStudyIds(symbol, pruned)
  }, [items, enabledIds, symbol])

  function setEnabled(studyId: string, enabled: boolean) {
    const next = enabled ? [...enabledIds, studyId] : enabledIds.filter((id) => id !== studyId)
    writeEnabledStudyIds(symbol, next)
  }

  return (
    <section aria-label="Studies" data-testid="indicator-studies-group" className="space-y-2">
      <h3 className="text-silver-300 mb-2 px-3 text-[10px] font-semibold tracking-[0.08em] uppercase">
        Studies
      </h3>

      {listQuery.isPending && (
        <p role="status" className="text-silver-300 px-3 text-xs">
          Loading studies…
        </p>
      )}

      {listQuery.isError && (
        <div role="alert" className="space-y-2 px-3 text-xs">
          <p className="text-rose-300">{indicatorRequestErrorMessage(listQuery.error)}</p>
          <Button variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
            Retry studies
          </Button>
        </div>
      )}

      {items && items.length === 0 && (
        <p className="text-silver-300 px-3 text-xs">
          No studies published for {symbol}. Publish one with research.publish_study().
        </p>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-1">
          {items.map((study) => {
            const onThisTimeframe = study.timeframe === apiTimeframe
            const enabled = enabledIds.includes(study.studyId)
            const renaming = renamingId === study.studyId
            const confirming = confirmingId === study.studyId
            return (
              <li
                key={study.studyId}
                data-testid={`study-item-${study.studyId}`}
                className="surface-control space-y-1 rounded-md px-3 py-2 text-xs"
              >
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Draw ${study.name}`}
                    checked={enabled && onThisTimeframe}
                    disabled={!onThisTimeframe}
                    onChange={(event) => setEnabled(study.studyId, event.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-silver-100 block font-semibold">{study.name}</span>
                    <span className="text-silver-300 block">
                      {onThisTimeframe
                        ? `${study.timeframe} · updated ${new Date(study.updatedAt).toLocaleString()}`
                        : `Published at ${study.timeframe}`}
                    </span>
                    {study.notes && <span className="text-silver-300 block">{study.notes}</span>}
                  </span>
                </label>

                {renaming ? (
                  <form
                    className="flex items-center gap-2 pl-6"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const name = draftName.trim()
                      if (!name) return
                      rename.mutate(
                        { studyId: study.studyId, name },
                        { onSuccess: () => setRenamingId(null) },
                      )
                    }}
                  >
                    <input
                      aria-label={`New name for ${study.name}`}
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      className="surface-well text-silver-100 min-w-0 flex-1 rounded px-2 py-1"
                    />
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRenamingId(null)}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : confirming ? (
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-silver-200">Delete this study?</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        remove.mutate(study.studyId, {
                          onSuccess: () => {
                            setConfirmingId(null)
                            setEnabled(study.studyId, false)
                          },
                        })
                      }
                    >
                      Confirm delete
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 pl-6">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Rename ${study.name}`}
                      onClick={() => {
                        setDraftName(study.name)
                        setRenamingId(study.studyId)
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Delete ${study.name}`}
                      onClick={() => setConfirmingId(study.studyId)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
                {renaming && rename.isError && (
                  <p role="alert" className="pl-6 text-rose-300">
                    {indicatorRequestErrorMessage(rename.error)}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
