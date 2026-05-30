import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { OhlcvBar } from '@/types/api'

type OhlcvChartProps = {
  data: OhlcvBar[]
  symbol: string
}

export function OhlcvChart({ data, symbol }: OhlcvChartProps) {
  const chartData = data.map((bar) => ({
    ...bar,
    label: new Date(bar.timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-carbon-700)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--color-silver-400)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: 'var(--color-silver-400)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-carbon-800)',
              border: '1px solid var(--color-carbon-600)',
              borderRadius: '6px',
              color: 'var(--color-silver-100)',
              fontSize: 12,
            }}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as OhlcvBar | undefined
              return row ? `${symbol} · ${new Date(row.timestamp).toLocaleString()}` : symbol
            }}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="var(--color-brass-400)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-brass-500)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
