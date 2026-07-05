# WO210 — Frontend: Live-scene transport spike (WebRTC in WebKitGTK) — GATE

## Shared context (read first)

First of the **WO210–WO214 live UE5 background batch**. The batch replaces the static
background renders in `CinematicScene` with a **real-time UE5 scene** streamed into the
webview via Pixel Streaming, supervised by a new `visual_bridge` module inside `src-tauri`
(architecture decided 2026-07-05; the user's `q_visual_bridge` standalone-service idea was
folded into `src-tauri` as a module).

Execution sequence + parallelism:
`{ 210 ∥ 211 } → 🔍A (transport decision from this WO's report) → 212 → 213 → 🔍B → 214`.
This WO runs in parallel with WO211 (no shared files — WO211 is the process supervisor,
transport-agnostic). WO212 and WO213 are **blocked** on this WO's decision report. Strictly
serial after that: 212 and 213 both touch `src-tauri/src/visual_bridge/` wiring and the
frontend consumes 212's ports/protocol.

Two-repo note: frontend `q_frontend` uses `pnpm` (never npm); backend untouched by this
batch. **This batch targets the user's Linux desktop** (Fedora, Wayland, NVIDIA): Tauri
renders through **WebKitGTK**, whose WebRTC support is historically incomplete or
compile-time disabled. That is the load-bearing assumption of the whole batch and this WO
exists to prove or replace it. (On Windows, Tauri uses WebView2/Chromium where WebRTC is a
non-issue — do not let Windows results stand in for the Linux answer.)

## How the pieces work today (read these files)

- `src/components/cinematic/CinematicScene.tsx` — the background stack this batch extends
  (static branded/clean layers, particles `Canvas`, vignette/noise overlays)
- `src-tauri/tauri.conf.json` + `src-tauri/src/main.rs` — the shell the webview runs in
- `tauri-dev.js` — how the dev shell is launched
- `docs/work-orders/WO213-frontend-live-scene-layer.md` — the consumer of this decision

## Goal

A written, evidence-backed answer to one question:

```text
Which transport reliably delivers 60fps 1440p+ H.264/HEVC/AV1 video from a local
process into THIS app's WebKitGTK webview: (A) WebRTC, or (B) WebSocket + MSE?
```

Deliverable is a report at `docs/dev/live-scene-transport-spike.md` with a hard
recommendation, plus the throwaway harness used to produce it.

## Tasks

1. **Capability probe.** In the running Tauri dev shell (not a browser!), probe and record:
   `RTCPeerConnection` existence and a loopback offer/answer with a video transceiver;
   `MediaSource.isTypeSupported(...)` for `avc1.*`, `hvc1.*/hev1.*`, `av01.*`;
   `VideoDecoder` (WebCodecs) availability. Also record the WebKitGTK version and any
   relevant env flags (e.g. `WEBKIT_*`) the shell runs with.
2. **Path A — WebRTC.** Minimal local sender (GStreamer `webrtcbin` script or a tiny node
   harness — throwaway, lives in `scripts/spike/`) streaming a test pattern; hand-rolled
   signalling over a local WS; play it in a `<video>` in a scratch route/page behind a dev
   flag. Measure: does it connect, does hardware decode engage, sustained fps at 1440p,
   CPU% of the webview process.
3. **Path B — WS + MSE fallback.** Same test pattern as fragmented MP4 (H.264) pushed over
   a local WebSocket into `MediaSource`/`SourceBuffer`. Measure the same numbers plus
   end-to-end latency (timestamp burned into the pattern, photographed against a clock —
   crude is fine, we need "under ~150ms", not science).
4. **Decision report.** `docs/dev/live-scene-transport-spike.md`: environment details, raw
   numbers for both paths, failure modes hit, and a **single recommendation** with the
   codec to use. If A works, B's section still gets filled in (it remains the documented
   fallback). If neither path plays video at acceptable quality, say so plainly — that
   verdict re-opens the batch design (🔍A) rather than proceeding on hope.

## Guardrails

> **Throwaway means throwaway**: everything under `scripts/spike/` and any scratch page is
> clearly marked, dev-flag-gated, and deleted by WO213 — nothing from this WO ships.
> **Test in the Tauri webview only.** Chrome/Firefox results are worthless here.
> **No UE5 involvement.** Test patterns only; UE5 enters at WO214.
> **Do not touch `CinematicScene`** or anything under `src/components/cinematic/`.

## Tests

None (spike). The deliverable is the report; existing suites must remain green
(`pnpm test`), which mostly means: don't wire the scratch page into the router in a way
that breaks builds.

## Docs

The report itself is the doc: `docs/dev/live-scene-transport-spike.md`.

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until they do. Final message
must include: the recommendation (A or B) in one sentence, the codec, the measured fps/CPU
for the winning path, the WebKitGTK version probed, and the report path. WO212/WO213 must
not start until this lands (🔍A).

## Out of scope

UE5 anything (WO214); the supervisor (WO211); signalling protocol implementation (WO212);
production UI (WO213); Windows/WebView2 validation.
