# WO213 — Frontend: LiveSceneLayer in CinematicScene (player, fallback, state feed)

## Shared context (read first)

Fourth of the **WO210–WO214 live UE5 background batch** (overview in WO210). Execution:
`{ 210 ∥ 211 } → 🔍A → 212 → 213 → 🔍B → 214`. Blocked on WO212 (consumes its port,
protocol path, and health payload). After this WO merges, 🔍B reviews the whole stack
before WO214 does live E2E with a real UE5 scene.

This WO puts the live scene on screen: a `LiveSceneLayer` inside `CinematicScene` that
plays the UE5 stream in a `<video>` positioned exactly like today's static background
layers, fades in only when frames are genuinely flowing, feeds app state + mouse parallax
to UE5, and falls back to the existing static scene in every failure mode. The static
layers are **never removed** — they are the permanent floor of the stack.

Frontend repo: `q_frontend` — React/TS/Vite, `pnpm` (never npm), vitest. Read WO210's
spike report first: it decides whether the player is WebRTC (`RTCPeerConnection` +
Pixel Streaming player handshake) or WS+MSE (`MediaSource` fed from the bridge socket).

## How the pieces work today (read these files)

- `src/components/cinematic/CinematicScene.tsx` — the stack this slots into (static
  branded/clean divs at the bottom, particles `Canvas`, vignette/noise on top); note the
  existing opacity/crossfade patterns and `data-*` test attributes
- `src/lib/cinematic/cinematicQuality.ts` (`resolveCinematicQuality`) — the quality
  profile this layer must obey (reduced motion, document hidden, active 3D feature)
- `src/hooks/usePrefersReducedMotion.ts`, `src/hooks/useFeature3DActive.ts`,
  `src/hooks/useResolvedBrightness.ts` — existing gates
- `src/lib/performance/performanceMonitor.ts` + `animationLoopRegistry.ts` — register the
  live layer like the particle loop does
- `src/store/useAppStore.ts` — `activeWorkspace` and whatever job/status state exists
  (source of the state feed; check what optimization/discovery status the store already
  holds before inventing selectors)
- `docs/dev/visual-bridge.md` — port, protocol path, `q_state` envelope, health payload
  (WO211/212 contract)
- `scripts/spike/` — WO210's throwaway harness; **delete it in this WO** (see guardrails)

## Goal

```tsx
// src/components/cinematic/LiveSceneLayer.tsx
export function LiveSceneLayer(props: { profile: CinematicQualityProfile }): JSX.Element
// <video> layer: connects when bridge health says streamer_connected,
// fades in on first real frames, fades out + reconnects on stall/drop
```

With UE5 running: the background is the live scene, reacting to workspace switches and
job progress, with mouse parallax. UE5 absent/dead/stalled or feature toggled off: pixel-
identical behavior to today. `pnpm test` green on machines with no bridge at all.

## Tasks

1. **Bridge client.** `src/lib/visualBridge/client.ts`: subscribes to
   `visual-bridge://health` (Tauri event API — degrade silently when not running under
   Tauri, e.g. plain `vite dev`/vitest), and implements the player per the spike verdict:
   WebRTC Pixel Streaming player handshake against `ws://127.0.0.1:<port>/ws`, or the
   MSE pump. Expose a small state machine to React:
   `idle | connecting | live | stalled | unavailable`, plus `attach(video: HTMLVideoElement)`.
   Reconnect with capped backoff; never throw to the UI.
2. **Stall watchdog.** `requestVideoFrameCallback`-based: no new frame for 2s while
   `live` ⇒ `stalled` (fade out, keep trying); frames resume ⇒ `live` (fade in). This is
   the guarantee that a frozen UE5 never leaves a corpse frame on screen.
3. **LiveSceneLayer component.** Renders the `<video muted playsInline>` absolutely
   positioned in the background stack, opacity-animated with the same 700ms crossfade
   idiom as the static layers, `data-testid="live-scene-layer"`,
   `data-live-state={state}`. Mounted in `CinematicScene` between the static background
   divs and the particles `Canvas`. When state ≠ `live`, opacity 0 — static scene shows
   through. Respect the quality profile: profile says hide (reduced motion, document
   hidden, active feature-3D) ⇒ disconnect entirely (not just hide — release the decoder).
   Register with `animationLoopRegistry` while `live`.
4. **State feed.** `src/lib/visualBridge/stateFeed.ts`: derive the `q_state` payload
   `{ workspace, symbol, jobStatus, progress, risk }` from the app store (map from what
   the store actually exposes; fields with no live source ship as `null` — never mock
   values), send via `visual_bridge_send_state` on change (debounced 250ms). Mouse
   parallax: normalized `{x,y}` at ≤ 30Hz — over the WebRTC data channel when on the
   A-path, else through the same command (the bridge already rate-limits at 30/s).
   Parallax pauses when the layer isn't `live`.
5. **Settings toggle.** `liveScene: 'auto' | 'off'` in the existing settings store/UI
   (follow the established settings pattern — find where brightness mode lives).
   `'off'` ⇒ client never connects. Default `'auto'`.
6. **Spike cleanup.** Delete `scripts/spike/` and any WO210 scratch route/flag. The spike
   report doc stays.

## Guardrails

> **The static scene is the permanent floor** — no removal, no conditional unmounting of
> today's layers. Every failure mode must visually resolve to the current background
> within one crossfade.
> **No mock imports outside tests** (house CI grep) and **no mock values in initial
> state**: the layer starts `idle`/opacity-0; state-feed fields without a real source are
> `null`.
> **Non-Tauri environments** (vitest, plain vite, CI) must not error or log spam: the
> client resolves to `unavailable` silently.
> **Release resources when hidden**: document hidden or profile-hidden ⇒ full disconnect,
> no decoding in the background.
> **Bundle discipline**: no new runtime deps for the player (WebRTC/MSE are platform
> APIs). If the Pixel Streaming handshake needs Epic's frontend lib, vendor only the
> signalling handshake logic (small), don't add the full `@epicgames-ps` stack — report
> the bundle delta.

## Tests

vitest (`src/components/cinematic/__tests__/LiveSceneLayer.test.tsx` +
`src/lib/visualBridge/__tests__/`):

- non-Tauri env ⇒ `unavailable`, opacity 0, no errors
- mocked client `live` ⇒ video layer opacity > 0, `data-live-state="live"`,
  animation loop registered
- `live → stalled` (fake watchdog) ⇒ fades out, static visible; `stalled → live` ⇒ back
- profile hidden / reduced motion / `'off'` toggle ⇒ client `disconnect()` called
- state feed: store change ⇒ one debounced `visual_bridge_send_state` with correct
  envelope; missing sources ⇒ `null` fields; parallax throttled to ≤ 30Hz and paused
  when not live
- `CinematicScene` existing tests stay green (layer order unchanged for static/particles/
  vignette/noise)

## Docs

Extend `docs/dev/visual-bridge.md`: frontend states, the settings toggle, the state-feed
field mapping (which store selectors feed which `q_state` fields).

## Definition of done

`pnpm test`, `pnpm typecheck`, `pnpm build` pass — do not report completion until all do.
Final message must include: which player path was implemented, the state-machine states,
the store selectors mapped into `q_state` (and which fields are `null`-until-wired), the
settings toggle location, the bundle-size delta, and confirmation `scripts/spike/` is
gone. Production trigger: `LiveSceneLayer` mounted in `CinematicScene.tsx` — name the line.

## Out of scope

Bridge/Rust changes (WO211/212 — if a contract gap is found, stop and report, don't patch
Rust here); the UE5 scene and its Blueprint state handling (WO214); scene content
decisions (camera moves, look — the user authors those in-editor); Windows/WebView2.
