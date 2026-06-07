import { cn } from '@/lib/utils'

type ChartEmptyStateProps = {
  message: string
  className?: string
}

export function ChartEmptyState({ message, className }: ChartEmptyStateProps) {
  return (
    <div
      className={cn(
        'border-carbon-600 bg-carbon-900/30 flex h-48 items-center justify-center rounded-lg border border-dashed',
        className,
      )}
    >
      <p className="text-silver-400 text-sm">{message}</p>
    </div>
  )
}
