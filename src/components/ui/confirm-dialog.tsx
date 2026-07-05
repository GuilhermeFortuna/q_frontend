import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader } from '@/components/ui/Dialog'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) onCancel()
      }}
    >
      <DialogContent size="md" data-testid="confirm-dialog">
        <DialogHeader title={title} />
        <DialogDescription id="confirm-dialog-description" className="text-silver-400 mt-2 text-sm">
          {description}
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
            data-testid="confirm-dialog-cancel"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-rose-500/40 text-rose-400 hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-300"
            onClick={onConfirm}
            disabled={loading}
            data-testid="confirm-dialog-confirm"
          >
            {loading ? 'Deleting…' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
