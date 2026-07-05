import { useState, useMemo } from 'react'
import { X, Search, Activity, Sliders } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import type { OhlcvBar } from '@/types/api'
import { NumberInput } from '@/components/ui/number-input'
import { DEFAULT_INDICATORS, type IndicatorConfig } from '@/components/charts/types/chart'
import {
  sma,
  ema,
  bollingerBands,
  rsi,
  macd,
  volumeSma,
  wma,
  hma,
  smma,
  donchianChannels,
} from '@/lib/indicators'

type IndicatorsModalProps = {
  isOpen: boolean
  onClose: () => void
  indicators: IndicatorConfig[]
  bars: OhlcvBar[]
  onChange: (indicators: IndicatorConfig[]) => void
  symbol?: string
  timeframe?: string
}

const PRESET_COLORS = [
  { name: 'Brass', value: '#c9a227' },
  { name: 'Emerald', value: '#26a69a' },
  { name: 'Rose', value: '#ef5350' },
  { name: 'Blue', value: '#6eb5ff' },
  { name: 'Purple', value: '#a78bfa' },
  { name: 'Orange', value: '#f97316' },
  { name: 'White', value: '#ffffff' },
]

const STYLES = [
  { name: 'Solid', value: 'solid' as const },
  { name: 'Dashed', value: 'dashed' as const },
  { name: 'Dotted', value: 'dotted' as const },
]

const WIDTHS = [1.0, 2.0, 3.0]

type IndicatorItem = {
  type: IndicatorConfig['type']
  name: string
  shortName: string
  category: 'Trend' | 'Oscillator' | 'Volume'
  description: string
}

const ALL_INDICATORS_METADATA: IndicatorItem[] = [
  {
    type: 'sma',
    name: 'Simple Moving Average',
    shortName: 'SMA',
    category: 'Trend',
    description:
      "Calculates the average of a security's price over a specified number of periods. SMA is used to identify trend direction, determine support and resistance levels, and smooth out price volatility.",
  },
  {
    type: 'ema',
    name: 'Exponential Moving Average',
    shortName: 'EMA',
    category: 'Trend',
    description:
      'A type of moving average that places a greater weight and significance on the most recent data points. EMA reacts faster to recent price changes than SMA, making it popular for detecting quick trend turns.',
  },
  {
    type: 'bollinger',
    name: 'Bollinger Bands',
    shortName: 'BB',
    category: 'Trend',
    description:
      'Consists of a middle simple moving average band and two outer bands (standard deviation bands). Bollinger Bands measure market volatility. The bands expand when volatility increases and contract when it decreases.',
  },
  {
    type: 'rsi',
    name: 'Relative Strength Index',
    shortName: 'RSI',
    category: 'Oscillator',
    description:
      'A momentum oscillator that measures the speed and change of price movements. RSI oscillates between 0 and 100. Values above 70 indicate overbought conditions, and values below 30 indicate oversold conditions.',
  },
  {
    type: 'macd',
    name: 'Moving Average Convergence Divergence',
    shortName: 'MACD',
    category: 'Oscillator',
    description:
      "A trend-following momentum indicator that shows the relationship between two moving averages of a security's price. Composed of the MACD line, Signal line, and a histogram showing their difference.",
  },
  {
    type: 'volumeMa',
    name: 'Volume Moving Average',
    shortName: 'Volume MA',
    category: 'Volume',
    description:
      'Calculates the Simple Moving Average of trading volume over a specified period. It helps traders distinguish between high-volume market activity and low-volume noise.',
  },
  {
    type: 'wma',
    name: 'Weighted Moving Average',
    shortName: 'WMA',
    category: 'Trend',
    description:
      'Weighted Moving Average assigns a heavier weight to more recent data points and less weight to older data points, making it more responsive to price changes than a Simple Moving Average.',
  },
  {
    type: 'hma',
    name: 'Hull Moving Average',
    shortName: 'HMA',
    category: 'Trend',
    description:
      'Hull Moving Average is a fast and smooth moving average that almost eliminates lag while maintaining curve smoothness. It uses Weighted Moving Averages (WMAs) in its calculation.',
  },
  {
    type: 'smma',
    name: 'Smoothed Moving Average',
    shortName: 'SMMA',
    category: 'Trend',
    description:
      'Smoothed Moving Average is similar to an Exponential Moving Average but with a longer smoothing period. It gives a very smooth trend line that filters out short-term price noise.',
  },
  {
    type: 'donchian',
    name: 'Donchian Channels',
    shortName: 'DC',
    category: 'Trend',
    description:
      'Donchian Channels are composed of three lines: an upper band (the highest high over N periods), a lower band (the lowest low over N periods), and a middle band (average of the upper and lower bands). Commonly used to identify breakouts and measure volatility.',
  },
]

function getCloudFill(color: string): string {
  if (color.startsWith('#')) {
    let hex = color
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    }
    return `${hex}0f`
  }
  return 'rgba(201, 162, 39, 0.05)'
}

function getStrokeDasharray(style?: 'solid' | 'dashed' | 'dotted'): string | undefined {
  if (style === 'dashed') return '4 3'
  if (style === 'dotted') return '1 3'
  return undefined
}

// Indicator Preview SVG Chart Component
function IndicatorPreviewChart({
  bars,
  config,
  symbol = 'BTC',
  timeframe = '1D',
}: {
  bars: OhlcvBar[]
  config: IndicatorConfig
  symbol?: string
  timeframe?: string
}) {
  const previewLength = Math.min(bars.length, 60)
  const startIndex = bars.length - previewLength

  // Compute domains and slices
  const {
    visibleBars,
    priceMin,
    priceMax,
    volMax,
    rsiSlice,
    macdSlice,
    signalSlice,
    histSlice,
    macdDomainMin,
    macdDomainMax,
    smaSlice,
    emaSlice,
    bbUpperSlice,
    bbMiddleSlice,
    bbLowerSlice,
    volSmaSlice,
    wmaSlice,
    hmaSlice,
    smmaSlice,
    donchianUpperSlice,
    donchianMiddleSlice,
    donchianLowerSlice,
  } = useMemo(() => {
    if (previewLength <= 0) {
      return {
        visibleBars: [] as OhlcvBar[],
        priceMin: 0,
        priceMax: 0,
        volMax: 0,
        rsiSlice: [] as (number | null)[],
        macdSlice: [] as (number | null)[],
        signalSlice: [] as (number | null)[],
        histSlice: [] as (number | null)[],
        macdDomainMin: 0,
        macdDomainMax: 0,
        smaSlice: [] as (number | null)[],
        emaSlice: [] as (number | null)[],
        bbUpperSlice: [] as (number | null)[],
        bbMiddleSlice: [] as (number | null)[],
        bbLowerSlice: [] as (number | null)[],
        volSmaSlice: [] as (number | null)[],
        wmaSlice: [] as (number | null)[],
        hmaSlice: [] as (number | null)[],
        smmaSlice: [] as (number | null)[],
        donchianUpperSlice: [] as (number | null)[],
        donchianMiddleSlice: [] as (number | null)[],
        donchianLowerSlice: [] as (number | null)[],
      }
    }

    const visible = bars.slice(startIndex)

    let pMin = Math.min(...visible.map((b) => b.low))
    let pMax = Math.max(...visible.map((b) => b.high))

    let sSlice: (number | null)[] = []
    let eSlice: (number | null)[] = []
    let bbUpSlice: (number | null)[] = []
    let bbMidSlice: (number | null)[] = []
    let bbLoSlice: (number | null)[] = []
    let vSmaSlice: (number | null)[] = []
    let wSlice: (number | null)[] = []
    let hullSlice: (number | null)[] = []
    let smSlice: (number | null)[] = []
    let dcUpSlice: (number | null)[] = []
    let dcMidSlice: (number | null)[] = []
    let dcLoSlice: (number | null)[] = []
    let rSlice: (number | null)[] = []
    let mSlice: (number | null)[] = []
    let sigSlice: (number | null)[] = []
    let hSlice: (number | null)[] = []
    let mDomainMin = 0
    let mDomainMax = 0

    if (config.type === 'sma') {
      const allSma = sma(bars, config.period)
      sSlice = allSma.slice(startIndex)
      const valid = sSlice.filter((v): v is number => v !== null)
      if (valid.length > 0) {
        pMin = Math.min(pMin, ...valid)
        pMax = Math.max(pMax, ...valid)
      }
    } else if (config.type === 'ema') {
      const allEma = ema(bars, config.period)
      eSlice = allEma.slice(startIndex)
      const valid = eSlice.filter((v): v is number => v !== null)
      if (valid.length > 0) {
        pMin = Math.min(pMin, ...valid)
        pMax = Math.max(pMax, ...valid)
      }
    } else if (config.type === 'wma') {
      const allWma = wma(bars, config.period)
      wSlice = allWma.slice(startIndex)
      const valid = wSlice.filter((v): v is number => v !== null)
      if (valid.length > 0) {
        pMin = Math.min(pMin, ...valid)
        pMax = Math.max(pMax, ...valid)
      }
    } else if (config.type === 'hma') {
      const allHma = hma(bars, config.period)
      hullSlice = allHma.slice(startIndex)
      const valid = hullSlice.filter((v): v is number => v !== null)
      if (valid.length > 0) {
        pMin = Math.min(pMin, ...valid)
        pMax = Math.max(pMax, ...valid)
      }
    } else if (config.type === 'smma') {
      const allSmma = smma(bars, config.period)
      smSlice = allSmma.slice(startIndex)
      const valid = smSlice.filter((v): v is number => v !== null)
      if (valid.length > 0) {
        pMin = Math.min(pMin, ...valid)
        pMax = Math.max(pMax, ...valid)
      }
    } else if (config.type === 'bollinger') {
      const allBb = bollingerBands(bars, config.period, config.stdDev)
      bbUpSlice = allBb.upper.slice(startIndex)
      bbMidSlice = allBb.middle.slice(startIndex)
      bbLoSlice = allBb.lower.slice(startIndex)
      const validUp = bbUpSlice.filter((v): v is number => v !== null)
      const validLo = bbLoSlice.filter((v): v is number => v !== null)
      if (validUp.length > 0) pMax = Math.max(pMax, ...validUp)
      if (validLo.length > 0) pMin = Math.min(pMin, ...validLo)
    } else if (config.type === 'donchian') {
      const allDc = donchianChannels(bars, config.period)
      dcUpSlice = allDc.upper.slice(startIndex)
      dcMidSlice = allDc.middle.slice(startIndex)
      dcLoSlice = allDc.lower.slice(startIndex)
      const validUp = dcUpSlice.filter((v): v is number => v !== null)
      const validLo = dcLoSlice.filter((v): v is number => v !== null)
      if (validUp.length > 0) pMax = Math.max(pMax, ...validUp)
      if (validLo.length > 0) pMin = Math.min(pMin, ...validLo)
    }

    const priceSpan = pMax - pMin || 1
    const priceMinFinal = pMin - priceSpan * 0.05
    const priceMaxFinal = pMax + priceSpan * 0.05

    // Volume Calculations
    const maxVolume = Math.max(...visible.map((b) => b.volume)) || 1
    let volMaxFinal = maxVolume
    if (config.type === 'volumeMa') {
      const allVolSma = volumeSma(bars, config.period)
      vSmaSlice = allVolSma.slice(startIndex)
      const valid = vSmaSlice.filter((v): v is number => v !== null)
      if (valid.length > 0) {
        volMaxFinal = Math.max(maxVolume, ...valid)
      }
    }

    // RSI Calculations
    if (config.type === 'rsi') {
      const allRsi = rsi(bars, config.period)
      rSlice = allRsi.slice(startIndex)
    }

    // MACD Calculations
    if (config.type === 'macd') {
      const allMacd = macd(bars, config.fast, config.slow, config.signal)
      mSlice = allMacd.macd.slice(startIndex)
      sigSlice = allMacd.signal.slice(startIndex)
      hSlice = allMacd.histogram.slice(startIndex)
      const validMacd = [...mSlice, ...sigSlice, ...hSlice].filter((v): v is number => v !== null)
      const minM = Math.min(...validMacd, 0)
      const maxM = Math.max(...validMacd, 0)
      const span = maxM - minM || 1
      mDomainMin = minM - span * 0.05
      mDomainMax = maxM + span * 0.05
    }

    return {
      visibleBars: visible,
      priceMin: priceMinFinal,
      priceMax: priceMaxFinal,
      volMax: volMaxFinal,
      rsiSlice: rSlice,
      macdSlice: mSlice,
      signalSlice: sigSlice,
      histSlice: hSlice,
      macdDomainMin: mDomainMin,
      macdDomainMax: mDomainMax,
      smaSlice: sSlice,
      emaSlice: eSlice,
      bbUpperSlice: bbUpSlice,
      bbMiddleSlice: bbMidSlice,
      bbLowerSlice: bbLoSlice,
      volSmaSlice: vSmaSlice,
      wmaSlice: wSlice,
      hmaSlice: hullSlice,
      smmaSlice: smSlice,
      donchianUpperSlice: dcUpSlice,
      donchianMiddleSlice: dcMidSlice,
      donchianLowerSlice: dcLoSlice,
    }
  }, [bars, config, startIndex, previewLength])

  if (previewLength <= 0) {
    return (
      <div className="border-carbon-800 bg-carbon-950/40 text-silver-500 flex h-60 w-full flex-col items-center justify-center rounded-lg border font-mono text-xs shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
        <Activity className="text-brass-500/50 mb-2 h-6 w-6 animate-pulse" />
        <span>No market data available for preview</span>
      </div>
    )
  }

  // Dimension details
  const width = 480
  const height = 240
  const margins = { top: 12, right: 55, bottom: 20, left: 12 }
  const innerWidth = width - margins.left - margins.right
  const innerHeight = height - margins.top - margins.bottom

  // Split calculations
  const priceTop = margins.top
  let priceHeight = innerHeight
  let oscTop = 0
  let oscHeight = 0
  let volumeTop = 0
  let volumeHeight = 0

  if (config.type === 'rsi' || config.type === 'macd') {
    priceHeight = Math.round(innerHeight * 0.6)
    oscTop = margins.top + priceHeight + 15
    oscHeight = innerHeight - priceHeight - 15
  } else if (config.type === 'volumeMa') {
    priceHeight = Math.round(innerHeight * 0.65)
    volumeTop = margins.top + priceHeight + 15
    volumeHeight = innerHeight - priceHeight - 15
  }

  const getX = (index: number) => margins.left + index * (innerWidth / previewLength)
  const barWidth = Math.max((innerWidth / previewLength) * 0.65, 1)
  const halfBar = innerWidth / previewLength / 2

  const getPriceY = (val: number) =>
    priceTop + priceHeight - ((val - priceMin) / (priceMax - priceMin)) * priceHeight

  const getVolY = (val: number) => volumeTop + volumeHeight - (val / volMax) * volumeHeight

  const getRsiY = (val: number) => oscTop + oscHeight - ((val - 15) / (85 - 15)) * oscHeight

  const getMacdY = (val: number) =>
    oscTop + oscHeight - ((val - macdDomainMin) / (macdDomainMax - macdDomainMin)) * oscHeight

  // Create paths helper
  const makePath = (values: (number | null)[], yScaler: (v: number) => number) => {
    const points: string[] = []
    values.forEach((v, i) => {
      if (v !== null) {
        points.push(`${points.length === 0 ? 'M' : 'L'} ${getX(i) + halfBar} ${yScaler(v)}`)
      }
    })
    return points.join(' ')
  }

  // Bollinger cloud path helper
  const makeBbCloudPath = () => {
    const points: string[] = []
    bbUpperSlice.forEach((val: number | null, i: number) => {
      if (val !== null) {
        points.push(`${getX(i) + halfBar},${getPriceY(val)}`)
      }
    })
    for (let i = bbLowerSlice.length - 1; i >= 0; i--) {
      const val = bbLowerSlice[i]
      if (val !== null) {
        points.push(`${getX(i) + halfBar},${getPriceY(val)}`)
      }
    }
    if (points.length === 0) return ''
    return `M ${points[0].replace(',', ' ')} ${points
      .slice(1)
      .map((p) => `L ${p.replace(',', ' ')}`)
      .join(' ')} Z`
  }

  // Donchian cloud path helper
  const makeDcCloudPath = () => {
    const points: string[] = []
    donchianUpperSlice.forEach((val: number | null, i: number) => {
      if (val !== null) {
        points.push(`${getX(i) + halfBar},${getPriceY(val)}`)
      }
    })
    for (let i = donchianLowerSlice.length - 1; i >= 0; i--) {
      const val = donchianLowerSlice[i]
      if (val !== null) {
        points.push(`${getX(i) + halfBar},${getPriceY(val)}`)
      }
    }
    if (points.length === 0) return ''
    return `M ${points[0].replace(',', ' ')} ${points
      .slice(1)
      .map((p) => `L ${p.replace(',', ' ')}`)
      .join(' ')} Z`
  }

  const priceTicks = [
    priceMax - (priceMax - priceMin) * 0.15,
    (priceMin + priceMax) / 2,
    priceMin + (priceMax - priceMin) * 0.15,
  ]

  return (
    <div className="border-carbon-800 bg-carbon-950/80 relative flex h-60 w-full justify-center overflow-hidden rounded-lg border shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
      <svg width={width} height={height} className="font-mono select-none">
        <defs>
          <linearGradient id="prev-bull-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#26a69a" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#26a69a" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="prev-bear-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef5350" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ef5350" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Watermark */}
        <text
          x={margins.left + innerWidth / 2}
          y={priceTop + priceHeight / 2}
          textAnchor="middle"
          alignmentBaseline="middle"
          fill="rgba(255, 255, 255, 0.025)"
          fontSize={32}
          fontWeight="bold"
          pointerEvents="none"
        >
          {symbol} {timeframe}
        </text>

        {/* Price grid lines */}
        {priceTicks.map((tick, i) => (
          <line
            key={i}
            x1={margins.left}
            x2={margins.left + innerWidth}
            y1={getPriceY(tick)}
            y2={getPriceY(tick)}
            stroke="rgba(111, 119, 133, 0.08)"
            strokeDasharray="2 3"
          />
        ))}

        {/* Price ticks labels */}
        {priceTicks.map((tick, i) => (
          <text
            key={i}
            x={margins.left + innerWidth + 6}
            y={getPriceY(tick) + 3}
            fill="rgba(156, 163, 175, 0.45)"
            fontSize={8}
            textAnchor="start"
          >
            {tick.toFixed(2)}
          </text>
        ))}

        {/* Candlesticks */}
        {visibleBars.map((bar: OhlcvBar, i: number) => {
          const x = getX(i)
          const cx = x + halfBar
          const yOpen = getPriceY(bar.open)
          const yClose = getPriceY(bar.close)
          const yHigh = getPriceY(bar.high)
          const yLow = getPriceY(bar.low)
          const isBullish = bar.close >= bar.open
          const color = isBullish ? '#26a69a' : '#ef5350'
          return (
            <g key={i}>
              <line
                x1={cx}
                x2={cx}
                y1={yHigh}
                y2={yLow}
                stroke={color}
                strokeWidth={1}
                opacity={0.6}
              />
              <rect
                x={x}
                y={Math.min(yOpen, yClose)}
                width={barWidth}
                height={Math.max(Math.abs(yClose - yOpen), 1)}
                fill={color}
                opacity={0.8}
              />
            </g>
          )
        })}

        {/* Render overlay indicator */}
        {config.type === 'sma' && smaSlice.length > 0 && (
          <path
            d={makePath(smaSlice, getPriceY)}
            fill="none"
            stroke={config.color || '#c9a227'}
            strokeWidth={config.strokeWidth || 1.2}
            strokeDasharray={getStrokeDasharray(config.lineStyle)}
          />
        )}

        {config.type === 'ema' && emaSlice.length > 0 && (
          <path
            d={makePath(emaSlice, getPriceY)}
            fill="none"
            stroke={config.color || '#6eb5ff'}
            strokeWidth={config.strokeWidth || 1.2}
            strokeDasharray={getStrokeDasharray(config.lineStyle)}
          />
        )}

        {config.type === 'bollinger' && bbUpperSlice.length > 0 && (
          <g>
            {config.showCloud !== false && (
              <path
                d={makeBbCloudPath()}
                fill={getCloudFill(config.color || '#c9a227')}
                stroke="none"
              />
            )}
            <path
              d={makePath(bbUpperSlice, getPriceY)}
              fill="none"
              stroke={config.color || '#c9a227'}
              strokeWidth={config.strokeWidth || 1.0}
              opacity={0.7}
            />
            <path
              d={makePath(bbMiddleSlice, getPriceY)}
              fill="none"
              stroke={config.color || '#c9a227'}
              strokeWidth={config.strokeWidth || 1.0}
              strokeDasharray="2 2"
              opacity={0.4}
            />
            <path
              d={makePath(bbLowerSlice, getPriceY)}
              fill="none"
              stroke={config.color || '#c9a227'}
              strokeWidth={config.strokeWidth || 1.0}
              opacity={0.7}
            />
          </g>
        )}

        {config.type === 'wma' && wmaSlice.length > 0 && (
          <path
            d={makePath(wmaSlice, getPriceY)}
            fill="none"
            stroke={config.color || '#f97316'}
            strokeWidth={config.strokeWidth || 1.2}
            strokeDasharray={getStrokeDasharray(config.lineStyle)}
          />
        )}

        {config.type === 'hma' && hmaSlice.length > 0 && (
          <path
            d={makePath(hmaSlice, getPriceY)}
            fill="none"
            stroke={config.color || '#26a69a'}
            strokeWidth={config.strokeWidth || 1.2}
            strokeDasharray={getStrokeDasharray(config.lineStyle)}
          />
        )}

        {config.type === 'smma' && smmaSlice.length > 0 && (
          <path
            d={makePath(smmaSlice, getPriceY)}
            fill="none"
            stroke={config.color || '#ef5350'}
            strokeWidth={config.strokeWidth || 1.2}
            strokeDasharray={getStrokeDasharray(config.lineStyle)}
          />
        )}

        {config.type === 'donchian' && donchianUpperSlice.length > 0 && (
          <g>
            {config.showCloud !== false && (
              <path
                d={makeDcCloudPath()}
                fill={getCloudFill(config.color || '#6eb5ff')}
                stroke="none"
              />
            )}
            <path
              d={makePath(donchianUpperSlice, getPriceY)}
              fill="none"
              stroke={config.color || '#6eb5ff'}
              strokeWidth={config.strokeWidth || 1.0}
              opacity={0.7}
            />
            <path
              d={makePath(donchianMiddleSlice, getPriceY)}
              fill="none"
              stroke={config.color || '#6eb5ff'}
              strokeWidth={config.strokeWidth || 1.0}
              strokeDasharray="2 2"
              opacity={0.4}
            />
            <path
              d={makePath(donchianLowerSlice, getPriceY)}
              fill="none"
              stroke={config.color || '#6eb5ff'}
              strokeWidth={config.strokeWidth || 1.0}
              opacity={0.7}
            />
          </g>
        )}

        {/* RSI Oscillator pane */}
        {config.type === 'rsi' && rsiSlice.length > 0 && (
          <g>
            <rect
              x={margins.left}
              y={oscTop}
              width={innerWidth}
              height={oscHeight}
              fill="rgba(7, 16, 28, 0.3)"
              stroke="rgba(111, 119, 133, 0.15)"
            />
            <line
              x1={margins.left}
              x2={margins.left + innerWidth}
              y1={getRsiY(70)}
              y2={getRsiY(70)}
              stroke="rgba(239, 83, 80, 0.25)"
              strokeDasharray="3 2"
            />
            <line
              x1={margins.left}
              x2={margins.left + innerWidth}
              y1={getRsiY(30)}
              y2={getRsiY(30)}
              stroke="rgba(38, 166, 154, 0.25)"
              strokeDasharray="3 2"
            />
            <text
              x={margins.left + innerWidth + 5}
              y={getRsiY(70) + 3}
              fill="rgba(239, 83, 80, 0.45)"
              fontSize={7}
            >
              70
            </text>
            <text
              x={margins.left + innerWidth + 5}
              y={getRsiY(30) + 3}
              fill="rgba(38, 166, 154, 0.45)"
              fontSize={7}
            >
              30
            </text>
            {config.showCloud !== false && (
              <rect
                x={margins.left}
                y={getRsiY(70)}
                width={innerWidth}
                height={Math.max(getRsiY(30) - getRsiY(70), 1)}
                fill={getCloudFill(config.color || '#a78bfa')}
                stroke="none"
              />
            )}
            <path
              d={makePath(rsiSlice, getRsiY)}
              fill="none"
              stroke={config.color || '#a78bfa'}
              strokeWidth={config.strokeWidth || 1.2}
            />
            <text x={margins.left + 5} y={oscTop + 10} fill="#9ca3af" fontSize={8}>
              RSI({config.period})
            </text>
          </g>
        )}

        {/* MACD Oscillator pane */}
        {config.type === 'macd' && macdSlice.length > 0 && (
          <g>
            <rect
              x={margins.left}
              y={oscTop}
              width={innerWidth}
              height={oscHeight}
              fill="rgba(7, 16, 28, 0.3)"
              stroke="rgba(111, 119, 133, 0.15)"
            />
            <line
              x1={margins.left}
              x2={margins.left + innerWidth}
              y1={getMacdY(0)}
              y2={getMacdY(0)}
              stroke="rgba(111, 119, 133, 0.15)"
              strokeDasharray="2 2"
            />

            {/* MACD Histogram */}
            {histSlice.map((val: number | null, i: number) => {
              if (val === null) return null
              const x = getX(i)
              const y0 = getMacdY(0)
              const y1 = getMacdY(val)
              const rectY = Math.min(y0, y1)
              const rectH = Math.max(Math.abs(y1 - y0), 1)
              const color = val >= 0 ? '#26a69a' : '#ef5350'
              return (
                <rect
                  key={i}
                  x={x}
                  y={rectY}
                  width={barWidth}
                  height={rectH}
                  fill={color}
                  fillOpacity={0.5}
                />
              )
            })}

            {/* MACD & Signal Line */}
            <path
              d={makePath(macdSlice, getMacdY)}
              fill="none"
              stroke={config.macdColor || '#6eb5ff'}
              strokeWidth={1.1}
            />
            <path
              d={makePath(signalSlice, getMacdY)}
              fill="none"
              stroke={config.signalColor || '#c9a227'}
              strokeWidth={0.9}
              strokeDasharray="3 2"
            />

            <text x={margins.left + 5} y={oscTop + 10} fill="#9ca3af" fontSize={8}>
              MACD({config.fast},{config.slow},{config.signal})
            </text>
          </g>
        )}

        {/* Volume & Volume MA pane */}
        {config.type === 'volumeMa' && (
          <g>
            <rect
              x={margins.left}
              y={volumeTop}
              width={innerWidth}
              height={volumeHeight}
              fill="rgba(7, 16, 28, 0.3)"
              stroke="rgba(111, 119, 133, 0.15)"
            />

            {/* Volume Bars */}
            {visibleBars.map((bar: OhlcvBar, i: number) => {
              const x = getX(i)
              const y = getVolY(bar.volume)
              const yZero = getVolY(0)
              const h = Math.max(yZero - y, 0)
              const color = bar.close >= bar.open ? '#26a69a' : '#ef5350'
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  fill={color}
                  fillOpacity={0.25}
                />
              )
            })}

            {/* Volume MA line */}
            {volSmaSlice && volSmaSlice.length > 0 && (
              <path
                d={makePath(volSmaSlice, getVolY)}
                fill="none"
                stroke={config.color || '#a78bfa'}
                strokeWidth={config.strokeWidth || 1.2}
                strokeDasharray={getStrokeDasharray(config.lineStyle)}
              />
            )}

            <text x={margins.left + 5} y={volumeTop + 10} fill="#9ca3af" fontSize={8}>
              Volume MA({config.period})
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

export function IndicatorsModal({
  isOpen,
  onClose,
  indicators,
  bars,
  onChange,
  symbol = 'BTC',
  timeframe = '1D',
}: IndicatorsModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<IndicatorConfig['type']>('sma')
  const [draftIndicators, setDraftIndicators] = useState<IndicatorConfig[]>(() => {
    return DEFAULT_INDICATORS.map((def) => {
      const incoming = indicators.find((ind) => ind.type === def.type)
      if (incoming) {
        return { ...incoming }
      } else {
        return { ...def, enabled: false }
      }
    })
  })

  if (!isOpen) return null

  // Find active indicator configuration in draft
  const activeDraftConfig = draftIndicators.find((ind) => ind.type === selectedType)!

  // Filter indicator list
  const filteredIndicators = ALL_INDICATORS_METADATA.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const updateField = (field: string, value: unknown) => {
    setDraftIndicators((prev) =>
      prev.map((ind) => {
        if (ind.type !== selectedType) return ind
        return { ...ind, [field]: value } as IndicatorConfig
      }),
    )
  }

  const handleToggleActive = (type: IndicatorConfig['type']) => {
    setDraftIndicators((prev) =>
      prev.map((ind) => (ind.type === type ? { ...ind, enabled: !ind.enabled } : ind)),
    )
  }

  const handleSave = () => {
    onChange(draftIndicators)
    onClose()
  }

  const selectedMetadata = ALL_INDICATORS_METADATA.find((m) => m.type === selectedType)!

  // Categorize
  const categorized = {
    Trend: filteredIndicators.filter((i) => i.category === 'Trend'),
    Oscillator: filteredIndicators.filter((i) => i.category === 'Oscillator'),
    Volume: filteredIndicators.filter((i) => i.category === 'Volume'),
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(val) => {
        if (!val) onClose()
      }}
    >
      <DialogContent className="flex h-[580px] w-full max-w-4xl flex-col overflow-hidden rounded-xl p-0 select-none">
        {/* Header */}
        <div className="border-carbon-800/80 flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Sliders className="text-brass-400 h-4.5 w-4.5" />
            <h2
              id="indicators-modal-title"
              className="text-silver-100 font-sans text-sm font-bold tracking-wider uppercase"
            >
              Indicators
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-silver-400 hover:text-silver-100 bg-carbon-800/20 hover:bg-carbon-800/60 cursor-pointer rounded-full p-1 transition-all duration-150 active:scale-90"
            aria-label="Close dialog"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Grid Body */}
        <div className="flex min-h-0 flex-1">
          {/* Left Sidebar */}
          <div className="border-carbon-800/60 bg-carbon-950/30 flex w-72 flex-col border-r">
            {/* Search */}
            <div className="p-3">
              <div className="relative flex items-center">
                <Search className="text-silver-500 absolute left-2.5 h-3.5 w-3.5" />
                <input
                  type="text"
                  placeholder="Search indicators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-carbon-950 border-carbon-800/80 text-silver-200 placeholder-silver-500 focus:border-brass-500/40 focus:ring-brass-500/10 w-full rounded-md border py-1.5 pr-3 pl-8 text-xs transition-all outline-none focus:ring-1"
                />
              </div>
            </div>

            {/* List */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-3 font-sans">
              {Object.entries(categorized).map(([categoryName, items]) => {
                if (items.length === 0) return null
                return (
                  <div key={categoryName} className="space-y-1">
                    <span className="text-silver-500 block px-2 text-[9px] font-bold tracking-wider uppercase">
                      {categoryName === 'Trend' ? 'Trend Overlays' : categoryName + 's'}
                    </span>
                    <div className="space-y-0.5">
                      {items.map((item) => {
                        const isSelected = selectedType === item.type
                        const isEnabled = draftIndicators.find(
                          (ind) => ind.type === item.type,
                        )?.enabled
                        return (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => setSelectedType(item.type)}
                            className={`flex w-full cursor-pointer items-center justify-between rounded px-2.5 py-1.5 text-left transition-all duration-150 ${
                              isSelected
                                ? 'bg-brass-500/10 text-brass-400 border-brass-500/15 border'
                                : 'hover:bg-carbon-850/40 text-silver-300 border border-transparent'
                            }`}
                          >
                            <span className="truncate text-xs font-medium">{item.name}</span>
                            <input
                              type="checkbox"
                              checked={!!isEnabled}
                              onChange={(e) => {
                                e.stopPropagation()
                                handleToggleActive(item.type)
                              }}
                              className="accent-brass-500 border-carbon-700 h-3.5 w-3.5 cursor-pointer rounded focus:ring-0"
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {filteredIndicators.length === 0 && (
                <div className="text-silver-500 py-8 text-center text-xs">No indicators found.</div>
              )}
            </div>
          </div>

          {/* Right Preview/Detail Pane */}
          <div className="flex min-w-0 flex-1 flex-col space-y-4 overflow-y-auto p-5">
            {/* Title & Description */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <h3 className="text-silver-100 font-sans text-base font-bold tracking-wide">
                  {selectedMetadata.name}
                </h3>
                <span className="text-silver-500 font-mono text-xs font-semibold">
                  ({selectedMetadata.shortName})
                </span>
              </div>
              <p className="text-silver-400 max-w-2xl font-sans text-xs leading-relaxed">
                {selectedMetadata.description}
              </p>
            </div>

            {/* Live Preview Chart */}
            <div className="space-y-1.5">
              <span className="text-silver-500 font-sans text-[9px] font-bold tracking-wider uppercase">
                Interactive Preview
              </span>
              <IndicatorPreviewChart
                bars={bars}
                config={activeDraftConfig}
                symbol={symbol}
                timeframe={timeframe}
              />
            </div>

            {/* Customization Details & Toggle */}
            <div className="bg-carbon-950/20 border-carbon-800/50 flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4 font-mono text-[10px]">
              {/* Parameters Column */}
              <div className="min-w-[240px] flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Period Input */}
                  {activeDraftConfig.type !== 'macd' && 'period' in activeDraftConfig && (
                    <div className="flex flex-col gap-1">
                      <span className="text-silver-500 font-bold uppercase">Period</span>
                      <NumberInput
                        min={2}
                        max={
                          activeDraftConfig.type === 'bollinger' || activeDraftConfig.type === 'rsi'
                            ? 100
                            : 200
                        }
                        integer
                        value={activeDraftConfig.period}
                        onChange={(period) => updateField('period', period)}
                        className="border-brass-600/15 bg-carbon-950 text-silver-200 focus:border-brass-500/50 w-16 rounded px-2 py-1 text-center font-bold shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Bollinger StdDev */}
                  {activeDraftConfig.type === 'bollinger' && 'stdDev' in activeDraftConfig && (
                    <div className="flex flex-col gap-1">
                      <span className="text-silver-500 font-bold uppercase">Std Dev</span>
                      <NumberInput
                        min={0.5}
                        max={5}
                        step={0.1}
                        value={activeDraftConfig.stdDev}
                        onChange={(stdDev) => updateField('stdDev', stdDev)}
                        className="border-brass-600/15 bg-carbon-950 text-silver-200 focus:border-brass-500/50 w-16 rounded px-2 py-1 text-center font-bold shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] focus:outline-none"
                      />
                    </div>
                  )}

                  {/* MACD Periods */}
                  {activeDraftConfig.type === 'macd' && (
                    <div className="flex flex-wrap gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-silver-500 font-bold uppercase">Fast</span>
                        <NumberInput
                          min={2}
                          max={50}
                          integer
                          value={activeDraftConfig.fast}
                          onChange={(fast) => updateField('fast', fast)}
                          className="border-brass-600/15 bg-carbon-950 text-silver-200 focus:border-brass-500/50 w-12 rounded px-1.5 py-1 text-center font-bold shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-silver-500 font-bold uppercase">Slow</span>
                        <NumberInput
                          min={5}
                          max={100}
                          integer
                          value={activeDraftConfig.slow}
                          onChange={(slow) => updateField('slow', slow)}
                          className="border-brass-600/15 bg-carbon-950 text-silver-200 focus:border-brass-500/50 w-12 rounded px-1.5 py-1 text-center font-bold shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-silver-500 font-bold uppercase">Signal</span>
                        <NumberInput
                          min={2}
                          max={40}
                          integer
                          value={activeDraftConfig.signal}
                          onChange={(signal) => updateField('signal', signal)}
                          className="border-brass-600/15 bg-carbon-950 text-silver-200 focus:border-brass-500/50 w-12 rounded px-1.5 py-1 text-center font-bold shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Show Cloud Fill */}
                  {'showCloud' in activeDraftConfig && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-silver-500 font-bold uppercase">Cloud Fill</span>
                      <label className="flex cursor-pointer items-center gap-1.5 py-1">
                        <input
                          type="checkbox"
                          checked={activeDraftConfig.showCloud}
                          onChange={(e) => updateField('showCloud', e.target.checked)}
                          className="accent-brass-500 border-carbon-700 h-3.5 w-3.5 cursor-pointer rounded focus:ring-0"
                        />
                        <span className="text-silver-300 font-semibold select-none">Show</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Styling configurations */}
                <div className="border-carbon-800/30 flex flex-wrap gap-4 border-t pt-1.5">
                  {/* Colors Selector */}
                  {activeDraftConfig.type !== 'macd' && 'color' in activeDraftConfig && (
                    <div className="space-y-1">
                      <span className="text-silver-500 font-bold uppercase">Color</span>
                      <div className="flex flex-wrap gap-1">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => updateField('color', c.value)}
                            style={{ backgroundColor: c.value }}
                            className={`h-4.5 w-4.5 cursor-pointer rounded-full border transition-all duration-150 active:scale-90 ${
                              activeDraftConfig.color === c.value
                                ? 'scale-110 border-white shadow-md shadow-black/50'
                                : 'border-carbon-800 hover:border-silver-400'
                            }`}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MACD double Color Selector */}
                  {activeDraftConfig.type === 'macd' && (
                    <div className="flex gap-4">
                      <div className="space-y-1">
                        <span className="text-silver-500 font-bold uppercase">MACD Line</span>
                        <div className="flex flex-wrap gap-1">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => updateField('macdColor', c.value)}
                              style={{ backgroundColor: c.value }}
                              className={`h-4 w-4 cursor-pointer rounded-full border transition-all duration-150 active:scale-90 ${
                                activeDraftConfig.macdColor === c.value
                                  ? 'scale-110 border-white shadow shadow-black/50'
                                  : 'border-carbon-800 hover:border-silver-400'
                              }`}
                              title={c.name}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-silver-500 font-bold uppercase">Signal Line</span>
                        <div className="flex flex-wrap gap-1">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => updateField('signalColor', c.value)}
                              style={{ backgroundColor: c.value }}
                              className={`h-4 w-4 cursor-pointer rounded-full border transition-all duration-150 active:scale-90 ${
                                activeDraftConfig.signalColor === c.value
                                  ? 'scale-110 border-white shadow shadow-black/50'
                                  : 'border-carbon-800 hover:border-silver-400'
                              }`}
                              title={c.name}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Line Style Selection */}
                  {'lineStyle' in activeDraftConfig && (
                    <div className="space-y-1">
                      <span className="text-silver-500 font-bold uppercase">Line Style</span>
                      <div className="bg-carbon-950 border-carbon-800/80 flex gap-0.5 rounded border p-0.5">
                        {STYLES.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => updateField('lineStyle', s.value)}
                            className={`cursor-pointer rounded px-2 py-0.5 text-center text-[8px] font-bold transition-all duration-150 ${
                              activeDraftConfig.lineStyle === s.value
                                ? 'bg-brass-500/15 text-brass-400'
                                : 'text-silver-500 hover:text-silver-300'
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Line Stroke Width */}
                  {'strokeWidth' in activeDraftConfig && (
                    <div className="space-y-1">
                      <span className="text-silver-500 font-bold uppercase">Width</span>
                      <div className="bg-carbon-950 border-carbon-800/80 flex gap-0.5 rounded border p-0.5">
                        {WIDTHS.map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => updateField('strokeWidth', w)}
                            className={`cursor-pointer rounded px-2 py-0.5 text-center text-[8px] font-bold transition-all duration-150 ${
                              activeDraftConfig.strokeWidth === w
                                ? 'bg-brass-500/15 text-brass-400'
                                : 'text-silver-500 hover:text-silver-300'
                            }`}
                          >
                            {w}px
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Toggle Enable button */}
              <div className="flex flex-col items-end justify-center self-center pt-2 pl-2 md:pt-0">
                <button
                  type="button"
                  onClick={() => handleToggleActive(selectedType)}
                  className={`cursor-pointer rounded-md px-4 py-2 font-sans text-xs font-bold tracking-wider uppercase shadow-md transition-all duration-150 active:scale-95 ${
                    activeDraftConfig.enabled
                      ? 'border border-rose-500/30 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
                      : 'bg-brass-500/15 hover:bg-brass-500/25 border-brass-500/30 text-brass-400 border'
                  }`}
                >
                  {activeDraftConfig.enabled ? 'Remove from Chart' : 'Add to Chart'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-carbon-800/80 bg-carbon-950/20 flex justify-end gap-2.5 border-t px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-carbon-800 border-carbon-800 text-silver-300 cursor-pointer rounded-lg border bg-transparent px-4 py-1.5 font-sans text-xs font-bold transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="bg-brass-500 hover:bg-brass-400 text-carbon-950 shadow-brass-500/10 cursor-pointer rounded-lg px-5 py-1.5 font-sans text-xs font-bold shadow-lg transition-all active:scale-95"
          >
            OK
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
