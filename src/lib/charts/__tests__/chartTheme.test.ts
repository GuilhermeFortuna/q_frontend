import { describe, expect, it } from 'vitest'

import { chartTheme } from '@/lib/charts/chartTheme'

/** Tailwind emerald-400 / rose-400 — must match StatTile delta tones */
const STAT_TILE_UP = '#34d399'
const STAT_TILE_DOWN = '#fb7185'

describe('chartTheme (WO198)', () => {
  it('exports stable furniture tokens for axes and grids', () => {
    expect(chartTheme.axis.stroke).toBe('rgba(255, 255, 255, 0.10)')
    expect(chartTheme.grid.stroke).toBe('rgba(255, 255, 255, 0.045)')
    expect(chartTheme.grid.dash).toBeUndefined()
    expect(chartTheme.axis.tick.fill).toBe('var(--color-silver-400)')
    expect(chartTheme.axis.tick.fontSize).toBe(10.5)
  })

  it('series palette has no duplicate entries', () => {
    const palette = chartTheme.series.palette
    expect(new Set(palette).size).toBe(palette.length)
    expect(palette.length).toBeGreaterThanOrEqual(4)
  })

  it('pos/neg semantic colors align with StatTile tones', () => {
    expect(chartTheme.semantic.positive).toBe(STAT_TILE_UP)
    expect(chartTheme.semantic.negative).toBe(STAT_TILE_DOWN)
    expect(chartTheme.semantic.drawdown).toBe(STAT_TILE_DOWN)
  })

  it('exports shared margin and crosshair tokens', () => {
    expect(chartTheme.margin).toEqual({ top: 8, right: 16, left: 8, bottom: 0 })
    expect(chartTheme.crosshair.stroke).toMatch(/^rgba\(/)
    expect(chartTheme.baseline.stroke).toMatch(/^rgba\(/)
  })
})
