# WO211 — Frontend: visual_bridge supervisor module (UE5 process lifecycle)

## Shared context (read first)

Second of the **WO210–WO214 live UE5 background batch** (see WO210 for the batch overview).
Execution: `{ 210 ∥ 211 } → 🔍A → 212 → 213 → 🔍B → 214`. **This WO runs in parallel with
WO210** — it is transport-agnostic and touches only `src-tauri`. WO212 extends the module
this WO creates, so 212 must merge after this.

This WO builds the Rust module inside `src-tauri` that owns the UE5 renderer process:
configuration, spawn, health, restart with backoff, teardown, and the frontend-facing
health events + state command. It deliberately knows nothing about video transport or
signalling (WO212). The app must behave **exactly as today** when no UE5 build is
configured — dormant by default, like the Sentry batch (WO203–206 pattern).

Frontend repo: `q_frontend` — Rust work under `src-tauri` (cargo), TS under `src` (pnpm,
never npm). Runtime target is the user's Linux desktop; the UE5 binary path is
user-configured, never committed.

## How the pieces work today (read these files)

- `src-tauri/src/main.rs` — Tauri builder/setup hook where the module gets initialized and
  where existing plugins/commands are registered (follow the existing registration style)
- `src-tauri/Cargo.toml` — dependency conventions (check what async runtime Tauri v2
  already brings before adding one)
- `src-tauri/tauri.conf.json` — config surface
- `src/lib/env.ts` — frontend env accessor pattern (for the WO213 toggle later; this WO
  only needs to emit events the frontend can subscribe to)
- `docs/work-orders/WO205-frontend-sentry-react-tauri.md` — the "dormant by default"
  house pattern this WO mirrors

## Goal

```rust
// src-tauri/src/visual_bridge/mod.rs
pub struct VisualBridge { /* supervisor state machine */ }
pub fn init(app: &AppHandle) -> VisualBridge // no-op supervisor when unconfigured
// Tauri command: visual_bridge_send_state(state_json: String)
// Tauri events:  "visual-bridge://health" { status, restarts, detail }
```

With a configured UE5 build: app start → UE5 spawned headless within seconds, crash →
restarted with backoff, app quit → UE5 killed, frontend always knows the current status.
Without one: zero processes, zero log noise beyond one debug line.

## Tasks

1. **Module skeleton + config.** `src-tauri/src/visual_bridge/{mod.rs,config.rs,supervisor.rs}`.
   Config from a `visual_bridge` section in the app's config dir (JSON/TOML — follow
   whatever `src-tauri` already uses for user settings; if nothing exists, a
   `visual_bridge.toml` in `app_config_dir()`), env-overridable: `ue5_binary_path`,
   `extra_args` (default includes `-RenderOffscreen`), `enabled` (default `true` but
   moot without a path), `max_restarts` (default 5), `backoff_base_ms` (default 1000).
   Missing/invalid path ⇒ supervisor state `Disabled`, one debug log, nothing spawned.
2. **Supervisor state machine.** States: `Disabled → Starting → Running → Backoff(n) →
GaveUp`, plus `Stopping` on app exit. Spawn the child with piped stdout/stderr (tee to
   the app log with a `[ue5]` prefix, rate-limited). Health = child alive (process-level
   only; liveness-over-IPC arrives with WO212). Crash ⇒ exponential backoff restart
   (base × 2ⁿ, capped at 30s), `max_restarts` within a 10-minute window ⇒ `GaveUp` (no
   restart storm). Clean kill (SIGTERM, then SIGKILL after 5s) on Tauri exit — verify no
   orphan survives `app.exit()`.
3. **Frontend surface.** Emit `visual-bridge://health` on every state change with
   `{ status: "disabled"|"starting"|"running"|"backoff"|"gave_up", restarts, detail }`,
   and once to each new window on webview creation so late subscribers aren't blind.
   Register command `visual_bridge_send_state(state_json)`: validate it is a JSON object
   ≤ 4 KB, rate-limit to 30 msg/s (drop + count, don't error), and hand it to a
   `StateSink` trait object. This WO ships only `NullSink` (logs at trace level) — WO212
   implements the real sink. The trait is the seam; keep it minimal (`fn send(&self,
json: &str)`).
4. **Wire-up.** Initialize in the Tauri setup hook in `src-tauri/src/main.rs`; manage the
   supervisor handle as Tauri state; register the command. This is the production trigger —
   name it in the final message.

## Guardrails

> **Dormant by default**: no configured binary ⇒ no child process, no threads beyond the
> idle supervisor, no repeated logging. The committed repo contains no UE5 paths.
> **No transport code**: no WebSocket, no signalling, no ports opened. `StateSink` is the
> only forward reference to WO212.
> **No restart storms**: the backoff/give-up caps are hard requirements, tested.
> **No orphans**: child lifetime strictly ⊆ app lifetime, including panic paths (kill on
> drop).
> **Determinism**: the state machine is testable without real processes — spawn via a
> trait/closure so tests inject a fake child.

## Tests

`src-tauri` `cargo test` (module-level, fake child process):

- unconfigured ⇒ `Disabled`, nothing spawned
- spawn ok ⇒ `Running`, health event emitted
- child exit ⇒ `Backoff(1)` with correct delay ⇒ respawn ⇒ `Running`
- `max_restarts` exceeded within window ⇒ `GaveUp`, no further spawns
- stop ⇒ child killed, `Stopping` emitted
- `visual_bridge_send_state`: oversize payload rejected, >30/s dropped not errored,
  valid payload reaches the `NullSink`

Frontend: none in this WO (`pnpm test` stays green — no TS changes expected beyond none).

## Docs

`docs/dev/visual-bridge.md` (new): what the module does, the config file location/keys, the
health event contract, the `StateSink` seam, and a note that transport lands in WO212.

## Definition of done

`cargo test` (in `src-tauri`), `pnpm test`, and `pnpm build` pass — do not report
completion until all three do. Final message must include: the config file location and
key list, the health event payload shape, the production trigger line in `main.rs`, and
confirmation that an unconfigured run spawns nothing (show the debug log line).

## Out of scope

Signalling/WebSocket/ports and the real `StateSink` (WO212); any frontend UI or the
settings toggle (WO213); UE5 project/flags themselves (WO214); making the bridge a
standalone binary (explicitly decided against, 2026-07-05).
