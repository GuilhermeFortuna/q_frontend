type SkeletonBarProps = {
  className?: string
}

export function SkeletonBar({ className = '' }: SkeletonBarProps) {
  return <div className={`bg-carbon-800 animate-pulse rounded ${className}`} aria-hidden="true" />
}
