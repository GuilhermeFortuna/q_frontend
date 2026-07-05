import { useMemo, useState } from 'react'

import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { Panel } from '@/components/ui/Panel'
import {
  formatObjectiveMetricValue,
  objectiveMetricLabel,
  objectiveMetricValue,
} from '@/lib/walkforward/objectiveMetric'
import { cn } from '@/lib/utils'
import type { ObjectiveMode } from '@/types/optimization'
import type { WalkForwardWindowResult } from '@/types/walkforward'

type WalkForwardWindowsTableProps = {
  windows: WalkForwardWindowResult[]
  objectiveMode: ObjectiveMode
}

function ParamsPreview({ params }: { params: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const compact = Object.entries(params)
    .slice(0, 3)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ')

  if (Object.keys(params).length === 0) {
    return <span className="text-silver-500">—</span>
  }

  return (
    <div>
      <button
        type="button"
        className="text-brass-400 hover:text-brass-300 text-left text-xs underline-offset-2 hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {compact || 'View params'}
      </button>
      {open ? (
        <pre className="text-silver-300 bg-carbon-950/60 mt-1 max-w-xs overflow-x-auto rounded p-2 text-[10px]">
          {JSON.stringify(params, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}

const ROW_HEIGHT = 34

export function WalkForwardWindowsTable({ windows, objectiveMode }: WalkForwardWindowsTableProps) {
  const isLabel = objectiveMetricLabel(objectiveMode)
  const oosLabel = objectiveMetricLabel(objectiveMode)

  const columns = useMemo<DataColumn<WalkForwardWindowResult>[]>(
    () => [
      {
        id: 'window',
        header: 'Window',
        render: (window) => (
          <span className="text-silver-200 font-medium">
            {window.index + 1}
            {window.status === 'no_result' ? (
              <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                no result
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'train',
        header: 'Train',
        render: (window) => (
          <span className="text-silver-400 whitespace-nowrap">
            {window.train_start.slice(0, 10)} → {window.train_end.slice(0, 10)}
          </span>
        ),
      },
      {
        id: 'test',
        header: 'Test',
        render: (window) => (
          <span className="text-silver-400 whitespace-nowrap">
            {window.test_start.slice(0, 10)} → {window.test_end.slice(0, 10)}
          </span>
        ),
      },
      {
        id: 'params',
        header: 'Best params',
        render: (window) => <ParamsPreview params={window.best_params} />,
      },
      {
        id: 'is',
        header: `IS ${isLabel}`,
        align: 'right',
        numeric: true,
        render: (window) => (
          <span className="text-silver-200">
            {formatObjectiveMetricValue(
              objectiveMetricValue(window.is_metrics, objectiveMode),
              objectiveMode,
            )}
          </span>
        ),
      },
      {
        id: 'oos',
        header: `OOS ${oosLabel}`,
        align: 'right',
        numeric: true,
        render: (window) => {
          const isValue = objectiveMetricValue(window.is_metrics, objectiveMode)
          const oosValue = objectiveMetricValue(window.oos_metrics, objectiveMode)
          const oosWorse =
            window.status === 'completed' &&
            isValue != null &&
            oosValue != null &&
            oosValue < isValue
          return (
            <span className={cn(oosWorse ? 'text-rose-400' : 'text-silver-200')}>
              {formatObjectiveMetricValue(oosValue, objectiveMode)}
            </span>
          )
        },
      },
    ],
    [isLabel, objectiveMode, oosLabel],
  )

  return (
    <Panel className="overflow-hidden p-0">
      <DataTable
        columns={columns}
        rows={windows}
        rowKey={(window) => window.index}
        getRowClassName={(window) => {
          const isValue = objectiveMetricValue(window.is_metrics, objectiveMode)
          const oosValue = objectiveMetricValue(window.oos_metrics, objectiveMode)
          const oosWorse =
            window.status === 'completed' &&
            isValue != null &&
            oosValue != null &&
            oosValue < isValue
          return cn(window.status === 'no_result' && 'bg-amber-500/5', oosWorse && 'bg-rose-500/5')
        }}
        virtualize={{ rowHeight: ROW_HEIGHT }}
        scrollContainerClassName="max-h-[min(60vh,520px)] overflow-x-auto"
        tableClassName="min-w-[720px] text-xs"
        theadClassName="tracking-wide uppercase"
      />
    </Panel>
  )
}
