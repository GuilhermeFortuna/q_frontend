import { useState } from 'react'

import { VirtualTableScroller } from '@/components/shared/VirtualTableBody'
import {
  formatObjectiveMetricValue,
  objectiveMetricLabel,
  objectiveMetricValue,
} from '@/lib/walkforward/objectiveMetric'
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

const ROW_HEIGHT = 44

export function WalkForwardWindowsTable({ windows, objectiveMode }: WalkForwardWindowsTableProps) {
  const renderWindowRow = (window: WalkForwardWindowResult) => {
    const isValue = objectiveMetricValue(window.is_metrics, objectiveMode)
    const oosValue = objectiveMetricValue(window.oos_metrics, objectiveMode)
    const oosWorse =
      window.status === 'completed' && isValue != null && oosValue != null && oosValue < isValue

    return (
      <tr
        key={window.index}
        className={
          window.status === 'no_result'
            ? 'border-carbon-700/40 border-t bg-amber-500/5'
            : oosWorse
              ? 'border-carbon-700/40 border-t bg-rose-500/5'
              : 'border-carbon-700/40 border-t'
        }
      >
        <td className="text-silver-200 px-3 py-2 font-medium">
          {window.index + 1}
          {window.status === 'no_result' ? (
            <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
              no result
            </span>
          ) : null}
        </td>
        <td className="text-silver-400 px-3 py-2 whitespace-nowrap">
          {window.train_start.slice(0, 10)} → {window.train_end.slice(0, 10)}
        </td>
        <td className="text-silver-400 px-3 py-2 whitespace-nowrap">
          {window.test_start.slice(0, 10)} → {window.test_end.slice(0, 10)}
        </td>
        <td className="px-3 py-2">
          <ParamsPreview params={window.best_params} />
        </td>
        <td className="text-silver-200 px-3 py-2 tabular-nums">
          {formatObjectiveMetricValue(isValue, objectiveMode)}
        </td>
        <td
          className={
            oosWorse
              ? 'px-3 py-2 text-rose-400 tabular-nums'
              : 'text-silver-200 px-3 py-2 tabular-nums'
          }
        >
          {formatObjectiveMetricValue(oosValue, objectiveMode)}
        </td>
      </tr>
    )
  }

  return (
    <div className="border-carbon-600/40 overflow-hidden rounded-lg border">
      <VirtualTableScroller
        items={windows}
        rowHeight={ROW_HEIGHT}
        colSpan={6}
        className="max-h-[min(60vh,520px)] overflow-x-auto"
        tableClassName="min-w-[720px] text-xs"
        theadClassName="bg-carbon-900/80 tracking-wide uppercase"
        getItemKey={(index) => windows[index]!.index}
        header={
          <tr>
            <th className="px-3 py-2 font-medium">Window</th>
            <th className="px-3 py-2 font-medium">Train</th>
            <th className="px-3 py-2 font-medium">Test</th>
            <th className="px-3 py-2 font-medium">Best params</th>
            <th className="px-3 py-2 font-medium">IS {objectiveMetricLabel(objectiveMode)}</th>
            <th className="px-3 py-2 font-medium">OOS {objectiveMetricLabel(objectiveMode)}</th>
          </tr>
        }
        renderRow={(window) => renderWindowRow(window)}
      />
    </div>
  )
}
