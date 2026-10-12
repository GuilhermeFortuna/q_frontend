import type Plotly from 'plotly.js-dist-min'

export type PlotlyApi = typeof Plotly

let loading: Promise<PlotlyApi> | null = null

/**
 * Loads `plotly.js-dist-min` as its own chunk the first time a Plotly figure is
 * on screen. A failed load is retried on the next call.
 */
export function loadPlotly(): Promise<PlotlyApi> {
  loading ??= import('plotly.js-dist-min').then(
    (module) => module.default,
    (error: unknown) => {
      loading = null
      throw error
    },
  )
  return loading
}
