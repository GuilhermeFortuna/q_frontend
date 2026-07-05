import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { StatTile } from '@/components/ui/StatTile'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

const globalsCssPath = resolve(__dirname, '../../../styles/globals.css')
const globalsCss = readFileSync(globalsCssPath, 'utf8')

describe('Typography & Numeric Discipline', () => {
  it('verifies that globals.css defines font variables and numeric contexts', () => {
    // Assert --font-sans is updated to 'Inter Variable'
    expect(globalsCss).toMatch(/--font-sans:\s*['"]Inter Variable['"]/)
    // Assert --font-display is defined
    expect(globalsCss).toMatch(/--font-display:\s*['"]Inter Display['"]/)

    // Assert font-variant-numeric is configured for numeric contexts
    expect(globalsCss).toContain('font-variant-numeric: tabular-nums slashed-zero')
    expect(globalsCss).toContain('.q-table-td')
    expect(globalsCss).toContain('.stat-tile-value')
  })

  it('renders StatTile and a q-table cell and asserts computed font-variant-numeric contains tabular-nums', () => {
    // Inject standard CSS classes into jsdom so computed styles work
    const styleEl = document.createElement('style')
    styleEl.innerHTML = `
      .stat-tile-value, .q-table-td {
        font-variant-numeric: tabular-nums slashed-zero;
      }
    `
    document.head.appendChild(styleEl)

    // Render StatTile
    const { container: statTileContainer } = render(<StatTile label="Sharpe Ratio" value="2.45" />)

    const valueEl = statTileContainer.querySelector('.stat-tile-value')
    expect(valueEl).toBeInTheDocument()
    if (valueEl) {
      const computedValue = window.getComputedStyle(valueEl)
      const fontVariant =
        computedValue.fontVariantNumeric || computedValue.getPropertyValue('font-variant-numeric')
      expect(fontVariant).toContain('tabular-nums')
      // Also verify it uses font-display and tracking-display
      expect(valueEl).toHaveClass('font-display')
      expect(valueEl).toHaveClass('tracking-display')
    }

    // Render q-table
    const { container: tableContainer } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>123.45</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )

    const cellEl = tableContainer.querySelector('.q-table-td')
    expect(cellEl).toBeInTheDocument()
    if (cellEl) {
      const computedCell = window.getComputedStyle(cellEl)
      const fontVariant =
        computedCell.fontVariantNumeric || computedCell.getPropertyValue('font-variant-numeric')
      expect(fontVariant).toContain('tabular-nums')
    }
  })
})
