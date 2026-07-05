import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ChartSettingsPopover } from '@/components/charts/ChartSettingsPopover'
import { DEFAULT_SETTINGS } from '@/components/charts/types/chart'

describe('Chart overlay migrations', () => {
  it('opens chart settings popover content', async () => {
    const user = userEvent.setup()

    render(<ChartSettingsPopover settings={DEFAULT_SETTINGS} onChange={() => undefined} />)

    await user.click(screen.getByRole('button', { name: 'Chart Settings' }))
    expect(await screen.findByText('Background Theme')).toBeInTheDocument()
  })
})
