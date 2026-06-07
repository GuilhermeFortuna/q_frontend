export const MA_TYPES = [
  { value: 'sma', label: 'Simple (SMA)' },
  { value: 'ema', label: 'Exponential (EMA)' },
  { value: 'wma', label: 'Weighted (WMA)' },
  { value: 'smma', label: 'Smoothed (SMMA)' },
  { value: 'hma', label: 'Hull (HMA)' },
] as const

export type MaType = (typeof MA_TYPES)[number]['value']

export const DEFAULT_MA_TYPE: MaType = 'sma'

export function getMaTypeLabel(value: string): string {
  return MA_TYPES.find((type) => type.value === value)?.label ?? value.toUpperCase()
}
