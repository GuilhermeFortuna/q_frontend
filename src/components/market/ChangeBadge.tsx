type ChangeBadgeProps = {
  changePct: number
  className?: string
}

export function ChangeBadge({ changePct, className = '' }: ChangeBadgeProps) {
  const isUp = changePct >= 0

  return (
    <span
      className={`quant-tabular-nums font-mono ${isUp ? 'text-emerald-400' : 'text-rose-400'} ${className}`}
    >
      {isUp ? '▲ +' : '▼ '}
      {changePct.toFixed(2)}%
    </span>
  )
}
