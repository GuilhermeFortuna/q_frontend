import type { StrategyFileListResponse, StrategyVersionResponse } from '../../contracts/api'

export const MOCK_STRATEGY_FILE_ID = 'session_breakout'
export const MOCK_STRATEGY_FILE_BUNDLE_HASH =
  '3f9a1c0d7b2e4a6915c8d0e2f7b41a93c6d5e0f8a2b7c49d1e3f6a0b8c2d4e5f'
export const MOCK_STRATEGY_VERSION_ID = '7c1e0a5d-2b9f-4e83-a6d1-5f0c9b8e2a47'

export const mockStrategyFiles: StrategyFileListResponse = {
  strategy_files: [
    {
      id: MOCK_STRATEGY_FILE_ID,
      label: 'Session breakout',
      description:
        'Buy when a bar closes above the session opening range, at most once per session.',
      class_name: 'SessionBreakout',
      bundle_hash: MOCK_STRATEGY_FILE_BUNDLE_HASH,
      valid: true,
      error: null,
      parameters: [
        {
          name: 'range_bars',
          label: 'Opening range bars',
          type: 'int',
          default: 12,
          min: 1,
          max: 24,
          step: 1,
        },
        { name: 'enter_after', label: 'Enter after', type: 'time', default: '10:00' },
        { name: 'use_filter', label: 'Use filter', type: 'bool', default: true },
      ],
      uses_tick_hooks: false,
      requires_tick_data: false,
    },
    {
      id: 'broken_breakout',
      label: 'broken_breakout',
      description: '',
      class_name: null,
      bundle_hash: '9b2d6e1f4a7c8035d2e9b6a1c4f7e0d3b8a5c2f9e6d1a4b7c0e3f8d5a2b9c6e1',
      valid: false,
      error: 'ImportError: No module named talib',
      parameters: [],
      uses_tick_hooks: false,
      requires_tick_data: false,
    },
  ],
}

export function mockStrategyVersion(versionId: string): StrategyVersionResponse {
  return {
    version_id: versionId,
    strategy_id: MOCK_STRATEGY_FILE_ID,
    class_name: 'SessionBreakout',
    bundle_hash: MOCK_STRATEGY_FILE_BUNDLE_HASH,
    created_at: '2026-10-29T14:30:00-03:00',
    parameters: mockStrategyFiles.strategy_files[0].parameters,
    source_files: [
      {
        path: `${MOCK_STRATEGY_FILE_ID}.py`,
        content: 'class SessionBreakout(ResearchStrategy):\n    ...\n',
      },
      { path: '_lib/ticks.py', content: 'def round_up_to_tick(price, tick):\n    ...\n' },
    ],
  }
}
