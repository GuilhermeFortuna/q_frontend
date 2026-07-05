# WO212 — Frontend: visual_bridge signalling relay + state channel

## Shared context (read first)

Third of the **WO210–WO214 live UE5 background batch** (overview in WO210). Execution:
`{ 210 ∥ 211 } → 🔍A → 212 → 213 → 🔍B → 214`. **Blocked on 🔍A** — read
`docs/dev/live-scene-transport-spike.md` (WO210's report) before writing any code, and on
WO211's merge (this WO extends `src-tauri/src/visual_bridge/`). Strictly serial with
WO213: the frontend consumes the port/protocol this WO defines.

This WO gives the bridge its data plane control: a localhost WebSocket endpoint that
(A-path) relays Epic Pixel Streaming signalling between the UE5 streamer and the webview
player, or (B-path, if the spike ruled out WebRTC) accepts the UE5-side video byte stream
and forwards it to the webview over WS for MSE playback. It also implements the real
`StateSink` so `visual_bridge_send_state` JSON reaches UE5.

Frontend repo: `q_frontend`; Rust under `src-tauri` (cargo), `pnpm` never npm. All sockets
bind `127.0.0.1` only.

## How the pieces work today (read these files)

- `docs/dev/live-scene-transport-spike.md` — **the transport decision; this WO's shape
  depends on it**
- `src-tauri/src/visual_bridge/` — WO211's supervisor, config, `StateSink` seam
- `docs/dev/visual-bridge.md` — WO211's module doc (extend it, don't fork it)
- Epic's Pixel Streaming signalling protocol reference (messages: `config`, `offer`,
  `answer`, `iceCandidate`, `playerCount`, streamer/player registration) — the relay
  treats payloads as opaque JSON and routes them; do not re-model WebRTC semantics

## Goal

```rust
// src-tauri/src/visual_bridge/signalling.rs
pub struct SignallingServer // ws://127.0.0.1:<port>/ws  (port from config, default 8890)
// routes streamer <-> player signalling; owns the UE5-side connection registry
// src-tauri/src/visual_bridge/state_sink.rs
pub struct ChannelStateSink // replaces NullSink: state JSON -> connected UE5 streamer
```

UE5 launched with `-PixelStreamingURL=ws://127.0.0.1:8890/ws` registers as streamer; the
webview connects as player; offers/answers/ICE flow through; `visual_bridge_send_state`
JSON arrives at UE5 (via the signalling connection as a typed message, so state works even
before/without a WebRTC peer connection).

## Tasks

1. **WS server.** Async WS listener inside the module (reuse the runtime Tauri already
   ships; add `tokio-tungstenite` or equivalent only if nothing suitable exists — justify
   the dependency in the final message). Config keys added to WO211's file: `port`
   (default 8890), bind fixed to `127.0.0.1`. Server lifecycle ⊆ supervisor lifecycle:
   starts when the supervisor leaves `Disabled`, stops with it.
2. **Signalling relay (A-path).** Implement the minimal subset of Epic's signalling
   protocol needed for one streamer + one player: registration, `config` (ICE servers:
   empty/STUN-less — it's loopback), opaque relay of `offer`/`answer`/`iceCandidate`,
   disconnect propagation (streamer drop ⇒ notify player and vice versa). Exactly one
   player: a second player connection replaces the first (the app has one background).
   Log unknown message types at debug, relay them anyway (protocol drift tolerance).
3. **B-path variant (only if 🔍A chose MSE).** Skip task 2; instead: accept the UE5-side
   media stream connection and fan it to the player socket as binary WS frames, with a
   bounded queue (drop-oldest on backpressure — a background may skip, it must never
   stall the webview). The WO executor implements **one** of task 2/3 per the spike
   verdict and records which in the final message.
4. **State channel.** `ChannelStateSink` implementing WO211's `StateSink`: wraps state
   JSON as `{ "type": "q_state", "payload": ... }` sent to the registered streamer
   connection; buffers the **latest** message (size-1 buffer, newest wins) while no
   streamer is connected and delivers it on registration, so UE5 always gets current
   app state on (re)connect. Swap it in for `NullSink` at init.
5. **Supervisor integration.** UE5 launch args now include the signalling URL (built from
   config port). Health gains one signal: streamer registered ⇒ include
   `"streamer_connected": true` in the `visual-bridge://health` payload (WO213 uses this
   to begin its own connection attempts).

## Guardrails

> **Loopback only**: every listener binds `127.0.0.1`; no config key can widen it.
> **Video bytes never buffer unboundedly in the bridge** (B-path): bounded queue,
> drop-oldest. On the A-path the bridge never touches media at all — WebRTC is
> peer-to-peer; the relay carries only signalling JSON.
> **One streamer, one player**: reject/replace extras; this is an app background, not a
> streaming platform.
> **WO211's dormancy holds**: `Disabled` supervisor ⇒ no port opened.
> **Do not modify frontend TS** — the player side is WO213's.

## Tests

`cargo test` with in-process WS clients (fake streamer + fake player):

- streamer registers, player connects ⇒ offer/answer/ICE relayed verbatim both ways
- streamer disconnect ⇒ player notified; reconnect ⇒ re-registration works
- second player ⇒ first replaced cleanly
- state sink: send before streamer connects ⇒ delivered once on registration (latest
  only); send while connected ⇒ delivered immediately; `q_state` envelope shape asserted
- supervisor `Disabled` ⇒ port closed (connection refused)
- (B-path instead, if chosen: backpressure drops oldest, player stall doesn't block the
  UE5-side reader)

`pnpm test` / `pnpm build` stay green (no TS changes).

## Docs

Extend `docs/dev/visual-bridge.md`: the port + URL scheme, the implemented signalling
message subset, the `q_state` envelope, and the health payload addition.

## Definition of done

`cargo test`, `pnpm test`, `pnpm build` pass — do not report completion until all do.
Final message must include: which path (A/B) was implemented per the spike verdict, the
port and full `ws://` URL UE5 must be launched with, the exact `q_state` envelope, any new
crate dependencies with justification, and the health payload field added.

## Out of scope

The webview player and any UI (WO213); UE5 project configuration and the Blueprint that
consumes `q_state` (WO214); auth on the socket (loopback single-user app); multi-streamer
or multi-window support.
