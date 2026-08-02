import { Color, Mesh, Program, Renderer, Triangle } from 'ogl'
import { useEffect, useRef, useState } from 'react'

import {
  type AiVisualState,
  visualStateLabel,
  visualStateToSignalProps,
} from '@/components/backtests/setup/aiVisualState'
import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { registerAnimationLoop } from '@/lib/performance/animationLoopRegistry'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

import './AiInferenceSignal.css'

const MAX_STRANDS = 12
const MAX_COLORS = 8

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColors[${MAX_COLORS}];
uniform int uColorCount;
uniform int uStrandCount;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaviness;
uniform float uThickness;
uniform float uGlow;
uniform float uTaper;
uniform float uSpread;
uniform float uHueShift;
uniform float uIntensity;
uniform float uOpacity;
uniform float uScale;
uniform float uSaturation;

out vec4 fragColor;

const float PI = 3.14159265;

vec3 samplePalette(float t) {
  t = fract(t);
  float scaled = t * float(uColorCount);
  int idx = int(floor(scaled));
  float blend = fract(scaled);
  int nextIdx = idx + 1;
  if (nextIdx >= uColorCount) nextIdx = 0;
  return mix(uColors[idx], uColors[nextIdx], blend);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  uv /= max(uScale, 0.0001);

  float e = 0.06 + uIntensity * 0.94;
  float env = pow(max(cos(uv.x * PI * 1.3), 0.0), uTaper);

  vec3 col = vec3(0.0);

  for (int i = 0; i < ${MAX_STRANDS}; i++) {
    if (i >= uStrandCount) break;

    float fi = float(i);
    float ph = fi * 1.7 * uSpread;
    float freq = (2.0 + fi * 0.35) * uWaviness;
    float spd = 1.4 + fi * 1.2;

    float tt = uTime * uSpeed;
    float w = sin(uv.x * freq + tt * spd + ph) * 0.60
            + sin(uv.x * freq * 1.1 - tt * spd * 0.7 + ph * 1.7) * 0.40;

    float amp = (0.1 + 0.02 * e) * env * uAmplitude;
    float y = w * amp;

    float d = abs(uv.y - y);
    float thick = (0.001 + 0.05 * e) * (0.35 + env) * uThickness;
    float g = thick / (d + thick * 0.45);
    g = g * g;

    float h = fi / float(uStrandCount) + uv.x * 0.30 + uTime * 0.04 + uHueShift;
    col += samplePalette(h) * g * env;
  }

  col *= 0.45 + 0.7 * e;
  col = 1.0 - exp(-col * uGlow);

  float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(gray), col, uSaturation), 0.0);

  float lum = max(max(col.r, col.g), col.b);
  float alpha = clamp(lum, 0.0, 1.0) * uOpacity;

  // Independent soft fades — horizontal starts earlier so left/right never show a hard cut.
  vec2 edge = abs(gl_FragCoord.xy / uResolution - 0.5) * 2.0;
  float fadeX = 1.0 - smoothstep(0.28, 0.92, edge.x);
  float fadeY = 1.0 - smoothstep(0.40, 0.95, edge.y);
  float edgeFade = fadeX * fadeY;
  col *= edgeFade;
  alpha *= edgeFade;

  fragColor = vec4(col * uOpacity, alpha);
}
`

function buildPalette(colors: string[]): number[][] {
  const filled = colors.length > 0 ? colors : ['#9aa1ac']
  const padded: number[][] = []
  for (let i = 0; i < MAX_COLORS; i++) {
    const hex = filled[i] ?? filled[filled.length - 1]
    const c = new Color(hex)
    padded.push([c.r, c.g, c.b])
  }
  return padded
}

function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1
  const isMobile = window.matchMedia('(max-width: 640px)').matches
  const cap = isMobile ? 1.25 : 1.5
  return Math.min(window.devicePixelRatio || 1, cap)
}

function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(() =>
    typeof document !== 'undefined' ? document.hidden : false,
  )

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return hidden
}

export type AiInferenceSignalProps = {
  state: AiVisualState
  variant: 'hero' | 'compact' | 'mobile'
  className?: string
}

export function AiInferenceSignal({ state, variant, className }: AiInferenceSignalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef(state)
  const loopActiveRef = useRef(false)
  const [webglFailed, setWebglFailed] = useState(false)
  const [loopActive, setLoopActive] = useState(false)
  const isReduced = useReducedMotion()
  const documentHidden = useDocumentHidden()
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const onRoute = activeWorkspace === 'strategy-builder'

  stateRef.current = state
  const signalProps = visualStateToSignalProps(state)
  const statusLabel = visualStateLabel(state)

  useEffect(() => {
    const container = containerRef.current
    if (!container || webglFailed || !onRoute) return

    let disposed = false
    let animateId = 0
    let unregisterLoop: (() => void) | undefined
    let resizeObserver: ResizeObserver | undefined

    try {
      const renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
        dpr: getDevicePixelRatio(),
      })
      const gl = renderer.gl
      gl.clearColor(0, 0, 0, 0)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.canvas.setAttribute('aria-hidden', 'true')
      gl.canvas.style.backgroundColor = 'transparent'
      gl.canvas.style.pointerEvents = 'none'

      const geometry = new Triangle(gl)
      if (geometry.attributes.uv) {
        delete geometry.attributes.uv
      }

      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: [1, 1] },
          uColors: { value: buildPalette(signalProps.colors) },
          uColorCount: { value: Math.min(signalProps.colors.length, MAX_COLORS) },
          uStrandCount: { value: signalProps.count },
          uSpeed: { value: signalProps.speed },
          uAmplitude: { value: signalProps.amplitude },
          uWaviness: { value: signalProps.waviness },
          uThickness: { value: signalProps.thickness },
          uGlow: { value: signalProps.glow },
          uTaper: { value: signalProps.taper },
          uSpread: { value: signalProps.spread },
          uHueShift: { value: 0 },
          uIntensity: { value: signalProps.intensity },
          uOpacity: { value: 1 },
          uScale: { value: signalProps.scale },
          uSaturation: { value: signalProps.saturation },
        },
      })

      const mesh = new Mesh(gl, { geometry, program })
      container.appendChild(gl.canvas)

      const applyProps = () => {
        const props = visualStateToSignalProps(stateRef.current)
        program.uniforms.uColors.value = buildPalette(props.colors)
        program.uniforms.uColorCount.value = Math.min(props.colors.length, MAX_COLORS)
        program.uniforms.uStrandCount.value = Math.min(Math.max(Math.round(props.count), 1), MAX_STRANDS)
        program.uniforms.uSpeed.value = props.speed
        program.uniforms.uAmplitude.value = props.amplitude
        program.uniforms.uWaviness.value = props.waviness
        program.uniforms.uThickness.value = props.thickness
        program.uniforms.uGlow.value = props.glow
        program.uniforms.uTaper.value = props.taper
        program.uniforms.uSpread.value = props.spread
        program.uniforms.uIntensity.value = props.intensity
        program.uniforms.uSaturation.value = props.saturation
        program.uniforms.uScale.value = props.scale
      }

      const renderFrame = (t: number) => {
        applyProps()
        program.uniforms.uTime.value = t * 0.001
        renderer.render({ scene: mesh })
      }

      const resize = () => {
        if (disposed || !container) return
        const width = container.clientWidth
        const height = container.clientHeight
        if (width <= 0 || height <= 0) return
        renderer.dpr = getDevicePixelRatio()
        renderer.setSize(width, height)
        program.uniforms.uResolution.value = [width, height]
      }

      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(container)
      resize()

      if (container.clientWidth <= 0 || container.clientHeight <= 0) {
        container.style.minWidth = '100%'
        container.style.minHeight = '240px'
        resize()
      }

      const setLoopRunning = (active: boolean) => {
        if (loopActiveRef.current === active) return
        loopActiveRef.current = active
        setLoopActive(active)
        if (active) {
          unregisterLoop = registerAnimationLoop('ai-inference-signal')
        } else {
          unregisterLoop?.()
          unregisterLoop = undefined
        }
      }

      const shouldAnimate = () =>
        !disposed &&
        !document.hidden &&
        useAppStore.getState().activeWorkspace === 'strategy-builder'

      const tick = (t: number) => {
        animateId = requestAnimationFrame(tick)
        if (!shouldAnimate()) {
          setLoopRunning(false)
          return
        }
        setLoopRunning(true)
        renderFrame(t)
      }

      const onVisibility = () => {
        if (document.hidden) {
          setLoopRunning(false)
        } else if (isReduced) {
          renderFrame(performance.now())
        }
      }
      document.addEventListener('visibilitychange', onVisibility)

      if (isReduced) {
        renderFrame(0)
        setLoopRunning(false)
      } else {
        animateId = requestAnimationFrame(tick)
      }

      return () => {
        disposed = true
        cancelAnimationFrame(animateId)
        document.removeEventListener('visibilitychange', onVisibility)
        resizeObserver?.disconnect()
        unregisterLoop?.()
        if (container.contains(gl.canvas)) {
          container.removeChild(gl.canvas)
        }
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      }
    } catch {
      setWebglFailed(true)
      return undefined
    }
  }, [isReduced, onRoute, webglFailed])

  useEffect(() => {
    if (webglFailed || !onRoute) return
    const container = containerRef.current
    const canvas = container?.querySelector('canvas')
    if (!canvas) return

    if (isReduced || documentHidden) {
      loopActiveRef.current = false
      setLoopActive(false)
    }
  }, [documentHidden, isReduced, onRoute, state, webglFailed])

  const variantClass =
    variant === 'hero'
      ? 'inference-signal--hero'
      : variant === 'compact'
        ? 'inference-signal--compact'
        : 'inference-signal--mobile'

  return (
    <div
      ref={containerRef}
      className={cn('inference-signal', variantClass, className)}
      data-testid="ai-inference-signal"
      data-visual-state={state}
      data-loop-active={loopActive ? 'true' : 'false'}
      data-webgl-failed={webglFailed ? 'true' : 'false'}
    >
      <span className="inference-signal__label" role="status">
        {statusLabel}
      </span>
    </div>
  )
}
