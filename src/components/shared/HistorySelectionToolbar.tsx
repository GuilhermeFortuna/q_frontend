import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type HistorySelectionToolbarProps = {
  selectionMode: boolean
  selectedCount: number
  pageItemCount: number
  onEnterSelection: () => void
  onExitSelection: () => void
  onSelectAllPage: () => void
  onDeleteSelected: () => void
  onCompareSelected?: () => void
  compareEnabled?: boolean
  deleting?: boolean
}

export function HistorySelectionToolbar({
  selectionMode,
  selectedCount,
  pageItemCount,
  onEnterSelection,
  onExitSelection,
  onSelectAllPage,
  onDeleteSelected,
  onCompareSelected,
  compareEnabled = false,
  deleting = false,
}: HistorySelectionToolbarProps) {
  if (!selectionMode) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-silver-400 hover:text-silver-100 h-7 px-2 text-xs"
        onClick={onEnterSelection}
      >
        Select
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-silver-400 hover:text-silver-100 h-7 px-2 text-xs"
        onClick={onExitSelection}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pageItemCount === 0}
        className="text-silver-400 hover:text-silver-100 h-7 px-2 text-xs"
        onClick={onSelectAllPage}
      >
        Select all on page
      </Button>
      {onCompareSelected ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!compareEnabled}
          className={cn(
            'h-7 px-2 text-xs',
            compareEnabled
              ? 'text-brass-400 hover:bg-brass-500/10 hover:text-brass-300'
              : 'text-silver-500',
          )}
          onClick={onCompareSelected}
        >
          Compare ({selectedCount})
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={selectedCount === 0 || deleting}
        className={cn(
          'h-7 px-2 text-xs',
          selectedCount > 0
            ? 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300'
            : 'text-silver-500',
        )}
        onClick={onDeleteSelected}
      >
        Delete ({selectedCount})
      </Button>
    </div>
  )
}

export function formatBulkDeleteDescription(labels: string[], itemLabel: string): string {
  if (labels.length === 0) {
    return `Delete selected ${itemLabel}? This cannot be undone.`
  }
  if (labels.length === 1) {
    return `Delete "${labels[0]}"? This cannot be undone.`
  }
  if (labels.length === 2) {
    return `Delete "${labels[0]}" and "${labels[1]}"? This cannot be undone.`
  }
  return `Delete "${labels[0]}", "${labels[1]}", and ${labels.length - 2} more ${itemLabel}? This cannot be undone.`
}
