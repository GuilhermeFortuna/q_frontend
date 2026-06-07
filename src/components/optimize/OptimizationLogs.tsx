import type { OptimizationResults } from '@/types/optimization'

type OptimizationLogsProps = {
  results: OptimizationResults
}

export function OptimizationLogs({ results }: OptimizationLogsProps) {
  const prunedOrError = results.trials.filter((t) => {
    const status = t.user_attrs.status ?? t.state.toLowerCase()
    return status === 'pruned' || status === 'error' || t.user_attrs.error
  })

  const hasLogs = prunedOrError.length > 0 || results.failures.length > 0

  if (!hasLogs) {
    return (
      <div className="border-carbon-600/40 flex flex-1 items-center justify-center rounded-lg border p-8">
        <p className="text-silver-400 text-sm">No pruned or failed trials in this study.</p>
      </div>
    )
  }

  return (
    <div className="border-carbon-600/40 flex min-h-0 flex-1 flex-col rounded-lg border">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-silver-400 bg-carbon-900 sticky top-0">
            <tr className="border-carbon-600/40 border-b">
              <th className="px-3 py-2 font-medium">Trial</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">Message</th>
            </tr>
          </thead>
          <tbody>
            {prunedOrError.map((trial) => (
              <tr key={trial.number} className="text-silver-200 border-carbon-700/40 border-b">
                <td className="px-3 py-2">#{trial.number}</td>
                <td className="px-3 py-2">{trial.user_attrs.status ?? trial.state}</td>
                <td className="text-silver-400 px-3 py-2">{trial.user_attrs.error ?? '—'}</td>
              </tr>
            ))}
            {results.failures.map((failure) => (
              <tr
                key={`failure-${failure.trial_number}`}
                className="text-silver-200 border-carbon-700/40 border-b"
              >
                <td className="px-3 py-2">#{failure.trial_number}</td>
                <td className="px-3 py-2">error</td>
                <td className="text-silver-400 px-3 py-2">{failure.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
