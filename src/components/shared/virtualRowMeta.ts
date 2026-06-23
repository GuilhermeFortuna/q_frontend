export type VirtualRowMeta = {
  /** Attach to the primary row element for dynamic height measurement. */
  measureRef?: (element: Element | null) => void
  virtualIndex?: number
}
