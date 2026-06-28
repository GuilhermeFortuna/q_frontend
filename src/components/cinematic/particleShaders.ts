// Waving Financial Manifold Surface Shaders
export const particleVertexShader = `
  uniform float uTime;
  uniform vec3 uMouse;
  uniform float uMouseStrength;
  uniform vec3 uShockwaveOrigin;
  uniform float uShockwaveTime;

  varying vec3 vWorldPosition;
  varying float vElevation;

  void main() {
    vec3 pos = position;

    // 1. Slow, organic wave math (financial topology waves)
    float waveX = sin(pos.x * 0.08 + uTime * 0.45) * cos(pos.y * 0.12 + uTime * 0.35);
    float waveY = sin(pos.y * 0.07 + uTime * 0.4) * cos(pos.x * 0.06 - uTime * 0.25);
    float elevation = (waveX + waveY) * 2.2;

    // 2. Localized cursor repulsion (gravity well displacement)
    float distToMouse = distance(pos.xy, uMouse.xy);
    float mouseInfluence = exp(-distToMouse * distToMouse * 0.012);
    elevation -= mouseInfluence * uMouseStrength * 4.2;

    // 3. Propagating click shockwave ripple
    if (uShockwaveTime > 0.0 && uShockwaveTime < 2.0) {
      float distToClick = distance(pos.xy, uShockwaveOrigin.xy);
      float waveSpeed = 26.0;
      float front = uShockwaveTime * waveSpeed;
      float diff = abs(distToClick - front);
      float shockInfluence = exp(-diff * diff * 0.07) * exp(-uShockwaveTime * 1.5);
      float shockRipple = sin(diff * 1.2 - uTime * 4.0) * shockInfluence * 4.0;
      elevation += shockRipple;
    }

    pos.z += elevation;
    vElevation = elevation;
    vWorldPosition = pos;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Scale node point sizes based on camera depth (elegant sharp node dots)
    float depth = max(0.1, -mvPosition.z);
    gl_PointSize = 0.18 * (650.0 / depth);
  }
`

export const particleFragmentShader = `
  uniform vec3 uColor;
  uniform float uGlow;
  varying vec3 vWorldPosition;
  varying float vElevation;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // Fade edges of the grid so it disappears at the borders
    float fadeX = smoothstep(30.0, 16.0, abs(vWorldPosition.x));
    float fadeY = smoothstep(18.0, 10.0, abs(vWorldPosition.y));
    float edgeFade = fadeX * fadeY;

    // Soft glow drop-off
    float glow = exp(-dist * 5.0);

    // Fade color based on elevation height
    float heightNorm = (vElevation + 3.0) / 6.0;
    vec3 heightColor = mix(uColor * 0.6, vec3(1.0, 0.95, 0.8), clamp(heightNorm, 0.0, 1.0) * 0.45);
    vec3 finalColor = mix(uColor, heightColor, 0.5);
    finalColor = mix(finalColor, vec3(1.0, 0.9, 0.6), uGlow * 0.35);

    gl_FragColor = vec4(finalColor, glow * edgeFade * 0.45);
  }
`

export const wireframeFragmentShader = `
  uniform vec3 uColor;
  uniform float uGlow;
  varying vec3 vWorldPosition;
  varying float vElevation;

  void main() {
    // Fade edges of the grid
    float fadeX = smoothstep(30.0, 16.0, abs(vWorldPosition.x));
    float fadeY = smoothstep(18.0, 10.0, abs(vWorldPosition.y));
    float edgeFade = fadeX * fadeY;

    // Higher lines are brighter
    float heightNorm = (vElevation + 3.0) / 6.0;
    vec3 heightColor = mix(uColor * 0.35, uColor * 1.45, clamp(heightNorm, 0.0, 1.0));
    vec3 finalColor = mix(heightColor, vec3(1.0, 0.92, 0.65), uGlow * 0.45);

    gl_FragColor = vec4(finalColor, edgeFade * 0.12);
  }
`
