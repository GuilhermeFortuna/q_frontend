import type { IndicatorCatalogEntry } from '../../../contracts/api'
import type { IndicatorConfig } from './indicatorConfig'

export type IndicatorDocumentation = {
  summary: string
  measures: string
  interpretation: string
  calculation: string
  limitations: string
  example?: string
  keywords: string[]
  referenceLines?: number[]
}

export type IndicatorParameterHelp = { label: string; description: string }

// Explanations verified against q_backend's indicator_catalog/technical_indicators/
// transforms and q_core's q-indicators kernels. The API owns defaults and constraints.
export const indicatorParameterHelp: Record<string, IndicatorParameterHelp> = {
  mode: {
    label: 'Level mode',
    description:
      'Developing uses the current session through each bar close; prior session uses the previous stored session’s final profile.',
  },
  row_ticks: {
    label: 'Row size (ticks)',
    description: 'Number of instrument price ticks grouped into each volume profile row.',
  },
  value_area: {
    label: 'Value area share',
    description: 'Share of traded volume covered by expanding outward from the point of control.',
  },
  period: {
    label: 'Period',
    description: 'Number of bars used by the average or smoothing calculation.',
  },
  window: { label: 'Window', description: 'Number of bars in the trailing calculation window.' },
  num_std: {
    label: 'Band width',
    description: 'Number of sample standard deviations above and below the average.',
  },
  fast_period: {
    label: 'Fast period',
    description: 'Shorter EMA span in bars. Must be smaller than the slow period.',
  },
  slow_period: { label: 'Slow period', description: 'Longer EMA span in bars.' },
  signal_period: {
    label: 'Signal period',
    description: 'EMA span in bars used to smooth the MACD line.',
  },
  change_bars: {
    label: 'Change lookback',
    description: 'Compare the current close with the close this many bars earlier.',
  },
  horizon: {
    label: 'Return horizon',
    description: 'Number of bars over which the log return is measured.',
  },
  vol_estimator: {
    label: 'Volatility estimator',
    description:
      'Realized uses squared log returns; EWMA gives recent returns more weight. OHLC estimators use the bar range.',
  },
  vol_window: {
    label: 'Volatility window',
    description: 'Trailing volatility window in bars; unused when the estimator is EWMA.',
  },
  vol_half_life: {
    label: 'Volatility half-life',
    description: 'Bars until an observation has half its original weight; used only by EWMA.',
  },
  vol_lag: {
    label: 'Volatility lag',
    description: 'Use 1 for the previous bar’s volatility, or 0 for the current bar’s volatility.',
  },
  fast_half_life: {
    label: 'Fast half-life',
    description: 'Faster log-price EWMA decay in bars. Must be smaller than the slow half-life.',
  },
  slow_half_life: { label: 'Slow half-life', description: 'Slower log-price EWMA decay in bars.' },
  periods_per_year: {
    label: 'Bars per year',
    description:
      'Annualization factor. Set this for the selected bar interval and trading calendar.',
  },
  half_life: {
    label: 'Half-life',
    description: 'Bars until a squared return has half its original weight in the EWMA.',
  },
  short_window: {
    label: 'Short window',
    description: 'Shorter volatility window in bars; unused for EWMA.',
  },
  long_window: {
    label: 'Long window',
    description: 'Longer volatility window in bars; must exceed the short window. Unused for EWMA.',
  },
  short_half_life: {
    label: 'Short half-life',
    description: 'Faster volatility decay in bars; used only by EWMA.',
  },
  long_half_life: {
    label: 'Long half-life',
    description:
      'Slower volatility decay in bars; must exceed the short half-life. Used only by EWMA.',
  },
  output: {
    label: 'Spread aggregation',
    description:
      'Use the last valid quote, the time-weighted mean, or the maximum spread within each bar.',
  },
  spread_output: {
    label: 'Spread aggregation',
    description: 'Spread statistic to divide by per-bar volatility.',
  },
  max_quote_age_ms: {
    label: 'Maximum quote age (ms)',
    description: 'How long a quote remains valid without a fresh update.',
  },
  min_coverage: {
    label: 'Minimum quote coverage',
    description: 'Required fraction of the bar covered by valid quotes, from 0 to 1.',
  },
}

export const indicatorChoiceLabels: Record<string, string> = {
  realized: 'Realized',
  ewma: 'EWMA',
  rogers_satchell: 'Rogers–Satchell',
  yang_zhang: 'Yang–Zhang',
  last: 'Last valid quote',
  time_weighted_mean: 'Time-weighted mean',
  max: 'Maximum',
}

export function parameterHelp(name: string): IndicatorParameterHelp {
  return (
    indicatorParameterHelp[name] ?? {
      label: name.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()),
      description: 'Configure this parameter within the limits provided by the indicator catalog.',
    }
  )
}

const smoothingLimit =
  'Averages lag price and can cross repeatedly in sideways markets. Early values depend on the available history.'
const volatilityLimit =
  'Volatility measures variability, not direction. Bar interval and input quality affect the result; missing or invalid prices can leave gaps.'
const normalizedLimit =
  'Very small or missing volatility makes the ratio undefined. The estimator and lag change the scale; values are not probabilities.'

function doc(
  summary: string,
  measures: string,
  interpretation: string,
  calculation: string,
  limitations: string,
  keywords: string[],
  extra: Partial<IndicatorDocumentation> = {},
): IndicatorDocumentation {
  return { summary, measures, interpretation, calculation, limitations, keywords, ...extra }
}

export const indicatorDocumentation: Record<string, IndicatorDocumentation> = {
  sma: doc(
    'An equal-weight view of the recent price trend.',
    'The mean closing price over a trailing window.',
    'A rising line describes a rising average. Price above the line is above its recent mean.',
    'SMA = sum of the last N closes / N',
    smoothingLimit,
    ['simple', 'average', 'trend', 'smoothing'],
    { example: 'Closes of 100, 102 and 104 give a 3-bar SMA of 102.' },
  ),
  ema: doc(
    'A smooth price trend that gives recent bars more weight.',
    'An exponentially weighted average of closing prices.',
    'A shorter span responds faster to price changes; a longer span smooths more of the noise.',
    'Exponentially weighted close; α = 2 / (N + 1)',
    smoothingLimit,
    ['exponential', 'average', 'trend'],
  ),
  wma: doc(
    'A price average with linearly increasing recent weights.',
    'A trailing close average weighted from 1 for the oldest bar to N for the newest.',
    'The latest bars move the average more than older bars.',
    'WMA = Σ(weight × close) / Σ(weight), weights 1…N',
    smoothingLimit,
    ['weighted', 'average', 'trend'],
  ),
  hma: doc(
    'A responsive trend line built from weighted averages.',
    'A combination of weighted moving averages designed to reduce smoothing lag.',
    'The line reacts quickly to turns and may overshoot price.',
    'HMA = WMA(2 × WMA(close, floor(N/2)) − WMA(close, N), floor(√N)); lengths are at least 1',
    smoothingLimit,
    ['hull', 'average', 'trend'],
  ),
  smma: doc(
    'A slower price average using Wilder-style smoothing.',
    'An exponentially weighted closing-price average with a smaller smoothing coefficient than an EMA of the same period.',
    'Useful for viewing a steadier trend; changes take longer to reach the average.',
    'Exponentially weighted close; α = 1 / N',
    smoothingLimit,
    ['smoothed', 'wilder', 'average'],
  ),
  volume_ma: doc(
    'The average activity level over recent bars.',
    'A simple moving average of the bar volume field.',
    'Higher values mean more recorded activity. Compare it with volume, not with price.',
    'Volume MA = sum of the last N bar volumes / N',
    'Volume may represent ticks or traded units depending on the source. The catalog places this output in the price pane, although its units differ from price.',
    ['volume', 'activity', 'average'],
  ),
  bollinger: doc(
    'A price envelope whose width follows recent variability.',
    'A simple moving average surrounded by sample standard-deviation bands.',
    'Wider bands describe greater price dispersion. Touching a band does not imply an automatic reversal.',
    'Middle = SMA(close, N); upper/lower = middle ± width × sample std(close, N)',
    'Uses sample standard deviation (N − 1 denominator). Trends can remain near a band; a one-bar window has undefined sample deviation.',
    ['bands', 'envelope', 'dispersion', 'volatility'],
  ),
  donchian: doc(
    'The highest high and lowest low in a trailing window.',
    'A range channel using bar highs and lows, including the current bar.',
    'The channel describes recent extremes. A wider channel indicates a larger price range.',
    'Upper = max(high, N); lower = min(low, N)',
    'The current bar participates in the channel. A breakout rule that compares against prior extremes must lag the channel separately.',
    ['channel', 'range', 'breakout', 'extremes'],
  ),
  rsi: doc(
    'The balance of recent upward and downward price changes.',
    'Wilder-smoothed gains relative to Wilder-smoothed losses on a 0–100 scale.',
    'Above 50, smoothed gains outweigh losses. The 30 and 70 guides mark commonly used low and high regions.',
    'RSI = 100 − 100 / (1 + smoothed gains / smoothed losses); α = 1 / N',
    'High or low readings can persist in trends. Flat prices can produce an undefined gain/loss ratio; initial bars need smoothing history.',
    ['relative strength', 'momentum', 'overbought', 'oversold'],
    { referenceLines: [30, 50, 70] },
  ),
  macd: doc(
    'Two price averages reveal momentum and its changes.',
    'The difference between fast and slow EMAs, its signal EMA, and their residual histogram.',
    'Above zero, the fast average exceeds the slow. Histogram height is the gap between MACD and its signal.',
    'MACD = EMA(fast) − EMA(slow); signal = EMA(MACD); histogram = MACD − signal',
    'Outputs are in price units. Fast period must be smaller than slow period. Crossovers can be frequent in sideways markets.',
    ['convergence', 'divergence', 'momentum', 'histogram'],
    { referenceLines: [0] },
  ),
  rolling_zscore: doc(
    'How far the close sits from its recent average.',
    'The current close’s distance from the trailing mean in sample standard deviations.',
    'Zero is the window mean; +2 is two standard deviations above it and −2 is two below.',
    'Z = (close − rolling mean(close)) / sample std(close)',
    'A constant window or one-bar window has undefined deviation. Large values do not guarantee mean reversion.',
    ['standard score', 'deviation', 'mean reversion'],
    { referenceLines: [-2, 0, 2] },
  ),
  rolling_rank: doc(
    'Where the current close ranks among recent closes.',
    'The fraction of closes in the trailing window that are less than or equal to the current close, including ties.',
    'A rank near 1 means the close is near the top of its recent distribution. The output is a fraction, not a price.',
    'Rank = count(close in window ≤ current close) / window',
    'The smallest possible rank is 1 / window. Equal values all count, so a constant window ranks 1. Missing values leave gaps until the window is complete.',
    ['percentile', 'relative position', 'distribution'],
    {
      referenceLines: [0.25, 0.5, 0.75],
      example: 'For closes 10, 12, 11 and 11, three of four are ≤ the latest close: rank = 0.75.',
    },
  ),
  pct_change: doc(
    'The relative price change over a chosen lookback.',
    'The current close relative to the close a fixed number of bars earlier.',
    'Positive values mean an increase. A value of 0.01 means a 1% increase; the raw output is a decimal.',
    'Change = close / close[lookback bars ago] − 1',
    'Needs an earlier close. Division by a zero price is undefined; the bar interval determines the measured horizon.',
    ['return', 'percentage', 'momentum'],
    { referenceLines: [0], example: 'A move from 100 to 105 gives 0.05, equivalent to 5%.' },
  ),
  log_return: doc(
    'Price movement expressed as a logarithmic return.',
    'The difference between the logarithms of current and earlier closing prices.',
    'Positive values describe an increase. Log returns add across consecutive intervals.',
    'Return = ln(close) − ln(close[horizon bars ago])',
    'Requires positive prices and sufficient history. Log returns differ from simple returns for large moves.',
    ['logarithmic', 'return', 'momentum'],
    { referenceLines: [0] },
  ),
  normalized_momentum: doc(
    'Price momentum scaled by the market’s recent volatility.',
    'A horizon log return divided by per-bar volatility and the square root of the horizon.',
    'The sign gives direction; magnitude expresses movement relative to the selected volatility scale.',
    'Momentum = log return(h) / (volatility[t − lag] × √h)',
    normalizedLimit,
    ['risk adjusted', 'momentum', 'normalized', 'return'],
    { referenceLines: [0] },
  ),
  normalized_ewma_trend_spread: doc(
    'The gap between fast and slow log-price trends, scaled by volatility.',
    'Fast minus slow log-price EWMA, divided by lagged per-bar volatility.',
    'Positive values mean the fast log-price trend is above the slow trend; magnitude is volatility-scaled.',
    'Trend = (EWMA(log close, fast) − EWMA(log close, slow)) / volatility[t − lag]',
    normalizedLimit,
    ['risk adjusted', 'normalized', 'trend', 'exponential'],
    { referenceLines: [0] },
  ),
  price_zscore_log: doc(
    'The close’s relative position in log-price space.',
    'A sample z-score of log closing prices over a trailing window.',
    'Zero marks the mean log price. Positive values lie above it in standard-deviation units.',
    'Z = (ln(close) − mean(ln(close), N)) / sample std(ln(close), N)',
    'Requires positive prices and at least two bars. Constant log prices have undefined deviation; large values do not predict a reversal.',
    ['logarithmic', 'deviation', 'mean reversion'],
    { referenceLines: [-2, 0, 2] },
  ),
  ewma_trend_spread: doc(
    'The distance between fast and slow log-price trends.',
    'The difference between two exponentially weighted log closing prices.',
    'Above zero, the faster log-price average is higher. Half-lives control the response speed.',
    'Spread = EWMA(ln(close), fast half-life) − EWMA(ln(close), slow half-life)',
    'Uses log prices, not raw prices. Requires positive closes and fast half-life smaller than slow half-life; initial values depend on history.',
    ['exponential', 'trend', 'logarithmic'],
    { referenceLines: [0] },
  ),
  atr: doc(
    'A smoothed measure of the bar range, including gaps.',
    'Wilder-smoothed true range in the symbol’s price units.',
    'Higher values mean larger recent ranges, without indicating direction.',
    'TR = max(high − low, |high − previous close|, |low − previous close|); ATR = Wilder smoothing(TR, N)',
    volatilityLimit,
    ['average true range', 'range', 'gaps'],
  ),
  atr_fraction: doc(
    'Average true range relative to the current price.',
    'ATR divided by the current close, giving a dimensionless range fraction.',
    'A value of 0.01 means ATR is 1% of the current close.',
    'ATR fraction = ATR / close',
    'Uses the current close as denominator. Zero or invalid closes leave undefined values; this is a range ratio, not return volatility.',
    ['average true range', 'relative', 'range'],
  ),
  true_range: doc(
    'The current bar’s full range, including price gaps.',
    'The largest of the high–low range and the distances from the previous close.',
    'Higher values mean a wider bar or a larger gap. The result is in price units.',
    'TR = max(high − low, |high − previous close|, |low − previous close|)',
    'One bar can be noisy. When no previous close is available, the high–low range is used.',
    ['range', 'gaps'],
  ),
  realized_vol: doc(
    'Close-to-close variability scaled to a year.',
    'Sample standard deviation of log returns multiplied by the square root of bars per year.',
    'Higher values mean more dispersed recent returns. A raw value of 0.2 corresponds to 20% annualized volatility.',
    'Volatility = sample std(log returns, N) × √(bars per year)',
    'Annualization must match the bar interval and trading calendar. This centered sample deviation differs from the per-bar RMS estimator.',
    ['annualized', 'risk', 'standard deviation'],
  ),
  per_bar_realized_vol: doc(
    'Typical log-return magnitude for one bar.',
    'The root mean square of trailing one-bar log returns, without subtracting their mean.',
    'A larger value means larger typical moves per bar. A raw value of 0.01 is a 1% log-return scale.',
    'Volatility = √mean(one-bar log return², N)',
    'Not annualized and not a centered standard deviation. Sustained returns contribute to the estimate.',
    ['rms', 'realized', 'risk', 'per bar'],
  ),
  per_bar_ewma_vol: doc(
    'A volatility estimate that responds more to recent returns.',
    'The square root of an exponentially weighted mean of squared one-bar log returns.',
    'Shorter half-lives react faster to a change in return magnitude.',
    'Volatility = √EWMA(log return²); α = 1 − exp(−ln(2) / half-life)',
    volatilityLimit,
    ['exponential', 'risk', 'per bar'],
  ),
  rogers_satchell: doc(
    'Volatility estimated from each bar’s open, high, low, and close.',
    'The square root of the mean Rogers–Satchell range expression over a trailing window.',
    'Uses intrabar excursions to describe variability, including in trending markets.',
    'Volatility = √mean[ln(H/O) × ln(H/C) + ln(L/O) × ln(L/C)]',
    'Requires valid positive OHLC prices. Does not include the previous-close-to-open gap and is not annualized.',
    ['ohlc', 'range', 'risk', 'per bar'],
  ),
  per_bar_yang_zhang: doc(
    'An OHLC volatility estimate that includes opening gaps.',
    'A combination of overnight return variance, open-to-close variance, and Rogers–Satchell range variance.',
    'Describes variability from both gaps and intrabar movements.',
    'Volatility = √(sample var[ln(O/previous C)] + k × sample var[ln(C/O)] + (1 − k) × mean[RS]); k = 0.34 / (1.34 + (N + 1)/(N − 1))',
    'Requires positive OHLC values, a previous close, and at least two observations. The chart output is per-bar, not annualized.',
    ['ohlc', 'overnight', 'gaps', 'risk'],
  ),
  volatility_log_ratio: doc(
    'Whether short-term volatility is above its longer-term baseline.',
    'The logarithmic ratio of short and long per-bar volatility estimates.',
    'Zero means equal estimates. Positive values mean the short estimate is higher.',
    'Ratio = ln(short volatility) − ln(long volatility)',
    'The short window or half-life must be smaller than the long one. Near-zero or missing estimates are undefined.',
    ['regime', 'relative', 'risk'],
    {
      referenceLines: [0],
      example:
        'If short volatility is twice long volatility, the ratio is ln(2), approximately 0.693.',
    },
  ),
  value_area_levels: doc(
    'Where volume concentrates within the trading session.',
    'Point of control (POC), value area high (VAH), and value area low (VAL) from stored trades.',
    'Developing levels are known at each bar close. Prior-session levels stay constant for the current session.',
    'Bin trade volume on the instrument tick grid. POC is the largest-volume row; expand toward the larger adjacent row (both on ties) until the selected share is covered.',
    'Requires stored trades and an instrument tick size. Developing includes earlier trades in the same session. Prior-session mode skips missing calendar days; sync contiguous history before using it. No earlier stored session means undefined levels.',
    ['volume', 'poc', 'value area', 'trades', 'session'],
  ),
  quote_spread: doc(
    'The quoted cost of crossing the bid–ask spread.',
    'Relative bid–ask spread aggregated within each bar and displayed in basis points.',
    'Higher values mean a wider quoted spread. One basis point equals 0.01%.',
    'Spread (bps) = 10,000 × (ask − bid) / mid; mid = (ask + bid) / 2',
    'Requires quote history. Stale quotes and insufficient time coverage leave gaps. Quoted spread does not include market impact or commissions.',
    ['liquidity', 'bid ask', 'cost', 'basis points'],
  ),
  spread_vs_volatility: doc(
    'Quoted spread relative to the market’s per-bar movement scale.',
    'Relative bid–ask spread divided by the selected lagged per-bar volatility.',
    'Higher values mean a larger quoted spread relative to typical bar movement.',
    'Ratio = relative quoted spread / volatility[t − lag]',
    'Requires both quotes and bars. Low coverage, stale quotes, and near-zero volatility can make the ratio unavailable.',
    ['liquidity', 'cost', 'risk adjusted', 'bid ask'],
  ),
}

/** Match the catalog service's validation, including its cross-parameter rules. */
export function indicatorParameterErrors(
  entry: IndicatorCatalogEntry,
  config: IndicatorConfig,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const spec of entry.parameters) {
    const value = config.parameters[spec.name] ?? spec.default
    const label = parameterHelp(spec.name).label
    if (spec.type === 'int' || spec.type === 'float') {
      if (typeof value !== 'number' || !Number.isFinite(value))
        errors[spec.name] = `${label} must be a number.`
      else if (spec.type === 'int' && !Number.isInteger(value))
        errors[spec.name] = `${label} must be a whole number.`
      else if (spec.minimum != null && value < spec.minimum)
        errors[spec.name] = `${label} must be at least ${spec.minimum}.`
      else if (spec.maximum != null && value > spec.maximum)
        errors[spec.name] = `${label} must be at most ${spec.maximum}.`
    } else if (
      typeof value !== 'string' ||
      (spec.choices?.length && !spec.choices.includes(value))
    ) {
      errors[spec.name] = `Choose a valid ${label.toLowerCase()}.`
    }
  }
  for (const name of Object.keys(config.parameters)) {
    if (!entry.parameters.some((spec) => spec.name === name))
      errors[name] = `Unknown parameter: ${name}. Reset to defaults to remove it.`
  }
  const lessThan = (fast: string, slow: string) => {
    const a = config.parameters[fast] ?? entry.parameters.find((s) => s.name === fast)?.default
    const b = config.parameters[slow] ?? entry.parameters.find((s) => s.name === slow)?.default
    if (typeof a === 'number' && typeof b === 'number' && a >= b)
      errors[fast] =
        `${parameterHelp(fast).label} must be smaller than ${parameterHelp(slow).label.toLowerCase()}.`
  }
  if (entry.id === 'macd') lessThan('fast_period', 'slow_period')
  if (entry.id === 'ewma_trend_spread' || entry.id === 'normalized_ewma_trend_spread')
    lessThan('fast_half_life', 'slow_half_life')
  if (entry.id === 'volatility_log_ratio') {
    if ((config.parameters.vol_estimator ?? 'realized') === 'ewma')
      lessThan('short_half_life', 'long_half_life')
    else lessThan('short_window', 'long_window')
  }
  return errors
}
