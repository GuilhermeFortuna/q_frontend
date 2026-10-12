import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader } from '@/components/ui/Dialog'
import type { TickPeriod } from '@/lib/backtesting/tickCoverage'

type TickCoverageNoticeProps = {
  open: boolean
  symbol: string
  requested: TickPeriod
  used: TickPeriod
  onConfirm: () => void
  onCancel: () => void
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const formatPeriod = ({ start, end }: TickPeriod) =>
  `${formatDateTime(start)} – ${formatDateTime(end)}`

export function TickCoverageNotice({
  open,
  symbol,
  requested,
  used,
  onConfirm,
  onCancel,
}: TickCoverageNoticeProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) onCancel()
      }}
    >
      <DialogContent size="md" data-testid="tick-coverage-notice">
        <DialogHeader title="Tick history is shorter than the selected period" />
        <DialogDescription className="text-silver-400 mt-2 space-y-2 text-sm">
          <span className="block">
            This simulation replays historical ticks, and the tick data available for {symbol} does
            not cover the selected period ({formatPeriod(requested)}).
          </span>
          <span className="block">
            The simulation will use the available tick period instead:{' '}
            <strong data-testid="tick-coverage-used-period">{formatPeriod(used)}</strong>.
          </span>
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            data-testid="tick-coverage-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="brass"
            onClick={onConfirm}
            data-testid="tick-coverage-confirm"
          >
            Run with available period
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
