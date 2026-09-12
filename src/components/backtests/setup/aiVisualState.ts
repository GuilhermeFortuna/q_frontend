export type AiVisualState = 'idle' | 'composing' | 'thinking' | 'streaming' | 'done' | 'error'

export type SignalUniformProps = {
  count: number
  speed: number
  amplitude: number
  waviness: number
  thickness: number
  glow: number
  taper: number
  spread: number
  intensity: number
  saturation: number
  /** Shader field zoom; higher values shrink the woven pattern within the canvas. */
  scale: number
  colors: string[]
}

/** Q-native palette tokens for the inference signal shader. */
const PALETTE = {
  silver: '#9aa1ac',
  brass: '#d99e22',
  brassLight: '#f0b429',
  cream: '#f0e6d0',
  rose: '#f87171',
  graphite: '#22262c',
} as const

export type DeriveAiVisualStateInput = {
  serviceError: string | null
  interpretFailed: boolean
  isPending: boolean
  hasIncrementalOutput: boolean
  isDoneHold: boolean
  composerFocused: boolean
  message: string
}

export function deriveAiVisualState(input: DeriveAiVisualStateInput): AiVisualState {
  if (input.serviceError || input.interpretFailed) {
    return 'error'
  }
  if (input.isPending && input.hasIncrementalOutput) {
    return 'streaming'
  }
  if (input.isPending) {
    return 'thinking'
  }
  if (input.isDoneHold) {
    return 'done'
  }
  if (input.composerFocused && input.message.trim().length > 0) {
    return 'composing'
  }
  return 'idle'
}

export function visualStateLabel(state: AiVisualState): string {
  switch (state) {
    case 'idle':
      return 'AI idle'
    case 'composing':
      return 'Drafting prompt'
    case 'thinking':
      return 'Interpreting strategy'
    case 'streaming':
      return 'Presenting response'
    case 'done':
      return 'Strategy ready'
    case 'error':
      return 'AI unavailable'
    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }
}

export function visualStateToSignalProps(state: AiVisualState): SignalUniformProps {
  switch (state) {
    case 'idle':
      return {
        count: 3,
        speed: 0.5,
        amplitude: 1.0,
        waviness: 1.5,
        thickness: 0.7,
        glow: 1.0,
        taper: 1.5,
        spread: 1.0,
        intensity: 0.6,
        saturation: 2.0,
        scale: 5.0,
        colors: [PALETTE.silver, PALETTE.brass, PALETTE.rose],
      }
    case 'composing':
      return {
        count: 2,
        speed: 0.32,
        amplitude: 0.72,
        waviness: 0.95,
        thickness: 0.52,
        glow: 2.0,
        taper: 3.6,
        spread: 0.85,
        intensity: 0.42,
        saturation: 0.95,
        scale: 1.45,
        colors: [PALETTE.silver, PALETTE.brassLight, PALETTE.brass],
      }
    case 'thinking':
      return {
        count: 3,
        speed: 0.62,
        amplitude: 0.88,
        waviness: 1.35,
        thickness: 0.62,
        glow: 2.4,
        taper: 2.8,
        spread: 0.62,
        intensity: 0.72,
        saturation: 1.05,
        scale: 1.35,
        colors: [PALETTE.silver, PALETTE.brass, PALETTE.cream],
      }
    case 'streaming':
      return {
        count: 3,
        speed: 0.78,
        amplitude: 0.92,
        waviness: 1.2,
        thickness: 0.58,
        glow: 2.5,
        taper: 2.6,
        spread: 0.7,
        intensity: 0.8,
        saturation: 1.0,
        scale: 1.4,
        colors: [PALETTE.brass, PALETTE.cream, PALETTE.brassLight],
      }
    case 'done':
      return {
        count: 2,
        speed: 0.18,
        amplitude: 0.65,
        waviness: 0.75,
        thickness: 0.55,
        glow: 2.8,
        taper: 3.2,
        spread: 0.55,
        intensity: 0.58,
        saturation: 1.0,
        scale: 1.5,
        colors: [PALETTE.brassLight, PALETTE.cream, PALETTE.brass],
      }
    case 'error':
      return {
        count: 2,
        speed: 0.08,
        amplitude: 0.35,
        waviness: 0.6,
        thickness: 0.4,
        glow: 1.4,
        taper: 5.0,
        spread: 1.6,
        intensity: 0.32,
        saturation: 0.75,
        scale: 1.6,
        colors: [PALETTE.graphite, PALETTE.silver, PALETTE.rose],
      }
    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }
}
