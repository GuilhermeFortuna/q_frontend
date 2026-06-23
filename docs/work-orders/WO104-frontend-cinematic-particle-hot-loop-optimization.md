# WO104 — Frontend: remove cinematic particle hot-loop allocations

## Shared context (read first)

Frontend-only WO. Use `pnpm`, never `npm`.

Depends on **WO97** and should use fixed **WO102** instrumentation for verification.

**Review finding:** the new `CinematicParticles` loop still allocates `THREE.Vector3` instances every
frame despite comments saying temporary math objects prevent GC churn. This can contribute to
launcher stutter while preserving the cinematic look.

## Goal

Keep the launcher cinematic particle effect visually rich while making the animation loop allocation
free or near allocation free:

- no `clone()` or `new THREE.Vector3()` inside `useFrame`;
- no per-particle object allocation;
- no visual downgrade;
- measurable improvement or at least no regression in WO96 HUD readings.

## How the pieces work today

Read:

- `src/components/cinematic/CinematicScene.tsx`
- `src/components/cinematic/CinematicParticles.tsx`
- `src/components/cinematic/particleShaders.ts`
- `src/lib/cinematic/cinematicQuality.ts`
- `src/lib/performance/animationLoopRegistry.ts`
- `src/lib/performance/performanceMonitor.ts`
- `docs/runtime-performance.md`

Focus on these hot-path patterns in `CinematicParticles`:

- `state.camera.position.clone()`
- `tempPos.clone()`
- `new THREE.Vector3(...)` inside click projection
- repeated matrix/vector conversions inside the per-frame/per-particle loop.

## Tasks

### 1. Replace frame-loop allocations with scratch objects

Preallocate all reusable math objects with `useMemo` or `useRef`, including:

- mouse direction and world position;
- click projection vector and direction;
- per-particle `toMouse`;
- per-particle `toShockwave`;
- any temporary normalized vectors.

Use `.copy()`, `.subVectors()`, `.addScaledVector()`, and `.set()` instead of `.clone()` in the hot
path.

### 2. Keep constants out of the frame loop

Move physics constants out of `useFrame` or into stable module-level constants:

- spring coefficient;
- damping;
- repel radius/force;
- shockwave speed/thickness/force.

### 3. Preserve interaction quality

Cursor repulsion, click shockwave, background drift, foreground parallax, and shader twinkle should
remain visible.

If any interaction must be simplified, provide side-by-side justification and a cheaper equivalent
that still looks premium.

### 4. Add guard tests where practical

Unit testing allocation-free animation is hard, but add focused tests for:

- quality profile still enables launcher particles;
- reduced-motion and hidden-document modes still pause/remove the loop;
- no regression in existing `CinematicScene` tests.

If a lightweight static test is added to assert no `.clone()` / `new THREE.Vector3` inside the
`useFrame` block, keep it narrow and maintainable.

## Visual guardrails

> The cinematic look is non-negotiable. This WO optimizes implementation mechanics, not aesthetics.

> Do not remove particles, shockwaves, parallax, vignette, or brand atmosphere as the primary fix.

## Tests

- `pnpm test:run -- tests/unit/components/CinematicScene.test.tsx tests/unit/lib/cinematic/*`
- `pnpm test:run`
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
- `pnpm build`

## Manual verification

With `VITE_PERF_HUD=true` after WO102:

- verify launcher canvas count and animation loop count are expected;
- interact with cursor and click shockwave;
- compare screenshots/video before and after;
- record FPS/dropped-frame/long-task readings on `/`.

## Definition of done

- No object allocation remains inside the `useFrame` hot path except unavoidable library internals.
- Launcher particle visuals and interactions are preserved or improved.
- WO96 HUD readings are recorded before/after.
- Required test/typecheck/build commands pass.

## Out of scope

- Replacing Three.js entirely.
- Redesigning the scene art direction.
- Optimizing feature-specific 3D surfaces.
