import type { BandScale } from '@/components/charts/types/scales'

/**
 * Maps epoch-millisecond instants to chart x coordinates through bar position.
 *
 * A bar position is fractional: bar `i` occupies positions `[i - 0.5, i + 0.5)`, the same span
 * its candle covers on the band scale, so its centre is at `i`. Inside the loaded bars an instant
 * sits in the bar that contains it, offset by its share of the timeframe's bar duration. Before
 * the first and after the last loaded bar the mapping extrapolates by that duration, so off-chart
 * anchors keep their true place. Wall-clock gaps between sessions do not stretch the axis.
 */
export type TimeMapper = {
  /** Absolute SVG x of an instant. */
  xOfTime: (time: number) => number
  /** Instant at an absolute SVG x. */
  timeOfX: (x: number) => number
  xOfPosition: (position: number) => number
  positionOfX: (x: number) => number
  positionOfTime: (time: number) => number
  timeOfPosition: (position: number) => number
}

export type TimeMapperInput = {
  /** Open time (epoch ms) of every loaded bar, ascending. */
  times: readonly number[]
  timeframeMs: number
  /** Bar position of the first slot in view. */
  startIndex: number
  /** Chart-relative x of the first slot's centre and the distance between slot centres. */
  firstSlotX: number
  slotStep: number
  /** Added to every chart-relative x to give an absolute SVG x. */
  left: number
}

export function createTimeMapper({
  times,
  timeframeMs,
  startIndex,
  firstSlotX,
  slotStep,
  left,
}: TimeMapperInput): TimeMapper {
  const count = times.length
  const duration = timeframeMs > 0 ? timeframeMs : 1
  const step = slotStep > 0 ? slotStep : 1

  const positionOfTime = (time: number): number => {
    if (count === 0) return Number.NaN
    if (time < times[0]) return -0.5 + (time - times[0]) / duration
    const index = indexAtOrBefore(times, time)
    const offset = (time - times[index]) / duration
    // A gap between sessions is not a bar: clamp inside the bar except after the last one.
    const within = index === count - 1 ? offset : Math.min(offset, 1)
    return index - 0.5 + within
  }

  const timeOfPosition = (position: number): number => {
    if (count === 0) return Number.NaN
    const shifted = position + 0.5
    if (shifted < 0) return times[0] + shifted * duration
    const index = Math.min(Math.floor(shifted), count - 1)
    return times[index] + (shifted - index) * duration
  }

  const xOfPosition = (position: number): number =>
    left + firstSlotX + (position - startIndex) * step
  const positionOfX = (x: number): number => startIndex + (x - left - firstSlotX) / step

  return {
    xOfTime: (time) => xOfPosition(positionOfTime(time)),
    timeOfX: (x) => timeOfPosition(positionOfX(x)),
    xOfPosition,
    positionOfX,
    positionOfTime,
    timeOfPosition,
  }
}

/** Index of the last bar whose open time is at or before `time`. `times` must be non-empty. */
function indexAtOrBefore(times: readonly number[], time: number): number {
  let low = 0
  let high = times.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (times[middle] <= time) {
      low = middle
    } else {
      high = middle - 1
    }
  }
  return low
}

/** Builds the mapper from the band scale the candles are drawn with. */
export function timeMapperFromScale(
  xScale: BandScale,
  startIndex: number,
  times: readonly number[],
  timeframeMs: number,
  left: number,
): TimeMapper {
  const [firstKey] = xScale.domain()
  const firstSlotX = firstKey === undefined ? 0 : (xScale(firstKey) ?? 0) + xScale.bandwidth() / 2
  return createTimeMapper({
    times,
    timeframeMs,
    startIndex,
    firstSlotX,
    slotStep: xScale.step(),
    left,
  })
}
