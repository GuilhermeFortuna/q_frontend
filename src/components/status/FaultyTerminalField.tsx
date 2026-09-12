/**
 * Adapted from React Bits Faulty Terminal (P-005 / WO219).
 * Source: https://github.com/DavidHDev/react-bits @ d26ed7a476148f1253cca3f5bc9f679fda53e1f5
 *   FaultyTerminal.tsx SHA-256 1abec80d7bccfdf9d58da3344f28049cc4bcf3d501dc5e9f0400298edf410114
 *   FaultyTerminal.css SHA-256 d769937672090dfd768c6a46912defd9de0eefd64dc22a9d9bf5eb1ce7b3d4b6
 *
 * Q adaptation: local failure-surface background only. Mouse react, page-load spectacle,
 * and demo palette removed. Brass/silver tint, low-density grid, capped ≤20 fps loop,
 * paused when hidden/offscreen, fully disposed on unmount. Never AppShell / always-on.
 */
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl'
import { useEffect, useRef, useState } from 'react'

import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { registerAnimationLoop } from '@/lib/performance/animationLoopRegistry'
import { cn } from '@/lib/utils'

import './FaultyTerminalField.css'

const LOOP_ID = 'faulty-terminal-field'
/** Cap decorative RAF to ≤20 fps per WO219. */
const FRAME_INTERVAL_MS = 1000 / 20

/** Brass/silver signal — rose is reserved for the status glyph above. */
const TINT_BRASS_SILVER: [number, number, number] = [184 / 255, 168 / 255, 120 / 255]

const VERT = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `
precision mediump float;

varying vec2 vUv;

uniform float iTime;
uniform vec3 iResolution;
uniform float uScale;

uniform vec2 uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform float uNoiseAmp;
uniform float uChromaticAberration;
uniform float uDither;
uniform float uCurvature;
uniform vec3 uTint;
uniform float uBrightness;

float time;

float hash21(vec2 p){
  p = fract(p * 234.56);
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float noise(vec2 p)
{
  return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2;
}

mat2 rotate(float angle)
{
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p)
{
  p *= 1.1;
  float f = 0.0;
  float amp = 0.5 * uNoiseAmp;

  mat2 modify0 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify0 * p * 2.0;
  amp *= 0.454545;

  mat2 modify1 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify1 * p * 2.0;
  amp *= 0.454545;

  mat2 modify2 = rotate(time * 0.08);
  f += amp * noise(p);

  return f;
}

float pattern(vec2 p, out vec2 q, out vec2 r) {
  vec2 offset1 = vec2(1.0);
  vec2 offset0 = vec2(0.0);
  mat2 rot01 = rotate(0.1 * time);
  mat2 rot1 = rotate(0.1);

  q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
  r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
  return fbm(p + r);
}

float digit(vec2 p){
  vec2 grid = uGridMul * 15.0;
  vec2 s = floor(p * grid) / grid;
  p = p * grid;
  vec2 q, r;
  float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;

  p = fract(p);
  p *= uDigitSize;

  float px5 = p.x * 5.0;
  float py5 = (1.0 - p.y) * 5.0;
  float x = fract(px5);
  float y = fract(py5);

  float i = floor(py5) - 2.0;
  float j = floor(px5) - 2.0;
  float n = i * i + j * j;
  float f = n * 0.0625;

  float isOn = step(0.1, intensity - f);
  float brightness = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);

  return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * brightness;
}

float onOff(float a, float b, float c)
{
  return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
}

float displace(vec2 look)
{
  float y = look.y - mod(iTime * 0.25, 1.0);
  float window = 1.0 / (1.0 + 50.0 * y * y);
  return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
}

vec3 getColor(vec2 p){
  float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;
  bar *= uScanlineIntensity;

  float displacement = displace(p);
  p.x += displacement;

  if (uGlitchAmount != 1.0) {
    float extra = displacement * (uGlitchAmount - 1.0);
    p.x += extra;
  }

  float middle = digit(p);

  const float off = 0.002;
  float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
    digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +
    digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));

  vec3 baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;
  return baseColor;
}

vec2 barrel(vec2 uv){
  vec2 c = uv * 2.0 - 1.0;
  float r2 = dot(c, c);
  c *= 1.0 + uCurvature * r2;
  return c * 0.5 + 0.5;
}

void main() {
  time = iTime * 0.333333;
  vec2 uv = vUv;

  if(uCurvature != 0.0){
    uv = barrel(uv);
  }

  vec2 p = uv * uScale;
  vec3 col = getColor(p);

  if(uChromaticAberration != 0.0){
    vec2 ca = vec2(uChromaticAberration) / iResolution.xy;
    col.r = getColor(p + ca).r;
    col.b = getColor(p - ca).b;
  }

  col *= uTint;
  col *= uBrightness;

  if(uDither > 0.0){
    float rnd = hash21(gl_FragCoord.xy);
    col += (rnd - 0.5) * (uDither * 0.003922);
  }

  gl_FragColor = vec4(col, 1.0);
}
`

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

export type FaultyTerminalFieldProps = {
  className?: string
}

export function FaultyTerminalField({ className }: FaultyTerminalFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const loopActiveRef = useRef(false)
  const onScreenRef = useRef(true)
  const [webglFailed, setWebglFailed] = useState(false)
  const [loopActive, setLoopActive] = useState(false)
  const isReduced = useReducedMotion()
  const documentHidden = useDocumentHidden()

  useEffect(() => {
    const container = containerRef.current
    if (!container || webglFailed) return

    let disposed = false
    let animateId = 0
    let unregisterLoop: (() => void) | undefined
    let resizeObserver: ResizeObserver | undefined
    let intersectionObserver: IntersectionObserver | undefined
    let lastFrameAt = 0
    const timeOffset = Math.random() * 100
    const timeScale = 0.25

    try {
      const renderer = new Renderer({
        alpha: true,
        dpr: getDevicePixelRatio(),
      })
      const gl = renderer.gl
      gl.clearColor(0, 0, 0, 0)
      gl.canvas.setAttribute('aria-hidden', 'true')
      gl.canvas.style.pointerEvents = 'none'
      gl.canvas.style.opacity = '0.55'

      const geometry = new Triangle(gl)
      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          iTime: { value: 0 },
          iResolution: {
            value: new Color(1, 1, 1),
          },
          uScale: { value: 1.15 },
          // Low-density terminal grid
          uGridMul: { value: new Float32Array([1.15, 0.85]) },
          uDigitSize: { value: 1.25 },
          uScanlineIntensity: { value: 0.22 },
          uGlitchAmount: { value: 0.55 },
          uFlickerAmount: { value: 0.3 },
          uNoiseAmp: { value: 0.4 },
          uChromaticAberration: { value: 0 },
          uDither: { value: 0 },
          uCurvature: { value: 0.06 },
          uTint: {
            value: new Color(TINT_BRASS_SILVER[0], TINT_BRASS_SILVER[1], TINT_BRASS_SILVER[2]),
          },
          uBrightness: { value: 0.5 },
        },
      })

      const mesh = new Mesh(gl, { geometry, program })
      container.appendChild(gl.canvas)

      const resize = () => {
        if (disposed || !container) return
        const width = container.clientWidth
        const height = container.clientHeight
        if (width <= 0 || height <= 0) return
        renderer.dpr = getDevicePixelRatio()
        renderer.setSize(width, height)
        program.uniforms.iResolution.value = new Color(
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / Math.max(gl.canvas.height, 1),
        )
      }

      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(container)
      resize()

      const setLoopRunning = (active: boolean) => {
        if (loopActiveRef.current === active) return
        loopActiveRef.current = active
        setLoopActive(active)
        if (active) {
          unregisterLoop = registerAnimationLoop(LOOP_ID)
        } else {
          unregisterLoop?.()
          unregisterLoop = undefined
        }
      }

      intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          onScreenRef.current = entry?.isIntersecting ?? false
          if (!onScreenRef.current) {
            setLoopRunning(false)
          }
        },
        { threshold: 0 },
      )
      intersectionObserver.observe(container)

      const renderFrame = (t: number) => {
        const elapsed = (t * 0.001 + timeOffset) * timeScale
        program.uniforms.iTime.value = elapsed
        renderer.render({ scene: mesh })
      }

      const shouldAnimate = () => !disposed && !document.hidden && onScreenRef.current && !isReduced

      const tick = (t: number) => {
        animateId = requestAnimationFrame(tick)
        if (!shouldAnimate()) {
          setLoopRunning(false)
          return
        }
        if (t - lastFrameAt < FRAME_INTERVAL_MS) return
        lastFrameAt = t
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
        intersectionObserver?.disconnect()
        unregisterLoop?.()
        loopActiveRef.current = false
        if (container.contains(gl.canvas)) {
          container.removeChild(gl.canvas)
        }
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      }
    } catch {
      setWebglFailed(true)
      return undefined
    }
  }, [isReduced, webglFailed])

  useEffect(() => {
    if (webglFailed) return
    if (isReduced || documentHidden || !onScreenRef.current) {
      loopActiveRef.current = false
      setLoopActive(false)
    }
  }, [documentHidden, isReduced, webglFailed])

  return (
    <div
      ref={containerRef}
      className={cn('faulty-terminal-field', className)}
      aria-hidden="true"
      data-testid="faulty-terminal-field"
      data-loop-active={loopActive ? 'true' : 'false'}
      data-webgl-failed={webglFailed ? 'true' : 'false'}
      data-reduced-motion={isReduced ? 'true' : 'false'}
    />
  )
}
