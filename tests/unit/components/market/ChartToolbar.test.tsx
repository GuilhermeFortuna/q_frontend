import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_INDICATORS, DEFAULT_SETTINGS } from '@/components/charts/types/chart'
import { ChartToolbar } from '@/components/market/ChartToolbar'

describe('ChartToolbar', () => {
  it('renders timeframe controls and updates chart type', async () => {
    const user = userEvent.setup()
    const onChartTypeChange = vi.fn()

    render(
      <ChartToolbar
        selectedTimeframe="1D"
        onTimeframeChange={vi.fn()}
        chartType="candles"
        onChartTypeChange={onChartTypeChange}
        indicators={DEFAULT_INDICATORS}
        onIndicatorsChange={vi.fn()}
        showGrid
        onShowGridChange={vi.fn()}
        chartSettings={DEFAULT_SETTINGS}
        onChartSettingsChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '1D' })).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox'), 'line')
    expect(onChartTypeChange).toHaveBeenCalledWith('line')
  })
})
