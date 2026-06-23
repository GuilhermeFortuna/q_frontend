import type { ResolvedBrightnessMode } from '@/hooks/useResolvedBrightness'

export const BRANDED_BG_MAP: Record<ResolvedBrightnessMode, string> = {
  high: '/high_brightness/Quant_Background_High_Brightness.jpeg',
  mid: '/mid_brightness/Quant_Background_Mid_Brightness.jpeg',
  low: '/mid_brightness/Quant_Background_Mid_Brightness.jpeg',
}

export const CLEAN_BG_MAP: Record<ResolvedBrightnessMode, string> = {
  high: '/high_brightness/Quant_Background_Clean_High_Brightness.png',
  mid: '/mid_brightness/Quant_Background_Clean_Mid_Brightness.jpeg',
  low: '/mid_brightness/Quant_Background_Clean_Mid_Brightness.jpeg',
}
