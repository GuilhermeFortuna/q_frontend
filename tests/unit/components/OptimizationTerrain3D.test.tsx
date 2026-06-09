/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OptimizationTerrain3D } from '@/components/optimize/OptimizationTerrain3D'
import type { OptimizationResults } from '@/types/optimization'

// Mock react-three-fiber and react-three-drei
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="mock-canvas">{children}</div>,
  useThree: () => ({
    camera: { position: { set: vi.fn() }, lookAt: vi.fn() },
  }),
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: React.forwardRef((_, ref) => (
    <div data-testid="orbit-controls" ref={ref as any} />
  )),
  Line: ({ points, color }: any) => (
    <div data-testid="mock-line" data-points={JSON.stringify(points)} data-color={color} />
  ),
  Points: ({ children }: any) => <div data-testid="mock-points">{children}</div>,
  PointMaterial: () => <div data-testid="mock-point-material" />,
}))

const mockResults: OptimizationResults = {
  study_id: 'study_123',
  objective_mode: 'maximize_sharpe',
  is_multi_objective: false,
  best_params: { short_period: 12, long_period: 35 },
  best_trial: {
    number: 1,
    params: { short_period: 12, long_period: 35, quantity: 1.0 },
    values: [2.5],
    state: 'COMPLETE',
    user_attrs: {
      status: 'COMPLETE',
      metrics: { total_pnl: 15000, sharpe_ratio: 2.5, max_drawdown_pct: 10.0 },
      strategy_params: { short_period: 12, long_period: 35 },
      risk_params: { type: 'fixed_quantity', quantity: 1.0 },
    },
  },
  trials: [
    {
      number: 0,
      params: { short_period: 8, long_period: 25, quantity: 0.5 },
      values: [1.2],
      state: 'COMPLETE',
      user_attrs: {
        status: 'COMPLETE',
        metrics: { total_pnl: 8000, sharpe_ratio: 1.2, max_drawdown_pct: 15.0 },
        strategy_params: { short_period: 8, long_period: 25 },
        risk_params: { type: 'fixed_quantity', quantity: 0.5 },
      },
    },
    {
      number: 1,
      params: { short_period: 12, long_period: 35, quantity: 1.0 },
      values: [2.5],
      state: 'COMPLETE',
      user_attrs: {
        status: 'COMPLETE',
        metrics: { total_pnl: 15000, sharpe_ratio: 2.5, max_drawdown_pct: 10.0 },
        strategy_params: { short_period: 12, long_period: 35 },
        risk_params: { type: 'fixed_quantity', quantity: 1.0 },
      },
    },
  ],
  pareto_trials: [],
  failures: [],
}

describe('OptimizationTerrain3D', () => {
  it('renders dropdown selectors and display options in sidebar', () => {
    render(
      <OptimizationTerrain3D
        results={mockResults}
        selectedTrialNumber={null}
        onSelectTrial={vi.fn()}
      />,
    )

    // Check selectors
    expect(screen.getByLabelText(/X Axis \(Width\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Y Axis \(Depth\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Z Axis \(Height\)/i)).toBeInTheDocument()

    // Check buttons
    expect(screen.getByText(/Hide Wireframe Grid/i)).toBeInTheDocument()
    expect(screen.getByText(/Hide Ambient Dust/i)).toBeInTheDocument()
    expect(screen.getByText(/Reset 3D Camera/i)).toBeInTheDocument()
  })

  it('renders trial markers inside the 3D canvas', () => {
    render(
      <OptimizationTerrain3D
        results={mockResults}
        selectedTrialNumber={null}
        onSelectTrial={vi.fn()}
      />,
    )

    // Verify mock canvas is loaded
    expect(screen.getByTestId('mock-canvas')).toBeInTheDocument()

    // Verify trial markers are rendered as mesh elements with test ids
    expect(screen.getByTestId('trial-marker-0')).toBeInTheDocument()
    expect(screen.getByTestId('trial-marker-1')).toBeInTheDocument()
  })

  it('calls onSelectTrial when clicking on a trial marker', () => {
    const onSelectTrial = vi.fn()
    render(
      <OptimizationTerrain3D
        results={mockResults}
        selectedTrialNumber={null}
        onSelectTrial={onSelectTrial}
      />,
    )

    // Click trial marker 0
    fireEvent.click(screen.getByTestId('trial-marker-0'))
    expect(onSelectTrial).toHaveBeenCalledWith(0)
  })

  it('displays the HUD with selected trial information', () => {
    render(
      <OptimizationTerrain3D
        results={mockResults}
        selectedTrialNumber={1}
        onSelectTrial={vi.fn()}
      />,
    )

    // HUD details for Selected Trial #1
    expect(screen.getByText('Trial #1')).toBeInTheDocument()
    expect(screen.getByText('Selected Trial')).toBeInTheDocument()
    expect(screen.getByText(/Objective Value:/i)).toBeInTheDocument()
    expect(screen.getAllByText(/2.5000/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\$15000/i).length).toBeGreaterThan(0) // PnL
  })

  it('displays fallback state when there are no completed trials', () => {
    const emptyResults: OptimizationResults = {
      ...mockResults,
      trials: [],
      best_trial: null,
    }

    render(
      <OptimizationTerrain3D
        results={emptyResults}
        selectedTrialNumber={null}
        onSelectTrial={vi.fn()}
      />,
    )

    expect(
      screen.getByText(/No completed trials available to render landscape/i),
    ).toBeInTheDocument()
  })
})
