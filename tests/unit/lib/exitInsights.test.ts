import { describe, expect, it } from 'vitest'

import {
  candidateExitDisplayLabel,
  exitReasonRows,
  formatCaptureRatio,
  formatExitMetric,
  hasExitInsight,
  resolveExitQuality,
} from '@/lib/discover/exitInsights'
import type { CandidateResult, ExitQualitySummary } from '@/types/strategySearch'

describe('exitInsights helpers', () => {
  it('sorts exit reasons by total pnl descending', () => {
    const summary: ExitQualitySummary = {
      by_reason: {
        fixed_sl: { trades: 5, total_pnl: -1200 },
        chandelier: { trades: 9, total_pnl: 6800 },
        signal: { trades: 5, total_pnl: 600 },
      },
    }

    expect(exitReasonRows(summary).map((row) => row.reason)).toEqual([
      'chandelier',
      'signal',
      'fixed_sl',
    ])
  })

  it('formats null path-quality values without NaN', () => {
    expect(formatCaptureRatio(null)).toBe('—')
    expect(formatExitMetric(undefined)).toBe('—')
    expect(formatCaptureRatio(Number.NaN)).toBe('—')
  })

  it('resolves exit quality from diagnostics fallback', () => {
    const candidate = {
      exit_quality: null,
      diagnostics: {
        exit_quality: { total_closed_trades: 3 },
      },
    } as CandidateResult

    expect(resolveExitQuality(candidate)).toEqual({ total_closed_trades: 3 })
    expect(hasExitInsight(candidate)).toBe(true)
  })

  it('candidateExitDisplayLabel prefers preset over policy and falls back to Signal exit', () => {
    expect(
      candidateExitDisplayLabel({
        exit_preset_label: 'ATR Stop + Target',
        exit_policy_label: 'Fixed stop only',
      } as CandidateResult),
    ).toEqual({ label: 'ATR Stop + Target', explicit: true })

    expect(
      candidateExitDisplayLabel({
        exit_preset_label: null,
        exit_policy_label: 'Chandelier trail',
      } as CandidateResult),
    ).toEqual({ label: 'Chandelier trail', explicit: true })

    expect(
      candidateExitDisplayLabel({
        exit_preset_label: null,
        exit_policy_label: null,
      } as CandidateResult),
    ).toEqual({ label: 'Signal exit', explicit: false })
  })
})
