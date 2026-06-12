import { format } from 'date-fns'

export function formatConfigSummaryRange(startDate: Date, endDate: Date): string {
  return `${format(startDate, 'yyyy-MM-dd')} → ${format(endDate, 'yyyy-MM-dd')}`
}
