# WO214 — Ops: UE5 project contract, packaging checklist + live E2E

## Shared context (read first)

Last of the **WO210–WO214 live UE5 background batch** (overview in WO210). Execution:
`{ 210 ∥ 211 } → 🔍A → 212 → 213 → 🔍B → 214`. Runs after 🔍B (the merged bridge +
frontend stack reviewed). This WO is different in kind from the others: **the UE5 scene
itself is authored by the user in the UE5 editor** — the fleet's job here is the contract,
the configuration checklist, a minimal reference implementation of the state consumer, and
the end-to-end validation procedure on the user's machine (Fedora, Wayland, NVIDIA;
UE5 project lives outside both repos).

Frontend repo for docs/tests: `q_frontend`, `pnpm` never npm. Read
`docs/dev/visual-bridge.md` (WO211–213 contracts) and `docs/dev/live-scene-transport-spike.md`
(codec/transport verdict) first.

## How the pieces work today (read these files)

- `docs/dev/visual-bridge.md` — launch args, signalling URL, `q_state` envelope, health
  semantics (everything UE5 must speak)
- `src-tauri/src/visual_bridge/config.rs` — the config keys the operator sets
  (`ue5_binary_path`, `extra_args`, `port`)
- `src/lib/visualBridge/stateFeed.ts` — the exact fields and value ranges UE5 receives
- WO210's spike report — codec + encoder settings the stream must use

## Goal

```text
docs/dev/ue5-scene-contract.md   — the contract any Q scene project must satisfy
docs/dev/ue5-operator-runbook.md — zero-to-live checklist on the user's machine
+ one recorded successful E2E: app start → live scene → workspace/job reactions →
  UE5 kill → static fallback → auto-restart → live again. No orphans, no stalls.
```

## Tasks

1. **Scene contract doc** (`docs/dev/ue5-scene-contract.md`). Everything scene-agnostic a
   Q background project must implement:
   - Plugin + launch: Pixel Streaming enabled, launched by the bridge with
     `-RenderOffscreen -PixelStreamingURL=ws://127.0.0.1:<port>/ws` plus the encoder flags
     from the spike verdict (codec, target bitrate ≥ 50 Mbps local, keyframe interval,
     resolution matching the primary display, 60fps cap).
   - `q_state` consumption: the message envelope, each field's type/range
     (`workspace`: enum of actual workspace ids — list them from `useAppStore`;
     `symbol`: string|null; `jobStatus`: `idle|running|done|failed`|null; `progress`:
     0–1|null; `risk`: `normal|elevated`|null), the rule that **fields can be null and new
     fields may appear — unknown = ignore**, and the reconnect-delivers-latest-state
     behavior (scene must be able to jump to a state, not just transition).
   - Parallax input: the ≤30Hz normalized `{x,y}` message and expected damping (scene-side
     smoothing, since input pauses when not live).
   - Performance floor: the scene must hold 60fps at target resolution _while NVENC
     encodes_ — headroom guidance, and the instruction that scene quality settings live in
     the UE5 project, not in Q.
2. **Reference state consumer.** A minimal Blueprint (or C++ snippet) documented in the
   contract: receive `q_state`, parse, drive one placeholder parameter per field (e.g.
   directional light color by `workspace`, fog density by `progress`). Purpose: the user
   copies the pattern into his real scenes; E2E uses it for verification. Keep it to
   documented screenshots/nodes or a `.txt` of the C++ — the UE5 project is not in-repo.
3. **Operator runbook** (`docs/dev/ue5-operator-runbook.md`): package the UE5 project
   (Linux target), where to put the build, writing `visual_bridge.toml`
   (`ue5_binary_path`, port), the settings toggle, how to read
   `visual-bridge://health` states from the app log, and a troubleshooting table
   (no stream ⇒ check streamer_connected; stalls ⇒ check NVENC/driver; GaveUp ⇒ log
   locations; orphaned process ⇒ shouldn't happen, how to verify and report).
4. **E2E validation script** (manual, on the user's machine — write it as a numbered
   checklist in the runbook, execute it with the user, record results in the WO log):
   cold start → `live` within 10s; workspace switch → scene reacts; start an optimization
   → `progress` drives the scene; `kill -9` the UE5 pid → static fallback within one
   crossfade + auto-restart → `live` again; app quit → no UE5 process survives
   (`pgrep`); toggle `'off'` → disconnected, UE5 still supervised (or document actual
   toggle semantics as WO213 built them); 30-minute soak → no stall, webview memory flat.
5. **Contract drift test** (the one automated piece): a vitest asserting the frontend's
   `q_state` payload shape (from `stateFeed.ts`) matches a checked-in JSON schema
   `docs/dev/ue5-scene-contract.schema.json` that the contract doc embeds — so a future
   store refactor that silently changes the envelope fails CI instead of silently
   breaking scenes.

## Guardrails

> **The UE5 project is the user's creative property** — this WO defines interfaces and
> verifies behavior; it never prescribes look, camera work, or scene content.
> **Nothing UE5 gets committed to the repos** except docs and the JSON schema: no binaries,
> no `.uasset`, no absolute paths in committed files.
> **E2E failures are findings, not patch targets**: if the E2E exposes a WO211–213 bug,
> file it against that WO (stop-and-report), don't hotfix Rust/TS inside this WO.
> **The schema is the single source of truth for the envelope** — the contract doc embeds
> it, the test enforces it.

## Tests

- `src/lib/visualBridge/__tests__/stateContract.test.ts`: `stateFeed` output validates
  against `ue5-scene-contract.schema.json`; schema rejects a deliberately wrong payload
  (guards against a vacuous schema).
- Everything else is the manual E2E checklist (documented outcomes required, see DoD).
- Existing suites stay green: `pnpm test`, `pnpm build`.

## Docs

The two docs above are the deliverable, plus linking both from `docs/dev/visual-bridge.md`
so the bridge doc is the entry point.

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until they do. Final message
must include: paths of both docs + schema, the E2E checklist results table (each step
pass/fail as actually observed on the user's machine — do not report completion until
every step passed or failures are filed against their owning WO), the soak-test duration
and memory observation, and confirmation no UE5 artifacts entered the repo.

## Out of scope

Any change to `src-tauri` or `src/lib/visualBridge` runtime code (file findings instead);
the actual production scene's art/design; Windows packaging; multi-monitor/multi-window
behavior; adaptive quality and telemetry (the old "Phase 3" — deliberately dropped,
2026-07-05).
