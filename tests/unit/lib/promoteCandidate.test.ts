import { describe, expect, it } from 'vitest'

import {
  buildBacktestRequestFromCandidate,
  buildOptimizationConfigFromCandidate,
} from '@/lib/discover/promoteCandidate'
import { mockSampleGenome } from '@/mocks/strategySearch'
import type { CandidateResult, StrategySearchConfig } from '@/types/strategySearch'

const registryCandidate: CandidateResult = {
  candidate_id: 'MACrossover',
  strategy: 'MACrossover',
  status: 'completed',
  rank: 1,
  objective_value: 1.42,
  robustness_score: 1.42,
  efficiency: 0.68,
  gate_flags: [],
  passed_gates: true,
  oos_metrics: { total_trades: 24, sharpe_ratio: 1.05 },
  is_metrics_summary: { mean_objective: 2.08, window_count: 3 },
  best_params: { short_period: 8, long_period: 21, quantity: 1.2 },
  window_count: 3,
  completed_windows: 3,
  error: null,
}

const geneticCandidate: CandidateResult = {
  candidate_id: 'genome-champion-001',
  strategy: 'CompositeStrategy',
  status: 'completed',
  rank: 1,
  objective_value: 1.28,
  robustness_score: 1.28,
  efficiency: 0.71,
  gate_flags: [],
  passed_gates: true,
  oos_metrics: { total_trades: 18, sharpe_ratio: 0.88 },
  is_metrics_summary: { mean_objective: 1.95, window_count: 3 },
  best_params: { strategy_params: { sma_period: 12 }, quantity: 1.0 },
  window_count: 3,
  completed_windows: 3,
  error: null,
  genome: mockSampleGenome,
  generation: 5,
  genome_node_count: 3,
  dsr: 0.62,
}

const backtest = {
  symbol: 'PETR4',
  timeframe: 'D1',
  start: '2023-01-01T00:00:00Z',
  end: '2023-12-31T00:00:00Z',
  initial_capital: 100000,
  point_value: 1,
  strategy: 'MACrossover',
}

const searchConfig: StrategySearchConfig = {
  backtest,
  objective: { mode: 'maximize_return_drawdown' },
  walkforward: { train_days: 180, test_days: 30, mode: 'rolling', min_windows: 2 },
  study: { name: 'PETR4 discovery', n_trials: 20, seed: 42, pruner: 'none' },
  strategies: null,
}

describe('promoteCandidate', () => {
  it('builds unchanged registry backtest payload', () => {
    const payload = buildBacktestRequestFromCandidate(registryCandidate, backtest)
    expect(payload.strategy).toBe('MACrossover')
    expect(payload.strategy_params).toEqual({ short_period: 8, long_period: 21 })
    expect(payload.position_sizing).toEqual(
      expect.objectContaining({ type: 'fixed_quantity', quantity: 1.2 }),
    )
    expect('genome' in (payload.strategy_params ?? {})).toBe(false)
  })

  it('builds CompositeStrategy payload with genome for genetic candidate', () => {
    const payload = buildBacktestRequestFromCandidate(geneticCandidate, {
      ...backtest,
      strategy: 'CompositeStrategy',
    })
    expect(payload.strategy).toBe('CompositeStrategy')
    expect(payload.strategy_params).toEqual({
      sma_period: 12,
      genome: mockSampleGenome,
    })
    expect(payload.position_sizing).toEqual(
      expect.objectContaining({ type: 'fixed_quantity', quantity: 1 }),
    )
  })

  it('builds genetic optimization config with CompositeStrategy backtest', () => {
    const config = buildOptimizationConfigFromCandidate(geneticCandidate, {
      ...searchConfig,
      genetic: {
        population_size: 40,
        generations: 10,
        elite_count: 4,
        crossover_rate: 0.7,
        mutation_rate: 0.15,
        tournament_size: 3,
        max_nodes: 24,
        max_depth: 12,
        complexity_lambda: 0.001,
        complexity_mu: 0.0005,
      },
    })
    expect(config.backtest.strategy).toBe('CompositeStrategy')
    expect(config.search_space.strategy_params).toEqual({
      sma_period: 12,
      genome: mockSampleGenome,
    })
  })

  it('does not include exit diagnostic fields in promoted strategy_params', () => {
    const candidateWithExitMetadata: CandidateResult = {
      ...registryCandidate,
      exit_preset_id: 'chandelier',
      exit_preset_label: 'Chandelier trail',
      exit_quality: {
        total_closed_trades: 10,
        by_reason: { signal: { trades: 10, total_pnl: 500, win_rate: 0.5 } },
      },
      best_params: {
        short_period: 8,
        long_period: 21,
        quantity: 1.2,
        chandelier_atr_mult: 2.5,
      },
    }

    const payload = buildBacktestRequestFromCandidate(candidateWithExitMetadata, backtest)
    expect(payload.strategy_params).toEqual({
      short_period: 8,
      long_period: 21,
      chandelier_atr_mult: 2.5,
    })
    expect(payload.strategy_params).not.toHaveProperty('exit_quality')
    expect(payload.strategy_params).not.toHaveProperty('exit_preset_id')
  })

  it('passes explicit backend exit params from best_params through promotion', () => {
    const candidateWithExitParams: CandidateResult = {
      ...registryCandidate,
      best_params: {
        short_period: 8,
        long_period: 21,
        quantity: 1.0,
        stop_loss_pct: 0.02,
        take_profit_pct: 0.04,
      },
    }

    const payload = buildBacktestRequestFromCandidate(candidateWithExitParams, backtest)
    expect(payload.strategy_params).toEqual({
      short_period: 8,
      long_period: 21,
      stop_loss_pct: 0.02,
      take_profit_pct: 0.04,
    })
  })
})
