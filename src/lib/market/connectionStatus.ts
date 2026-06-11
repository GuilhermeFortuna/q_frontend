import { isMt5OfflineError } from '@/api/queries/market-data'
import type { Mt5ConnectionStatus } from '@/components/market/types'

export function resolveMt5ConnectionStatus(
  snapshotLoading: boolean,
  snapshotData: unknown,
  snapshotError: unknown,
  snapshotsError: unknown,
): Mt5ConnectionStatus {
  if (snapshotLoading && !snapshotData) {
    return 'connecting'
  }
  if (isMt5OfflineError(snapshotError) || isMt5OfflineError(snapshotsError)) {
    return 'offline'
  }
  return 'live'
}
