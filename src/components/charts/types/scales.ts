import { scaleBand, scaleLinear } from '@visx/scale'

export type BandScale = ReturnType<typeof scaleBand<string>>
export type LinearScale = ReturnType<typeof scaleLinear<number>>
