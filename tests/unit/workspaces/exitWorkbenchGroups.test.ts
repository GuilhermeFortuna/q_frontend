import { describe, expect, it } from 'vitest'

import {
  EXIT_GROUP_LABELS,
  EXIT_GROUP_OTHER_LABEL,
  groupExitParamSpecs,
  partitionStrategyParamSpecs,
} from '@/workspaces/strategy/exitWorkbenchGroups'
import type { StrategyParamSpec } from '@/types/strategies'

const mockSpecs: StrategyParamSpec[] = [
  {
    name: 'period',
    label: 'Period',
    type: 'int',
    default: 14,
    hint: 'Entry lookback.',
  },
  {
    name: 'fixed_sl',
    label: 'Fixed SL',
    type: 'float',
    default: 0.0,
    exit_group: 'stop_loss',
    hint: 'Stop loss hint.',
  },
  {
    name: 'trail_pct',
    label: 'Trail Pct',
    type: 'float',
    default: 0.0,
    exit_group: 'trailing',
    hint: 'Trailing hint.',
  },
  {
    name: 'take_profit',
    label: 'Take Profit',
    type: 'float',
    default: 0.0,
    exit_group: 'target',
    hint: 'Target hint.',
  },
  {
    name: 'max_bars',
    label: 'Max Bars',
    type: 'int',
    default: 0,
    exit_group: 'time',
    hint: 'Time stop hint.',
  },
  {
    name: 'future_rule',
    label: 'Future Rule',
    type: 'float',
    default: 0.0,
    exit_group: 'channel' as StrategyParamSpec['exit_group'],
    hint: 'Unknown group hint.',
  },
]

describe('partitionStrategyParamSpecs', () => {
  it('splits entry and exit specs by exit_group', () => {
    const { entryParamSpecs, exitParamSpecs } = partitionStrategyParamSpecs(mockSpecs)

    expect(entryParamSpecs.map((spec) => spec.name)).toEqual(['period'])
    expect(exitParamSpecs.map((spec) => spec.name)).toEqual([
      'fixed_sl',
      'trail_pct',
      'take_profit',
      'max_bars',
      'future_rule',
    ])
  })
})

describe('groupExitParamSpecs', () => {
  it('renders one group per present exit_group in fixed order', () => {
    const { exitParamSpecs } = partitionStrategyParamSpecs(mockSpecs)
    const grouped = groupExitParamSpecs(exitParamSpecs)

    expect(grouped.map(({ label }) => label)).toEqual([
      EXIT_GROUP_LABELS.stop_loss,
      EXIT_GROUP_LABELS.trailing,
      EXIT_GROUP_LABELS.target,
      EXIT_GROUP_LABELS.time,
      EXIT_GROUP_OTHER_LABEL,
    ])
  })

  it('omits groups with no specs', () => {
    const grouped = groupExitParamSpecs([
      {
        name: 'trail_pct',
        label: 'Trail Pct',
        type: 'float',
        default: 0.0,
        exit_group: 'trailing',
      },
    ])

    expect(grouped).toEqual([
      {
        group: 'trailing',
        label: EXIT_GROUP_LABELS.trailing,
        specs: [
          expect.objectContaining({
            name: 'trail_pct',
          }),
        ],
      },
    ])
  })

  it('places unknown exit_group values under Other Exits', () => {
    const grouped = groupExitParamSpecs([
      {
        name: 'future_rule',
        label: 'Future Rule',
        type: 'float',
        default: 0.0,
        exit_group: 'channel' as StrategyParamSpec['exit_group'],
        hint: 'Unknown group hint.',
      },
    ])

    expect(grouped).toEqual([
      {
        group: 'other',
        label: EXIT_GROUP_OTHER_LABEL,
        specs: [
          expect.objectContaining({
            name: 'future_rule',
            hint: 'Unknown group hint.',
          }),
        ],
      },
    ])
  })
})
