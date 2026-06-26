// Reflective dust motes: mostly dim with brief specular glints (+ diffraction spikes).
export const particleVertexShader = `
  uniform float uTime;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vTwinkle;
  varying float vGlint;

  void main() {
    vColor = aColor;

    float speed = 0.5 + aPhase * 0.12;
    float wave = 0.5 + 0.5 * sin(uTime * speed + aPhase * 7.0);
    float glint = pow(wave, 24.0);
    vGlint = glint;

    vTwinkle = 0.12 + 1.15 * glint;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float depth = max(0.1, -mvPosition.z);
    gl_PointSize = aSize * (1350.0 / depth);
    gl_Position = projectionMatrix * mvPosition;
  }
`

export const particleFragmentShader = `
  uniform float uGlow;
  varying vec3 vColor;
  varying float vTwinkle;
  varying float vGlint;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    if (dist > 0.5) discard;

    float intensity = exp(-dist * 8.0);

    float aura = max(0.0, 1.0 - dist * 2.0);
    float halo = 0.18 * aura * aura;

    float core = smoothstep(0.09, 0.0, dist) * 0.75;

    float spikeH = smoothstep(0.5, 0.0, abs(center.y) * 6.0) * smoothstep(0.5, 0.0, abs(center.x));
    float spikeV = smoothstep(0.5, 0.0, abs(center.x) * 6.0) * smoothstep(0.5, 0.0, abs(center.y));
    float spikes = (spikeH + spikeV) * vGlint * 0.45;

    float alpha = min(1.0, (intensity + halo + core + spikes) * vTwinkle * 1.35);

    vec3 finalColor = mix(vColor, vec3(1.0, 0.9, 0.62), smoothstep(0.06, 0.0, dist) * 0.7);
    finalColor = mix(finalColor, vec3(0.94, 0.62, 0.15), uGlow * 0.5);

    gl_FragColor = vec4(finalColor, alpha);
  }
`
